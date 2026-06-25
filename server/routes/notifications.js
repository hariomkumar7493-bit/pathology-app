const express = require('express');
const router = express.Router();

// In-memory token store (resets on each serverless cold start, but good enough for MVP)
// For production, move to database
let deviceTokens = new Map(); // token -> { enabled: true, registeredAt: Date }

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

// Send FCM push notification to all registered devices
// Called internally when a report or patient is created
async function sendPushNotification(title, body) {
  const enabledTokens = Array.from(deviceTokens.entries())
    .filter(([_, info]) => info.enabled)
    .map(([token]) => token);

  if (enabledTokens.length === 0) {
    console.log('[Notifications] No enabled tokens, skipping push');
    return;
  }

  console.log(`[Notifications] Sending push to ${enabledTokens.length} device(s)`);

  // Use FCM legacy API (simple, no OAuth needed)
  // Requires FCM_SERVER_KEY env var
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.log('[Notifications] FCM_SERVER_KEY not set, skipping push');
    return;
  }

  for (const token of enabledTokens) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title,
            body,
            sound: 'default',
            click_action: 'FCM_PLUGIN_ACTIVITY',
            icon: 'ic_launcher',
          },
          data: {
            title,
            body,
          },
          priority: 'high',
        }),
      });
      const result = await response.json();
      if (result.failure > 0) {
        console.log(`[Notifications] Failed for token ${token.slice(0, 20)}...:`, result.results);
        // Remove invalid tokens
        if (result.results && result.results[0] && result.results[0].error === 'NotRegistered') {
          deviceTokens.delete(token);
          console.log(`[Notifications] Removed invalid token`);
        }
      }
    } catch (err) {
      console.error(`[Notifications] Push error for token:`, err.message);
    }
  }
}

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
