const express = require('express');
const router = express.Router();

// In-memory token store (resets on each serverless cold start)
let deviceTokens = new Map(); // token -> { enabled: true, registeredAt: Date }

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

// POST /api/notifications/register - register device token
router.post('/register', (req, res) => {
  try {
    const { token, enabled } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    deviceTokens.set(token, { enabled: enabled !== false, registeredAt: new Date() });
    console.log(`[Notifications] Token registered. Total: ${deviceTokens.size}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Register error:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// POST /api/notifications/unregister - remove device token
router.post('/unregister', (req, res) => {
  try {
    const { token } = req.body;
    if (token) deviceTokens.delete(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// GET /api/notifications/tokens - list registered tokens (for debugging)
router.get('/tokens', (req, res) => {
  res.json({ count: deviceTokens.size, tokens: Array.from(deviceTokens.keys()) });
});

// Send FCM push notification using HTTP v1 API via firebase-admin
async function sendPushNotification(title, body) {
  const enabledTokens = Array.from(deviceTokens.entries())
    .filter(([_, info]) => info.enabled)
    .map(([token]) => token);

  if (enabledTokens.length === 0) {
    console.log('[Notifications] No enabled tokens, skipping push');
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
        deviceTokens.delete(token);
        console.log(`[Notifications] Removed invalid token`);
      }
      return { token, success: false, error: err.message };
    }
  });

  await Promise.all(promises);
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
