const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Initialize Firebase Admin lazily
let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  try {
    const admin = require('firebase-admin');

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.log('[Notifications] Firebase env vars not set, push will be skipped');
      return null;
    }

    if (admin.apps.length > 0) {
      firebaseApp = admin.app();
    } else {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    console.log('[Notifications] Firebase Admin initialized');
    return firebaseApp;
  } catch (err) {
    console.error('[Notifications] Firebase init error:', err.message);
    return null;
  }
}

// POST /api/notifications/register - register device token in MongoDB
router.post('/register', async (req, res) => {
  try {
    const { token, enabled } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const db = getDB();
    await db.collection('push_tokens').updateOne(
      { token },
      { $set: { token, enabled: enabled !== false, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`[Notifications] Token registered in DB`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Register error:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// POST /api/notifications/unregister - remove device token
router.post('/unregister', async (req, res) => {
  try {
    const { token } = req.body;
    const db = getDB();
    if (token) await db.collection('push_tokens').deleteOne({ token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// GET /api/notifications/tokens - list registered tokens (for debugging)
router.get('/tokens', async (req, res) => {
  try {
    const db = getDB();
    const tokens = await db.collection('push_tokens').find({}).toArray();
    res.json({ count: tokens.length, tokens: tokens.map(t => ({ token: t.token.slice(0, 20) + '...', enabled: t.enabled })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/test - send a test push notification
router.get('/test', async (req, res) => {
  try {
    const debugInfo = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'SET' : 'NOT SET',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? `SET (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'NOT SET',
    };

    let db;
    try {
      db = getDB();
    } catch (e) {
      return res.json({ ...debugInfo, error: 'DB not connected: ' + e.message });
    }

    const tokens = await db.collection('push_tokens').find({ enabled: true }).toArray();
    debugInfo.enabledTokens = tokens.length;

    if (tokens.length === 0) {
      return res.json({ ...debugInfo, error: 'No enabled tokens in DB' });
    }

    const app = getFirebaseApp();
    if (!app) {
      return res.json({ ...debugInfo, error: 'Firebase not initialized. Check env vars.' });
    }

    debugInfo.firebaseInitialized = true;

    const admin = require('firebase-admin');
    const messaging = admin.messaging();

    const token = tokens[0].token;
    debugInfo.sendingTo = token.slice(0, 30) + '...';

    try {
      const message = {
        token,
        notification: { title: 'Test Notification', body: 'Debug test from server' },
        data: { title: 'Test Notification', body: 'Debug test from server' },
        android: {
          notification: {
            channelId: 'reports',
            priority: 'high',
            sound: 'default',
            icon: 'ic_launcher',
          },
        },
      };

      const response = await messaging.send(message);
      res.json({ ...debugInfo, success: true, response });
    } catch (err) {
      res.json({ ...debugInfo, success: false, error: err.message, code: err.code });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send FCM push notification using HTTP v1 API via firebase-admin
async function sendPushNotification(title, body) {
  let db;
  try {
    db = getDB();
  } catch (e) {
    console.log('[Notifications] DB not connected, skipping push');
    return;
  }

  const tokens = await db.collection('push_tokens').find({ enabled: true }).toArray();
  const enabledTokens = tokens.map(t => t.token);

  if (enabledTokens.length === 0) {
    console.log('[Notifications] No enabled tokens in DB, skipping push');
    return;
  }

  const app = getFirebaseApp();
  if (!app) {
    console.log('[Notifications] Firebase not initialized, skipping push');
    return;
  }

  const admin = require('firebase-admin');
  const messaging = admin.messaging();

  console.log(`[Notifications] Sending push to ${enabledTokens.length} device(s)`);

  const promises = enabledTokens.map(async (token) => {
    try {
      const message = {
        token,
        notification: { title, body },
        data: { title, body },
        android: {
          notification: {
            channelId: 'reports',
            priority: 'high',
            sound: 'default',
            icon: 'ic_launcher',
          },
        },
      };

      const response = await messaging.send(message);
      console.log(`[Notifications] Sent to ${token.slice(0, 20)}...:`, response);
      return { token, success: true };
    } catch (err) {
      console.error(`[Notifications] Failed for token ${token.slice(0, 20)}...:`, err.message);
      if (err.code === 'messaging/registration-token-not-registered' ||
          err.message.includes('NotRegistered') ||
          err.message.includes('invalid-registration-token')) {
        await db.collection('push_tokens').deleteOne({ token });
        console.log(`[Notifications] Removed invalid token`);
      }
      return { token, success: false, error: err.message };
    }
  });

  await Promise.all(promises);
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
