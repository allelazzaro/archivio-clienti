// functions/index.js - OTTIMIZZATO
const admin = require("firebase-admin");
admin.initializeApp();

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

// ========== GESTIONE CONTATORI AGGREGATI ==========
// Mantiene un documento aggregato per ogni utente con tutti i suoi non letti
exports.updateUnreadCounters = onDocumentCreated("threads/{threadId}/messages/{msgId}", async (event) => {
  const snap = event.data;
  const { threadId, msgId } = event.params;
  const message = snap.data();
  const senderUid = message?.sender || null;
  
  if (!senderUid) {
    logger.warn("Messaggio senza sender", { threadId, msgId });
    return;
  }
  
  logger.info("📊 Aggiorno contatori per nuovo messaggio", { threadId, msgId, senderUid });
  
  // Recupera info del thread
  const threadRef = admin.firestore().doc(`threads/${threadId}`);
  const threadSnap = await threadRef.get();
  
  if (!threadSnap.exists) {
    logger.warn("Thread non trovato", { threadId });
    return;
  }
  
  const threadData = threadSnap.data();
  const participants = threadData.participants || [threadId]; // Default al threadId se non ci sono participants
  
  // Aggiorna contatori per tutti i partecipanti tranne il mittente
  const batch = admin.firestore().batch();
  const targets = participants.filter(uid => uid && uid !== senderUid);
  
  for (const targetUid of targets) {
    // Crea/aggiorna documento contatori aggregati
    const counterRef = admin.firestore().doc(`users/${targetUid}/counters/unread`);
    
    // Incrementa contatore per questo thread
    batch.set(counterRef, {
      [`threads.${threadId}`]: admin.firestore.FieldValue.increment(1),
      total: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  
  await batch.commit();
  logger.info("Contatori aggiornati per", { targets });
});

// ========== RESET CONTATORI QUANDO LETTO ==========
exports.resetUnreadOnRead = onDocumentUpdated("threads/{threadId}/messages/{msgId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { threadId, msgId } = event.params;
  
  const readByBefore = Array.isArray(before?.readBy) ? before.readBy : [];
  const readByAfter = Array.isArray(after?.readBy) ? after.readBy : [];
  
  // Trova chi ha appena letto il messaggio
  const newReaders = readByAfter.filter(uid => !readByBefore.includes(uid));
  
  if (newReaders.length === 0) return;
  
  logger.info("🔄 Reset contatori per lettori", { threadId, msgId, newReaders });
  
  // Per ogni nuovo lettore, ricalcola i non letti per questo thread
  for (const readerUid of newReaders) {
    // Conta quanti messaggi non letti rimangono
    const unreadQuery = admin.firestore()
      .collection(`threads/${threadId}/messages`)
      .where("sender", "!=", readerUid);
    
    const unreadSnap = await unreadQuery.get();
    let unreadCount = 0;
    
    unreadSnap.forEach(doc => {
      const msg = doc.data();
      const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
      if (!readBy.includes(readerUid)) {
        unreadCount++;
      }
    });
    
    // Aggiorna il contatore aggregato
    const counterRef = admin.firestore().doc(`users/${readerUid}/counters/unread`);
    const counterSnap = await counterRef.get();
    
    if (counterSnap.exists) {
      const currentData = counterSnap.data();
      const oldThreadCount = currentData.threads?.[threadId] || 0;
      const totalDiff = unreadCount - oldThreadCount;
      
      await counterRef.update({
        [`threads.${threadId}`]: unreadCount,
        total: admin.firestore.FieldValue.increment(totalDiff),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
});

// ========== NOTIFICHE PUSH OTTIMIZZATE ==========
exports.onNewChatMessage = onDocumentCreated("threads/{driverUid}/messages/{msgId}", async (event) => {
  const snap = event.data;
  const { driverUid, msgId } = event.params;
  const m = snap.data();
  const senderUid = m?.sender || "(unknown)";

  logger.info("🔔 Nuovo messaggio per notifica", { driverUid, msgId, senderUid, text: m?.text || "" });

  // 1) Leggo il thread per trovare i partecipanti
  const threadRef = admin.firestore().doc(`threads/${driverUid}`);
  const threadSnap = await threadRef.get();
  const participants = threadSnap.exists ? (threadSnap.get("participants") || []) : [];

  // Fallback: se non c'è participants, notifico comunque il driverUid
  const targets = (participants.length ? participants : [driverUid]).filter(uid => uid && uid !== senderUid);
  if (!targets.length) { 
    logger.info("Nessun destinatario (solo mittente)"); 
    return; 
  }

  // 2) Raccolgo i token FCM
  const tokenSet = new Set();
  const tokenToUser = new Map(); // Per tracciare quale token appartiene a quale user
  
  for (const uid of targets) {
    const userDoc = await admin.firestore().doc(`users/${uid}`).get();
    const fcmTokens = userDoc.get("fcmTokens") || {};
    
    Object.keys(fcmTokens).forEach(token => {
      tokenSet.add(token);
      tokenToUser.set(token, uid);
    });
  }
  
  const tokens = [...tokenSet];
  if (!tokens.length) { 
    logger.warn("Nessun token FCM trovato", { targets }); 
    return; 
  }

  // 3) Prepara notifica con info sui non letti
  const senderDoc = await admin.firestore().doc(`users/${senderUid}`).get();
  const senderName = senderDoc.exists ? 
    (senderDoc.get("nome") || senderDoc.get("email") || "Driver") : "Driver";
  
  const payload = {
    notification: { 
      title: `💬 ${senderName}`, 
      body: m?.text || "Nuovo messaggio" 
    },
    data: { 
      url: `/chat.html?uid=${driverUid}`,
      threadId: driverUid,
      messageId: msgId,
      timestamp: Date.now().toString()
    }
  };

  // 4) Invia notifiche
  const res = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
  logger.info("Push inviate", { 
    successCount: res.successCount, 
    failureCount: res.failureCount,
    totalTokens: tokens.length 
  });

  // 5) Pulizia token invalidi
  const invalid = [];
  const invalidUserIds = new Set();
  
  res.responses.forEach((response, idx) => { 
    if (!response.success) {
      const token = tokens[idx];
      invalid.push(token);
      const userId = tokenToUser.get(token);
      if (userId) invalidUserIds.add(userId);
    }
  });
  
  if (invalid.length) {
    logger.warn("Rimuovo token invalidi", { 
      invalidCount: invalid.length,
      affectedUsers: [...invalidUserIds] 
    });
    
    const batch = admin.firestore().batch();
    
    // Rimuovi solo dai documenti degli utenti affetti
    for (const userId of invalidUserIds) {
      const userRef = admin.firestore().doc(`users/${userId}`);
      const updates = {};
      
      invalid.forEach(token => {
        if (tokenToUser.get(token) === userId) {
          updates[`fcmTokens.${token}`] = admin.firestore.FieldValue.delete();
        }
      });
      
      if (Object.keys(updates).length > 0) {
        batch.update(userRef, updates);
      }
    }
    
    await batch.commit();
    logger.info("Token invalidi rimossi");
  }
});

// ========== PULIZIA PERIODICA DEI CONTATORI ==========
// Opzionale: Cloud Function schedulata per pulire contatori vecchi
exports.cleanupOldCounters = require("firebase-functions").pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    logger.info("🧹 Pulizia contatori vecchi");
    
    const usersSnap = await admin.firestore().collection("users").get();
    const batch = admin.firestore().batch();
    let cleaned = 0;
    
    for (const userDoc of usersSnap.docs) {
      const counterRef = admin.firestore()
        .doc(`users/${userDoc.id}/counters/unread`);
      const counterSnap = await counterRef.get();
      
      if (!counterSnap.exists) continue;
      
      const data = counterSnap.data();
      const threads = data.threads || {};
      let hasChanges = false;
      const cleanedThreads = {};
      
      // Rimuovi thread con 0 non letti
      for (const [threadId, count] of Object.entries(threads)) {
        if (count > 0) {
          cleanedThreads[threadId] = count;
        } else {
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        batch.set(counterRef, {
          threads: cleanedThreads,
          total: Object.values(cleanedThreads).reduce((sum, n) => sum + n, 0),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      await batch.commit();
      logger.info(`Puliti contatori per ${cleaned} utenti`);
    }
    
    return null;
  });

// ========== INFO DIAGNOSTICHE ==========
exports.getDiagnostics = require("firebase-functions").https.onRequest(async (req, res) => {
  // Solo per admin - aggiungi autenticazione in produzione!
  
  try {
    const stats = {
      threads: 0,
      messages: 0,
      users: 0,
      tokens: 0,
      counters: {}
    };
    
    // Conta threads
    const threadsSnap = await admin.firestore().collection("threads").get();
    stats.threads = threadsSnap.size;
    
    // Conta messaggi totali (sample)
    let msgCount = 0;
    for (const thread of threadsSnap.docs) {
      const msgs = await admin.firestore()
        .collection(`threads/${thread.id}/messages`)
        .count()
        .get();
      msgCount += msgs.data().count;
      if (msgCount > 1000) break; // Limita per performance
    }
    stats.messages = msgCount;
    
    // Conta users e tokens
    const usersSnap = await admin.firestore().collection("users").get();
    stats.users = usersSnap.size;
    
    let tokenCount = 0;
    usersSnap.forEach(doc => {
      const fcmTokens = doc.get("fcmTokens") || {};
      tokenCount += Object.keys(fcmTokens).length;
    });
    stats.tokens = tokenCount;
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Errore diagnostica", error);
    res.status(500).json({ error: error.message });
  }
});
