// functions/index.js
const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
admin.initializeApp();

const ADMIN_UID = "0dCvHDcVp1PHuWVNIN9i6ZvEVBt2";

exports.onNewChatMessage = functions.firestore
  .document("threads/{driverUid}/messages/{msgId}")
  .onCreate(async (snap, ctx) => {
    const m = snap.data();
    const driverUid = ctx.params.driverUid;
    const sender = m.sender;

    const targetUid = (sender === ADMIN_UID) ? driverUid : ADMIN_UID;

    const userDoc = await admin.firestore().doc(`users/${targetUid}`).get();
    const tokensMap = userDoc.get("fcmTokens") || {};
    const tokens = Object.keys(tokensMap);
    if (!tokens.length) return;

    const payload = {
      notification: {
        title: "Nuovo messaggio",
        body: m.text || "",
      },
      data: {
        url: `/chat.html?uid=${driverUid}`
      }
    };

    const res = await admin.messaging().sendEachForMulticast({ tokens, ...payload });

    // pulizia token non validi
    const toDelete = [];
    res.responses.forEach((r, i) => { if (!r.success) toDelete.push(tokens[i]); });
    if (toDelete.length) {
      const updates = {};
      toDelete.forEach(t => updates[`fcmTokens.${t}`] = admin.firestore.FieldValue.delete());
      await admin.firestore().doc(`users/${targetUid}`).update(updates);
    }
  });
