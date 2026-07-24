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
// 7. General Message & Dialog Handlers
// ==========================================
client.on('message', async (msg) => {
  const jid = msg.from;
  const text = msg.body.trim();

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

// ==========================================
// 8. Tasks Real-time Notifications Listener
// ==========================================
db.collection('tasks').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async change => {
    if (change.type === 'added' || change.type === 'modified') {
      const taskData = change.doc.data();
      const taskId = change.doc.id;
      
      // If task is verified, no need to notify
      if (taskData.isVerified) return;

      const assignees = taskData.assignees || [];
      const notified = taskData.notifiedAssignees || [];

      // Find assignees who have not been notified yet
      const toNotify = assignees.filter(name => !notified.includes(name));

      if (toNotify.length > 0) {
        for (const name of toNotify) {
          const jid = getJidForSoldier(name);
          if (jid) {
            const siteUrl = process.env.SITE_URL || 'https://tasks-b9e9e.web.app';
            const timeHeb = taskData.timeOfDay === 'morning' ? 'בוקר' : taskData.timeOfDay === 'noon' ? 'צהריים' : taskData.timeOfDay === 'evening' ? 'ערב' : '';
            const timeStr = timeHeb ? ` [משימת ${timeHeb}]` : '';
            
            const msg = `🔔 *שלום ${name}, שוייכה אליך משימה חדשה בצוות ${taskData.team}!*${timeStr}\n\n*${taskData.title}*\n${taskData.description ? `_תיאור: ${taskData.description}_\n` : ''}\nלפרטים נוספים ועדכון סטטוס, כנס לאתר: ${siteUrl}`;
            
            try {
              await client.sendMessage(jid, msg);
              console.log(`Successfully sent task notification to ${name} (${jid})`);
            } catch (err) {
              console.error(`Failed to send WhatsApp task notification to ${name}:`, err.message);
            }
          } else {
            console.warn(`JID not found for soldier: ${name}`);
          }
        }

        // Save notification state in Firestore to prevent duplicate messages
        try {
          await db.collection('tasks').doc(taskId).update({
            notifiedAssignees: admin.firestore.FieldValue.arrayUnion(...toNotify)
          });
        } catch (err) {
          console.error(`Failed to update notifiedAssignees for task ${taskId}:`, err.message);
        }
      }
    }
  });
}, err => {
  console.error('Tasks snapshot listener error:', err);
});

// Start the client
client.initialize();

