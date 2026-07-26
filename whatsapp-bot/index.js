require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
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
let activeWhitelist = [];
let activeMeetings = [];
let contactMap = new Map(); // Name -> JID
let groupMap = new Map();   // Group Name -> JID
let sock = null;

// Track sent alerts today to prevent duplicates
// Keys: YYYY-MM-DD_meetingId_reminder, YYYY-MM-DD_meetingId_summary
const sentNotifications = new Set();

const GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'גדוד 402';
const GROUP_ID = process.env.WHATSAPP_GROUP_ID || null;

// ==========================================
// 3. Helper Functions
// ==========================================

// Add activity log to Firestore
async function logActivity(type, message) {
  try {
    const today = getTodayDateStr();
    await db.collection('bot_logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: today,
      type,
      message
    });
    console.log(`[BOT LOG] [${type}] ${message}`);
  } catch (err) {
    console.error('Error writing activity log to Firestore:', err);
  }
}

// Get today's date in YYYY-MM-DD format (local time)
function getTodayDateStr() {
  return getTodayDateStrForDate(new Date());
}

function getTodayDateStrForDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to extract text from various WhatsApp message structures
function getMessageText(message) {
  if (!message) return '';
  if (message.ephemeralMessage?.message) {
    return getMessageText(message.ephemeralMessage.message);
  }
  if (message.viewOnceMessage?.message) {
    return getMessageText(message.viewOnceMessage.message);
  }
  if (message.viewOnceMessageV2?.message) {
    return getMessageText(message.viewOnceMessageV2.message);
  }
  if (message.documentWithCaptionMessage?.message) {
    return getMessageText(message.documentWithCaptionMessage.message);
  }
  return message.conversation || 
         message.extendedTextMessage?.text || 
         message.imageMessage?.caption || 
         message.videoMessage?.caption || 
         '';
}

// Clean and normalize Hebrew names for better matching
function normalizeName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/["']/g, '') // Remove quotes (e.g. טנ"א)
    .replace(/\s+/g, ' '); // Normalize spaces
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

    // Check if first name matches exactly
    if (soldierWords[0] === contactWords[0]) {
      // If both have last names, they must also match
      if (soldierWords.length > 1 && contactWords.length > 1) {
        if (soldierWords[1] === contactWords[1]) {
          return jid;
        }
      } else {
        // Fallback to first name match
        return jid;
      }
    }
  }
  return null;
}

// Get JID for Tamar
function getTamarJid() {
  if (process.env.TAMAR_PHONE) {
    let phone = process.env.TAMAR_PHONE.trim();
    if (!phone.endsWith('@s.whatsapp.net')) {
      phone = `${phone}@s.whatsapp.net`;
    }
    return phone;
  }
  return getJidForSoldier('תמר ביליה');
}

// Find target WhatsApp Group Chat JID
async function getGroupJid() {
  if (GROUP_ID) {
    return GROUP_ID.endsWith('@g.us') ? GROUP_ID : `${GROUP_ID}@g.us`;
  }
  const normGroupName = normalizeName(GROUP_NAME);
  if (groupMap.has(normGroupName)) {
    return groupMap.get(normGroupName);
  }
  if (sock) {
    try {
      console.log(`[GROUP LOOKUP] Fetching participating groups to find "${GROUP_NAME}"...`);
      const groups = await sock.groupFetchAllParticipating();
      for (const jid of Object.keys(groups)) {
        const name = groups[jid].subject;
        if (normalizeName(name) === normGroupName) {
          groupMap.set(normGroupName, jid);
          console.log(`[GROUP LOOKUP] Found group JID dynamically: ${jid}`);
          return jid;
        }
      }
    } catch (err) {
      console.error('Failed to fetch participating groups dynamically:', err.message);
    }
  }
  return null;
}

// Get Hebrew status label
function getStatusLabel(status) {
  switch (status) {
    case 'absent': return '❌ חסר/ה';
    case 'sick': return '🏥 חולה (חופשת מחלה/גימלים)';
    case 'leave': return '✈️ חופש';
    case 'duty': return '⚔️ בתפקיד/תורנות';
    default: return '🔴 לא דיווח/ה נוכחות';
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
    const role = data.role || 'soldier';
    if (role === 'soldier') {
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

// Listen to scheduled meetings config (all meetings)
db.collection('task_bundles')
  .where('type', '==', 'meeting')
  .onSnapshot(snapshot => {
    activeMeetings = [];
    snapshot.forEach(doc => {
      activeMeetings.push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log(`Loaded ${activeMeetings.length} meetings from Firestore.`);
  }, err => {
    console.error('Meetings snapshot listener error:', err);
  });

// ==========================================
// 5. WhatsApp Client Connection (Baileys)
// ==========================================
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth_info'));

  let version = [2, 3000, 1015901307]; // Fallback version if API fails
  try {
    const latestVersion = await fetchLatestBaileysVersion();
    version = latestVersion.version;
    console.log(`Fetched latest WhatsApp version: ${version.join('.')}`);
  } catch (err) {
    console.warn('Failed to fetch latest WhatsApp version from server, using fallback:', err.message);
  }

  sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'warn' }),
    browser: ['Antigravity Tasks Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('Scan the QR code below with your WhatsApp camera to authenticate:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`WhatsApp connection closed. Status: ${statusCode}. Error:`, lastDisconnect?.error?.message || lastDisconnect?.error, `Reconnecting... ${shouldReconnect}`);
      logActivity('connection', `🔌 החיבור לוואטסאפ נסגר (סטטוס: ${statusCode || 'לא ידוע'})`);
      if (shouldReconnect) {
        // Wait a few seconds before reconnecting to prevent hot loops
        setTimeout(connectToWhatsApp, 5000);
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp Bot is ready and logged in (Baileys)!');
      logActivity('connection', '🔌 הבוט התחבר בהצלחה לוואטסאפ');
    }
  });

  // Handle incoming contact and chat synchronization
  sock.ev.on('messaging-history.set', ({ contacts, chats }) => {
    if (contacts) {
      contacts.forEach(contact => {
        const jid = contact.id;
        const name = contact.name || contact.notify || contact.verifiedName;
        if (name && jid) contactMap.set(normalizeName(name), jid);
      });
    }
    if (chats) {
      chats.forEach(chat => {
        const jid = chat.id;
        if (jid.endsWith('@g.us')) {
          const name = chat.name;
          if (name) groupMap.set(normalizeName(name), jid);
        } else {
          const name = chat.name || chat.notify;
          if (name) contactMap.set(normalizeName(name), jid);
        }
      });
    }
    console.log(`Synced history: Mapped ${contactMap.size} contact names & ${groupMap.size} group chats.`);
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    contacts.forEach(contact => {
      const jid = contact.id;
      const name = contact.name || contact.notify || contact.verifiedName;
      if (name && jid) contactMap.set(normalizeName(name), jid);
    });
  });

  sock.ev.on('contacts.update', (updates) => {
    updates.forEach(update => {
      const jid = update.id;
      const name = update.name || update.verifiedName;
      if (name && jid) contactMap.set(normalizeName(name), jid);
    });
  });

  sock.ev.on('chats.upsert', (chats) => {
    chats.forEach(chat => {
      const jid = chat.id;
      if (jid.endsWith('@g.us') && chat.name) {
        groupMap.set(normalizeName(chat.name), jid);
      }
    });
  });

  sock.ev.on('chats.update', (updates) => {
    updates.forEach(update => {
      const jid = update.id;
      if (jid.endsWith('@g.us') && update.name) {
        groupMap.set(normalizeName(update.name), jid);
      }
    });
  });

  // ==========================================
  // 6. Message & Command Handlers
  // ==========================================
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      const from = msg.key.remoteJid;
      const text = getMessageText(msg.message).trim();
      console.log(`[MSG RECEIVE] from: ${from}, text: "${text}", fromMe: ${msg.key.fromMe}`);

      // Ignore self-sent messages unless they are commands (for testing)
      if (msg.key.fromMe && !text.startsWith('!')) return;

      if (text === '!נוכחות' || text === '!סטטוס' || text === '!חוסרים') {
        const senderName = msg.key.participant || msg.key.remoteJid;
        let cleanSender = senderName.split('@')[0];
        for (const [name, jid] of contactMap.entries()) {
          if (jid === senderName) {
            cleanSender = name;
            break;
          }
        }
        await logActivity('command', `💬 פקודת ${text} הופעלה על ידי ${cleanSender}`);
        const today = getTodayDateStr();
        
        try {
          const attendanceSnap = await db.collection('attendance')
            .where('date', '==', today)
            .get();

          const attendanceMap = new Map();
          attendanceSnap.forEach(doc => {
            attendanceMap.set(doc.data().name, doc.data());
          });

          // Determine if we should report morning or evening or general status
          // Default to morning if requested before 13:00, otherwise evening
          const now = new Date();
          const period = now.getHours() < 13 ? 'morning' : 'evening';
          const periodHeb = period === 'morning' ? 'בוקר' : 'ערב';

          let presentList = [];
          let missingList = [];

          activeWhitelist.forEach(soldier => {
            const record = attendanceMap.get(soldier.name);
            const status = record ? record[period] : null;

            if (status === 'present') {
              presentList.push({
                name: soldier.name,
                team: soldier.team || 'תקשוב'
              });
            } else {
              missingList.push({
                name: soldier.name,
                team: soldier.team || 'תקשוב',
                statusLabel: getStatusLabel(status)
              });
            }
          });

          // Group present by team
          const groupedPresent = {};
          presentList.forEach(p => {
            if (!groupedPresent[p.team]) groupedPresent[p.team] = [];
            groupedPresent[p.team].push(p);
          });

          // Group missing by team
          const groupedMissing = {};
          missingList.forEach(m => {
            if (!groupedMissing[m.team]) groupedMissing[m.team] = [];
            groupedMissing[m.team].push(m);
          });

          let replyMsg = `📋 *סטטוס נוכחות - מסדר ${periodHeb} (${today.split('-').reverse().join('.')})*\n\n`;
          replyMsg += `דיווחו נוכחות: ${presentList.length} מתוך ${activeWhitelist.length} חיילים.\n\n`;

          // 1. Present List
          if (presentList.length > 0) {
            replyMsg += `🟢 *דיווחו נוכחות (נוכחים):*`;
            Object.keys(groupedPresent).forEach(team => {
              replyMsg += `\n\n*צוות ${team}:*`;
              groupedPresent[team].forEach(soldier => {
                replyMsg += `\n- ${soldier.name}`;
              });
            });
            replyMsg += `\n\n`;
          }

          // 2. Missing List
          if (missingList.length > 0) {
            replyMsg += `⚠️ *רשימת חוסרים/לא דיווחו:*`;
            Object.keys(groupedMissing).forEach(team => {
              replyMsg += `\n\n*צוות ${team}:*`;
              groupedMissing[team].forEach(soldier => {
                replyMsg += `\n- ${soldier.name} (${soldier.statusLabel})`;
              });
            });
          } else {
            replyMsg += `✅ כל החיילים דיווחו נוכחות!`;
          }

          await sock.sendMessage(from, { text: replyMsg });
        } catch (err) {
          console.error('Error fetching attendance status for command:', err);
          await sock.sendMessage(from, { text: '❌ שגיאה בקבלת נתוני נוכחות ממאגר הנתונים.' });
        }
      }
    } catch (err) {
      console.error('CRITICAL ERROR in messages.upsert handler:', err);
    }
  });
}

// Helper: check if a meeting is active today
function isMeetingActiveToday(meeting, todayStr, dayOfWeek) {
  if (!meeting || meeting.status !== 'active') return false;
  if (meeting.date === todayStr) return true;
  if (meeting.isRecurring) {
    if (meeting.recurringDay !== undefined && meeting.recurringDay !== null && meeting.recurringDay !== '') {
      return Number(meeting.recurringDay) === dayOfWeek;
    }
    return true; // daily recurring
  }
  return false;
}

// ==========================================
// 7. Automated Reminders & Report Checks
// ==========================================
async function runPeriodicCheck() {
  if (!sock) return;

  try {
    const today = getTodayDateStr();
    const now = new Date();
    const currentHours = now.getHours();
    const currentMins = now.getMinutes();
    const todayDayOfWeek = now.getDay(); // 0-6

    // 1. Group Reminder for Tomorrow's Morning Roll Call (sent at 22:30 today)
    if (currentHours === 22 && currentMins === 30) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = getTodayDateStrForDate(tomorrow);
      const tomorrowDayOfWeek = tomorrow.getDay();
      
      const tomorrowMeetings = activeMeetings.filter(m => isMeetingActiveToday(m, tomorrowStr, tomorrowDayOfWeek));
      const morningMeeting = tomorrowMeetings.find(m => m.id === 'meeting_morning');
      
      if (morningMeeting) {
        const morningKey = `${tomorrowStr}_${morningMeeting.id}_group_reminder`;
        if (!sentNotifications.has(morningKey)) {
          const groupJid = await getGroupJid();
          if (groupJid) {
            const msg = `מחר מסדר דגל בשעה ${morningMeeting.time}`;
            await sock.sendMessage(groupJid, { text: msg });
            sentNotifications.add(morningKey);
            await logActivity('reminder', `🔔 נשלחה תזכורת לקבוצה למסדר הבוקר של מחר: ${morningMeeting.time}`);
          }
        }
      }
    }

    // 2. Weekly Schedule (sent on Sundays at 12:00)
    if (todayDayOfWeek === 0 && currentHours === 12 && currentMins === 0) {
      const scheduleKey = `${today}_weekly_schedule`;
      if (!sentNotifications.has(scheduleKey)) {
        const groupJid = await getGroupJid();
        if (groupJid) {
          const msg = `*לוז שבועי*☺️\n\n` +
            `*יום ראשון*\n` +
            `16:00 ח חזרה מהבית \n` +
            `19:30 ח בין המגורים מסדר ערב\n` +
            `1:00 *החרגה בגגש*   \n\n` +
            `*יום שני*🧡\n` +
            `8:30  מסדר דגל🇮🇱\n` +
            `9:00 מסדר נקיון במגורים \n` +
            `9:15 הגעה למחלקות\n` +
            `12:30 ארוחת צהריים\n` +
            `18:30 ארוחת ערב\n` +
            `19:30 ח סגירת פלסם \n\n` +
            `*יום שלישי*❤️\n` +
            `8:00 מסדר דגל 🇮🇱\n` +
            `8:30 בדיקת מסדר בחדרים *עם שטיפה*\n` +
            `9:00 פיזור למחלקות\n` +
            `12:30 ארוחת צהרים\n` +
            `18:30 ארוחת ערב \n` +
            `19:30 ח סגירת פלסם\n` +
            `00:00 גגש\n\n\n` +
            `*יום רביעי*🖤\n` +
            `8:00 מסדר דגל🇮🇱\n` +
            `8:30 בדיקת מסדר בחדרים *עם שטיפה*\n` +
            `9:00 פיזור למחלקות\n` +
            `12:30 ארוחת צהריים \n` +
            `18:30 ארוחת ערב\n` +
            `19:30 ח סגירת פלסמ \n\n\n` +
            `*יום חמישי*\n` +
            `8:00 מסדר דגל 🇮🇱 \n` +
            `8:30 בדיקת מסדר בחדרים *עם שטיפה*\n` +
            `9:00 פיזור למחלקות \n` +
            `10:00 תדרצ \n` +
            `10:30 יציאה לבית בהסעות`;
          
          await sock.sendMessage(groupJid, { text: msg });
          sentNotifications.add(scheduleKey);
          console.log(`Sent weekly schedule reminder to group.`);
          await logActivity('reminder', `📅 נשלח לו"ז שבועי אוטומטי לקבוצת החיילים`);
        }
      }
    }

    // Filter active meetings for today
    const meetingsToday = activeMeetings.filter(m => isMeetingActiveToday(m, today, todayDayOfWeek));

    for (const meeting of meetingsToday) {
      const [mHours, mMinutes] = meeting.time.split(':').map(Number);
      
      // Calculate difference in minutes between meeting scheduled time and current time
      const meetingTimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), mHours, mMinutes).getTime();
      const diffMins = Math.round((meetingTimeMs - now.getTime()) / 1000 / 60);

      // A. 10 minutes before meeting (between 8 and 10 minutes before, to handle interval skew)
      const reminderKey = `${today}_${meeting.id}_reminder`;
      if (diffMins <= 10 && diffMins >= 8 && !sentNotifications.has(reminderKey)) {
        if (meeting.id === 'meeting_morning') {
          // Send duties to Tamar privately
          const tamarJid = getTamarJid();
          if (tamarJid) {
            const dutiesSnap = await db.collection('duties').doc(today).get();
            let toiletTeam = 'טרם שובץ';
            let showerTeam = 'טרם שובץ';
            
            if (dutiesSnap.exists) {
              const dutiesData = dutiesSnap.data();
              toiletTeam = dutiesData.toilets || 'טרם שובץ';
              showerTeam = dutiesData.showers || 'טרם שובץ';
            }
            
            const dutiesMsg = `📋 *תורנויות להיום (${today}):*\n` +
              `🚽 שירותים: צוות *${toiletTeam}*\n` +
              `🧼 מקלחות: צוות *${showerTeam}*`;
            
            await sock.sendMessage(tamarJid, { text: dutiesMsg });
            sentNotifications.add(reminderKey);
            await logActivity('report', `📋 נשלחו תורנויות היום לתמר לקראת מסדר הבוקר`);
          } else {
            console.warn(`Could not resolve Tamar's JID to send duties reminder.`);
          }
        } else {
          // Send standard reminder to Group
          const groupJid = await getGroupJid();
          if (groupJid) {
            let msg = '';
            if (meeting.reminderTemplate) {
              // Get today's duties for placeholders
              const dutiesSnap = await db.collection('duties').doc(today).get();
              let toiletTeam = 'טרם שובץ';
              let showerTeam = 'טרם שובץ';
              if (dutiesSnap.exists) {
                const dutiesData = dutiesSnap.data();
                toiletTeam = dutiesData.toilets || 'טרם שובץ';
                showerTeam = dutiesData.showers || 'טרם שובץ';
              }
              msg = meeting.reminderTemplate
                .replace(/{title}/g, meeting.title)
                .replace(/{time}/g, meeting.time)
                .replace(/{toilets}/g, toiletTeam)
                .replace(/{showers}/g, showerTeam);
            } else if (meeting.id === 'meeting_evening') {
              msg = `מזכירה מסדר ערב ב${meeting.time}`;
            } else {
              msg = `מזכירה ${meeting.title} ב${meeting.time}`;
            }
            
            await sock.sendMessage(groupJid, { text: msg });
            sentNotifications.add(reminderKey);
            console.log(`Sent meeting group reminder for: ${meeting.title}`);
            await logActivity('reminder', `🔔 נשלחה תזכורת לקבוצה למסדר: ${meeting.title}`);
          } else {
            console.warn(`Could not find group JID for reminder, group name: "${GROUP_NAME}"`);
          }
        }
      }

      // B. Tamar Report: 5 minutes after meeting (between -5 and -7 minutes)
      const summaryKey = `${today}_${meeting.id}_summary`;
      if (diffMins <= -5 && diffMins >= -7 && !sentNotifications.has(summaryKey)) {
        const tamarJid = getTamarJid();
        if (tamarJid) {
          const attendanceSnap = await db.collection('attendance')
            .where('date', '==', today)
            .get();

          const attendanceMap = new Map();
          attendanceSnap.forEach(doc => {
            attendanceMap.set(doc.data().name, doc.data());
          });

          // Determine period
          const period = (meeting.id === 'meeting_evening' || meeting.title.includes('ערב') || mHours >= 12) ? 'evening' : 'morning';

          let presentCount = 0;
          let missingList = [];

          activeWhitelist.forEach(soldier => {
            const record = attendanceMap.get(soldier.name);
            const status = record ? record[period] : null;

            if (status === 'present') {
              presentCount++;
            } else {
              missingList.push({
                name: soldier.name,
                team: soldier.team || 'תקשוב',
                statusLabel: getStatusLabel(status)
              });
            }
          });

          const groupedMissing = {};
          missingList.forEach(m => {
            if (!groupedMissing[m.team]) groupedMissing[m.team] = [];
            groupedMissing[m.team].push(m);
          });

          let summaryMsg = `📋 *דו"ח חוסרים - ${meeting.title} (${meeting.time})*\n\n`;
          summaryMsg += `דיווחו נוכחות: ${presentCount} מתוך ${activeWhitelist.length} חיילים.\n\n`;

          if (missingList.length > 0) {
            summaryMsg += `⚠️ *לא הגיעו / לא דיווחו:*`;
            Object.keys(groupedMissing).forEach(team => {
              summaryMsg += `\n\n*צוות ${team}:*`;
              groupedMissing[team].forEach(soldier => {
                summaryMsg += `\n- ${soldier.name} (${soldier.statusLabel})`;
              });
            });
          } else {
            summaryMsg += `✅ כל החיילים דיווחו נוכחות!`;
          }

          await sock.sendMessage(tamarJid, { text: summaryMsg });
          sentNotifications.add(summaryKey);
          console.log(`Sent missing soldiers summary to Tamar for: ${meeting.title}`);
          await logActivity('report', `📋 נשלח דוח חוסרים לתמר למסדר: ${meeting.title}`);
        } else {
          console.warn(`Could not resolve Tamar's JID to send report.`);
        }
      }
    }
  } catch (err) {
    console.error('Error in runPeriodicCheck:', err);
  }
}

// Check every 60 seconds
setInterval(runPeriodicCheck, 60000);

// Clean up sent notifications cache daily at midnight local time
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    sentNotifications.clear();
    console.log('Cleared sent notifications cache for the new day.');
  }
}, 60000);


// Start the connection
connectToWhatsApp();
