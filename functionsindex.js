// functions/index.js
const admin = require("firebase-admin");
admin.initializeApp();

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

// Invia push a tutti i partecipanti del thread tranne il mittente
exports.onNewChatMessage = onDocumentCreated("threads/{driverUid}/messages/{msgId}", async (event) => {
  const snap = event.data;                // Firestore DocumentSnapshot
  const { driverUid, msgId } = event.params;
  const m = snap.data();
  const senderUid = m?.sender || "(unknown)";

  logger.info("🔔 Nuovo messaggio", { driverUid, msgId, senderUid, text: m?.text || "" });

  // 1) Leggo il thread per trovare i partecipanti
  const threadRef = admin.firestore().doc(`threads/${driverUid}`);
  const threadSnap = await threadRef.get();
  const participants = threadSnap.exists ? (threadSnap.get("participants") || []) : [];

  // Fallback: se non c'è participants, notifico comunque il driverUid
  const targets = (participants.length ? participants : [driverUid]).filter(uid => uid && uid !== senderUid);
  if (!targets.length) { logger.info("Nessun destinatario (solo mittente)"); return; }

  // 2) Raccolgo i token
  const tokenSet = new Set();
  for (const uid of targets) {
    const u = await admin.firestore().doc(`users/${uid}`).get();
    const map = u.get("fcmTokens") || {};
    Object.keys(map).forEach(t => tokenSet.add(t));
  }
  const tokens = [...tokenSet];
  if (!tokens.length) { logger.warn("Nessun token trovato per i destinatari", { targets }); return; }

  // 3) Invio push
  const msgBody = (m?.text || "").slice(0, 200);
  // IMPORTANTE: fcm_options.link richiede URL assoluto HTTPS
  const APP_BASE = "https://archivio-clienti-trasporti.web.app";
  const chatUrl = `${APP_BASE}/chat.html?uid=${driverUid}`;

  const payload = {
    notification: {
      title: "💬 Nuovo messaggio",
      body: msgBody
    },
    data: {
      // I valori nel campo data devono essere stringhe
      url: chatUrl,
      driverUid: String(driverUid)
    },
    // Opzioni specifiche per web push (Chrome Android / PWA)
    webpush: {
      headers: {
        Urgency: "high"   // forza consegna immediata anche in Doze mode
      },
      notification: {
        title: "💬 Nuovo messaggio",
        body: msgBody,
        icon: "/icon192.png",
        badge: "/icon192.png",
        tag: "chat-message",
        requireInteraction: false,
        silent: false
      },
      fcm_options: {
        link: chatUrl    // URL assoluto HTTPS obbligatorio
      }
    },
    // Alta priorità per Android
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "chat",
        priority: "high",
        defaultSound: true
      }
    },
    // Alta priorità per Apple (APNS) - iOS PWA 16.4+
    apns: {
      headers: {
        "apns-priority": "10"
      },
      payload: {
        aps: {
          sound: "default",
          badge: 1
        }
      }
    }
  };

  const res = await admin.messaging().sendEachForMulticast({ tokens, ...payload });
  logger.info("Push inviate", { successCount: res.successCount, failureCount: res.failureCount });

  // 4) Pulizia token invalidi
  const invalid = [];
  res.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
  if (invalid.length) {
    logger.warn("Token invalidi, li rimuovo", { invalidCount: invalid.length });
    const batch = admin.firestore().batch();
    const usersColl = await admin.firestore().collection("users").get();
    usersColl.forEach(docSnap => {
      const updates = {};
      invalid.forEach(t => { if (docSnap.get(`fcmTokens.${t}`)) updates[`fcmTokens.${t}`] = admin.firestore.FieldValue.delete(); });
      if (Object.keys(updates).length) batch.update(docSnap.ref, updates);
    });
    await batch.commit();
  }
});
