import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../api';

export function isMobileApp() {
  return Capacitor.isNativePlatform();
}

// Initialize push notifications on mobile
export async function initPushNotifications() {
  if (!isMobileApp()) return;

  try {
    // Request permission
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }

    // Register for push
    await PushNotifications.register();

    // Listen for registration token
    PushNotifications.addListener('registration', (token) => {
      console.log('[Push] Token received:', token.value);
      // Send token to server
      sendTokenToServer(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    // Handle foreground notifications
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received in foreground:', notification);
      // Show in-app notification banner
      showInAppNotification(notification.title, notification.body);
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped:', action);
      // Navigate to reports page
      window.location.hash = '#/reports';
    });
  } catch (err) {
    console.error('[Push] Init error:', err);
  }
}

// Send FCM token to server
async function sendTokenToServer(token) {
  try {
    const notificationSetting = localStorage.getItem('notifications_enabled');
    const enabled = notificationSetting === null ? true : notificationSetting === 'true';
    await fetch('https://patholabpro.online/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, enabled }),
    });
    console.log('[Push] Token sent to server');
  } catch (err) {
    console.error('[Push] Failed to send token:', err);
  }
}

// Update notification preference on server
export async function updateNotificationPreference(enabled) {
  if (!isMobileApp()) return;
  localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
  // Token will be re-sent on next app launch, but also try to update now
  try {
    const tokenResult = await PushNotifications.getToken();
    if (tokenResult.value) {
      await fetch('https://patholabpro.online/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResult.value, enabled }),
      });
    }
  } catch (err) {
    console.error('[Push] Failed to update preference:', err);
  }
}

// Show in-app notification banner (foreground)
function showInAppNotification(title, body) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #2563eb; color: white; padding: 12px 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: flex; align-items: center; gap: 8px;
    animation: slideDown 0.3s ease-out;
  `;
  banner.innerHTML = `
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 13px;">${title || 'New Report'}</div>
      <div style="font-size: 12px; opacity: 0.9;">${body || ''}</div>
    </div>
    <div style="cursor: pointer; padding: 4px 8px; font-size: 18px; opacity: 0.7;" onclick="this.parentElement.remove()">×</div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => {
    if (banner.parentElement) banner.remove();
  }, 5000);

  // Add slide animation
  const style = document.createElement('style');
  style.textContent = `@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`;
  document.head.appendChild(style);
}
