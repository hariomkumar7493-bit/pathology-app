const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const crypto = require('crypto');

// Initialize Firebase Admin lazily
let firebaseApp = null;
let firebaseInitError = null;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  if (firebaseInitError) return null;

  try {
    const admin = require('firebase-admin');

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      firebaseInitError = 'Missing env vars';
      return null;
    }

    // Handle private key format
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!privateKey.includes('\n')) {
      firebaseInitError = 'Private key has no newlines';
      return null;
    }

    if (admin.apps && admin.apps.length > 0) {
      firebaseApp = admin.app();
    } else {
      const cert = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      });
      firebaseApp = admin.initializeApp({
        credential: cert,
      });
    }

    console.log('[Notifications] Firebase Admin initialized');
    return firebaseApp;
  } catch (err) {
    firebaseInitError = err.message;
    console.error('[Notifications] Firebase init error:', err.message);
    return null;
  }
}

// Create JWT for FCM HTTP v1 API authentication
function createFCMJWT() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return null;

  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const token = `${base64url(header)}.${base64url(payload)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(token);
  const signature = sign.sign(privateKey, 'base64url');

  return `${token}.${signature}`;
}

// Get OAuth2 access token for FCM
let cachedAccessToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedTokenExpiry - 60000) {
    return cachedAccessToken;
  }

  const jwt = createFCMJWT();
  if (!jwt) return null;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (!data.access_token) {
    console.error('[FCM] Token error:', data);
    return null;
  }

  cachedAccessToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedAccessToken;
}

// Send FCM push notification using HTTP v1 API directly
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

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.log('[Notifications] No FIREBASE_PROJECT_ID, skipping push');
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.log('[Notifications] Failed to get access token, skipping push');
    return;
  }

  console.log(`[Notifications] Sending push to ${enabledTokens.length} device(s)`);

  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const promises = enabledTokens.map(async (token) => {
    try {
      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
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
          },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        console.log(`[Notifications] Sent to ${token.slice(0, 20)}...`);
        return { token, success: true };
      } else {
        console.error(`[Notifications] Failed for token ${token.slice(0, 20)}...:`, JSON.stringify(result));
        if (result.error?.details?.[0]?.errorCode === 'UNREGISTERED' ||
            result.error?.status === 'NOT_FOUND') {
          await db.collection('push_tokens').deleteOne({ token });
          console.log(`[Notifications] Removed invalid token`);
        }
        return { token, success: false, error: JSON.stringify(result) };
      }
    } catch (err) {
      console.error(`[Notifications] Push error for token:`, err.message);
      return { token, success: false, error: err.message };
    }
  });

  await Promise.all(promises);
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

    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      return res.json({ ...debugInfo, error: 'No FIREBASE_PROJECT_ID' });
    }

    // Try to get access token
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      return res.json({ ...debugInfo, error: 'Access token failed: ' + e.message });
    }

    if (!accessToken) {
      return res.json({ ...debugInfo, error: 'Failed to get access token. Check FIREBASE_PRIVATE_KEY format.' });
    }

    debugInfo.accessTokenObtained = true;

    const token = tokens[0].token;
    debugInfo.sendingTo = token.slice(0, 30) + '...';

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    try {
      const response = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
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
          },
        }),
      });

      const result = await response.json();
      if (response.ok) {
        res.json({ ...debugInfo, success: true, response: result });
      } else {
        res.json({ ...debugInfo, success: false, statusCode: response.status, error: result });
      }
    } catch (err) {
      res.json({ ...debugInfo, success: false, error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
