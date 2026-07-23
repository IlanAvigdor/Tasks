require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ==========================================
// 1. Initialize Firebase Admin SDK
// ==========================================
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('Loading Firebase credentials from serviceAccountKey.json...');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn('⚠️ No serviceAccountKey.json found in whatsapp-bot directory!');
  console.warn('Trying application default credentials...');
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'tasks-b9e9e'
  });
}

const db = admin.firestore();

// ==========================================
// 2. State & Configuration
// ==========================================
let meetingConfig = null;
let activeWhitelist = [];
let contactMap = new Map(); // Name -> JID
let activeDialogs = new Map(); // JID -> { state, name, team, period }
let sentAlertsToday = {
  date: '',
  warning10Min: false,
  started: false
};

const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'גדוד 402';
const GROUP_ID = process.env.WHATSAPP_GROUP_ID || null;

// ==========================================
// 3. Helper Functions
// ==========================================

// Get today's date in YYYY-MM-DD format (local time)
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Clean and normalize Hebrew names for better matching
function normalizeName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/["']/g, '') // Remove quotes (e.g. טנ"א)
    .replace(/\s+/g, ' '); // Normalize spaces
}

// Map WhatsApp contacts to whitelist names
async function mapContacts(client) {
  try {
    console.log('Fetching WhatsApp contacts to map names...');
    const contacts = await client.getContacts();
    contactMap.clear();

    contacts.forEach(contact => {
      // Check all possible name fields in WhatsApp contact
      const possibleNames = [
        contact.name,
        contact.pushname,
        contact.shortName
      ].filter(Boolean).map(normalizeName);

      possibleNames.forEach(name => {
        contactMap.set(name, contact.id._serialized);
      });
    });

    console.log(`Mapped ${contactMap.size} unique contact names to JIDs.`);
  } catch (err) {
    console.error('Error mapping contacts:', err);
  }
}

// Get JID for a soldier name
function getJidForSoldier(soldierName) {
  const normSoldier = normalizeName(soldierName);
  
  // 1. Direct exact match
  if (contactMap.has(normSoldier)) {
    return contactMap.get(normSoldier);
  }

  const soldierWords = normSoldier.split(' ').filter(w => w.length > 1);
  if (soldierWords.length === 0) return null;

  // 2. Robust word-based matching
  for (const [contactName, jid] of contactMap.entries()) {
    const contactWords = contactName.split(' ').filter(w => w.length > 1);
    if (contactWords.length === 0) continue;

    // Check if first name matches exactly (e.g., "אוראל" === "אוראל")
    if (soldierWords[0] === contactWords[0]) {
      // If both have last names, they must also match
      if (soldierWords.length > 1 && contactWords.length > 1) {
        if (soldierWords[1] === contactWords[1]) {
          return jid;
        }
      } else {
        // If one of them has no last name, we can match on first name as fallback
        return jid;
      }
    }
  }
  return null;
}


// Find target WhatsApp Group Chat
async function findGroupChat(client) {
  try {
    if (GROUP_ID) {
      return await client.getChatById(GROUP_ID);
    }
    const chats = await client.getChats();
    const groupChat = chats.find(chat => chat.isGroup && chat.name === GROUP_NAME);
    if (groupChat) {
      return groupChat;
    }
    console.warn(`Could not find group chat with name: "${GROUP_NAME}"`);
    return null;
  } catch (err) {
    console.error('Error finding group chat:', err);
    return null;
  }
}

// ==========================================
// 4. Firestore Observers
// ==========================================

// Listen to whitelist users to know who the soldiers are
db.collection('whitelist').onSnapshot(snapshot => {
  activeWhitelist = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.role === 'soldier') {
      activeWhitelist.push({
        id: doc.id,
        ...data
      });
    }
  });
  console.log(`Loaded ${activeWhitelist.length} soldiers from Firestore Whitelist.`);
}, err => {
  console.error('Whitelist snapshot listener error:', err);
});

// Listen to scheduled meetings config
db.collection('task_bundles').doc('meeting').onSnapshot(docSnap => {
  if (docSnap.exists) {
    meetingConfig = docSnap.data();
    console.log(`Meeting Config Updated: scheduled at ${meetingConfig.time} on ${meetingConfig.date}`);
  } else {
    meetingConfig = null;
    console.log('No meeting currently scheduled.');
  }
}, err => {
  console.error('Meeting config snapshot listener error:', err);
});

// ==========================================
// 5. WhatsApp Client Initialization
// ==========================================
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('Scan the QR code below with your WhatsApp camera to authenticate:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('✅ WhatsApp Bot is ready and logged in!');
  await mapContacts(client);
  
  // Re-map contacts periodically (every 1 hour)
  setInterval(() => mapContacts(client), 3600000);
});

// ==========================================
// 6. Ticker / Scheduler Loop (Runs every minute)
// ==========================================
setInterval(async () => {
  if (!client.info || !meetingConfig || !meetingConfig.time) return;

  const today = getTodayDateStr();
  
  // Reset alert states if it is a new day
  if (sentAlertsToday.date !== today) {
    sentAlertsToday = {
      date: today,
      warning10Min: false,
      started: false
    };
  }

  // Ensure the scheduled meeting is for today
  if (meetingConfig.date !== today) return;

  const [hours, minutes] = meetingConfig.time.split(':').map(Number);
  const now = new Date();
  
  const meetingDate = new Date(now);
  meetingDate.setHours(hours, minutes, 0, 0);

  const diffMs = meetingDate - now;
  const diffMinutes = Math.round(diffMs / 60000);

  // 1. 10-Minute Warning
  if (meetingConfig.sendReminder && diffMinutes === 10 && !sentAlertsToday.warning10Min) {
    sentAlertsToday.warning10Min = true;
    
    // Send public notice to group if found
    const group = await findGroupChat(client);
    if (group) {
      const groupMsg = `📢 *תזכורת למסדר גדודי* 📢\nהמסדר יתחיל בעוד 10 דקות בשעה *${meetingConfig.time}*.\nנא להיכנס לאפליקציה או לענות להודעה הפרטית של הבוט לדיווח נוכחות!`;
      await group.sendMessage(groupMsg);
      console.log('Sent 10-minute warning to WhatsApp group.');
    }

    // Send interactive direct message to all soldiers on the whitelist
    const period = hours < 14 ? 'morning' : 'evening';
    const greeting = hours < 14 ? 'בוקר טוב' : 'ערב טוב';

    for (const soldier of activeWhitelist) {
      const jid = getJidForSoldier(soldier.name);
      if (jid) {
        const dm = `${greeting} ${soldier.name}! מה שלומך?\n\nהמסדר הגדודי מתוזמן לעוד 10 דקות (בשעה *${meetingConfig.time}*).\nהאם אתה מגיע?\n\n1. אני מגיע 🟢`;
        await client.sendMessage(jid, dm).catch(e => {
          console.error(`Failed to send initial dialog to ${soldier.name}:`, e.message);
        });
        
        // Save dialog state
        activeDialogs.set(jid, {
          state: 'ASKED_COMING',
          name: soldier.name,
          team: soldier.team || 'תקשוב',
          period: period
        });
      }
    }
    console.log(`Sent direct interactive reminders to ${activeWhitelist.length} soldiers.`);
  }

  // 2. Meeting Started Alert + Missing Soldiers Roll Call
  if (diffMinutes <= 0 && !sentAlertsToday.started) {
    sentAlertsToday.started = true;
    const startMsg = `🚨 *זמן מסדר הגיע!* 🚨\nהמסדר הגדודי התחיל כעת (*${meetingConfig.time}*).\nנא להיכנס כולם לאפליקציה ולדווח נוכחות ("אני בבסיס/גימלים/חופש") באופן מיידי!`;
    
    const group = await findGroupChat(client);
    if (group) {
      await group.sendMessage(startMsg);
      console.log('Sent meeting started alert to WhatsApp group.');
    }

    // Determine period based on meeting time
    const period = hours < 14 ? 'morning' : 'evening';
    
    // Fetch today's attendance records to see who has NOT checked in yet
    setTimeout(async () => {
      try {
        const attendanceSnap = await db.collection('attendance')
          .where('date', '==', today)
          .get();

        const checkedInNames = new Set();
        attendanceSnap.forEach(doc => {
          const data = doc.data();
          if (period === 'morning' && data.morning) {
            checkedInNames.add(normalizeName(data.name));
          } else if (period === 'evening' && data.evening) {
            checkedInNames.add(normalizeName(data.name));
          }
        });

        // Find missing soldiers
        const missingSoldiers = activeWhitelist.filter(soldier => {
          return !checkedInNames.has(normalizeName(soldier.name));
        });

        if (missingSoldiers.length > 0) {
          console.log(`Found ${missingSoldiers.length} missing soldiers. Sending individual reminders...`);
          
          let groupReportMsg = `⚠️ *חיילים שטרם דיווחו נוכחות (${period === 'morning' ? 'בוקר' : 'ערב'}):*\n`;
          
          for (const soldier of missingSoldiers) {
            groupReportMsg += `- ${soldier.name}\n`;
            
            // Send direct WhatsApp warning if mapped
            const jid = getJidForSoldier(soldier.name);
            if (jid) {
              const dm = `שלום ${soldier.name}, טרם דיווחת נוכחות למסדר של שעה ${meetingConfig.time}. נא להיכנס לאפליקציה ולדווח כעת!`;
              await client.sendMessage(jid, dm).catch(e => {
                console.error(`Failed to DM ${soldier.name}:`, e.message);
              });
            }
          }

          // Post the missing list to the group
          if (group) {
            await group.sendMessage(groupReportMsg);
            console.log('Posted missing list to WhatsApp group.');
          }
        } else {
          if (group) {
            await group.sendMessage(`✅ כל החיילים ביצעו דיווח נוכחות למסדר!`);
          }
        }
      } catch (err) {
        console.error('Error running missing soldiers checks:', err);
      }
    }, 5000); // Wait 5 seconds after starting to allow initial check-ins
  }
}, 60000);

// ==========================================
// 7. General Message & Dialog Handlers
// ==========================================
client.on('message', async (msg) => {
  const jid = msg.from;
  const text = msg.body.trim();

  // A. Check if there is an active dialog with this user
  if (activeDialogs.has(jid)) {
    const dialog = activeDialogs.get(jid);
    
    if (dialog.state === 'ASKED_COMING') {
      if (text === '1' || text.toLowerCase().includes('מגיע') || text.toLowerCase().includes('אני מגיע') || text.toLowerCase() === 'כן') {
        try {
          const today = getTodayDateStr();
          const docId = `${today}_${dialog.name}`;
          const docRef = db.collection('attendance').doc(docId);
          
          const updateData = {
            name: dialog.name,
            date: today,
            team: dialog.team,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          if (dialog.period === 'morning') {
            updateData.morningPreCheck = 'coming';
          } else {
            updateData.eveningPreCheck = 'coming';
          }

          await docRef.set(updateData, { merge: true });
          await msg.reply('רשמתי שאתה בדרך! מחכים לך במסדר. אל תשכח לסרוק את הברקוד כשתגיע! 🟢');
          activeDialogs.delete(jid);
          console.log(`Updated Firestore: ${dialog.name} confirmed coming via WhatsApp (${dialog.period})`);
        } catch (err) {
          console.error('Error saving WhatsApp pre-check:', err);
          await msg.reply('שגיאה בעדכון הנתונים. אנא פנה למפקד.');
        }
      } else {
        await msg.reply('נא להשיב "1" או "אני מגיע" כדי לאשר הגעה למסדר! 🟢');
      }
      return; // Stop processing further for this message
    }
  }

  // B. General command triggers
  if (text === '!נוכחות' || text === '!סטטוס') {
    const today = getTodayDateStr();
    try {
      const attendanceSnap = await db.collection('attendance')
        .where('date', '==', today)
        .get();

      let presentCount = 0;
      attendanceSnap.forEach(doc => {
        const data = doc.data();
        if (data.morning === 'present' || data.evening === 'present') {
          presentCount++;
        }
      });

      await msg.reply(`מצב נוכחות להיום (${today.split('-').reverse().join('.')}):\nדווחו נוכחות: ${presentCount} מתוך ${activeWhitelist.length} חיילים.`);
    } catch (err) {
      console.error('Error fetching attendance status:', err);
      await msg.reply('שגיאה בקבלת נתוני נוכחות.');
    }
  }
});

// Start the client
client.initialize();
