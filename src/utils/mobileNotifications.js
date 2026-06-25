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
      // Show in-app notification banner with tap action
      showInAppNotification(notification.title, notification.body, notification.data);
    });

    // Handle notification tap (from background/killed)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped:', action);
      const data = action.notification?.data || {};
      handleNotificationTap(data);
    });

    // Check for pending notification tap from cold start
    // (app was killed, user tapped notification which opened the app)
    const pending = localStorage.getItem('pending_notification_tap');
    if (pending) {
      localStorage.removeItem('pending_notification_tap');
      try {
        const data = JSON.parse(pending);
        console.log('[Push] Processing pending notification tap:', data);
        setTimeout(() => handleNotificationTap(data), 2000);
      } catch (e) {
        console.error('[Push] Failed to parse pending tap:', e);
      }
    }
  } catch (err) {
    console.error('[Push] Init error:', err);
  }
}

// Get pending notification tap (for components to check on mount)
export function getPendingNotificationTap() {
  const pending = localStorage.getItem('pending_notification_tap');
  if (pending) {
    localStorage.removeItem('pending_notification_tap');
    try {
      return JSON.parse(pending);
    } catch (e) {
      return null;
    }
  }
  return null;
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

// Handle notification tap - dispatch event to open report preview
function handleNotificationTap(data) {
  // Store in localStorage as fallback for cold start
  localStorage.setItem('pending_notification_tap', JSON.stringify(data));

  if (data.type === 'report' && data.reportId) {
    navigateTo('/reports');
    // Dispatch event with retries - component might not be mounted yet on cold start
    dispatchWithRetry('notification-open-report', { reportId: data.reportId });
  } else if (data.type === 'patient' && data.patientId) {
    navigateTo('/patients');
    dispatchWithRetry('notification-open-patient', { patientId: data.patientId });
  } else {
    navigateTo('/reports');
  }
}

// Dispatch custom event with retries (handles cold start where React isn't ready)
function dispatchWithRetry(eventName, detail, retries = 5) {
  let attempt = 0;
  const dispatch = () => {
    attempt++;
    console.log(`[Push] Dispatching ${eventName} (attempt ${attempt})`);
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    if (attempt < retries) {
      // Also schedule a retry in case component wasn't ready
      setTimeout(() => {
        // Only retry if no one consumed it (check via a flag)
        if (!window.__notifConsumed) {
          window.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
        window.__notifConsumed = false;
      }, attempt * 1000);
    }
  };
  dispatch();
}

// Navigate using BrowserRouter (pushState + popstate)
function navigateTo(path) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

// Show in-app notification banner (foreground) - tappable to open report
function showInAppNotification(title, body, data) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #2563eb; color: white; padding: 12px 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: flex; align-items: center; gap: 8px;
    animation: slideDown 0.3s ease-out;
    cursor: pointer;
  `;
  banner.innerHTML = `
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 13px;">${title || 'New Report'}</div>
      <div style="font-size: 12px; opacity: 0.9;">${body || ''}</div>
    </div>
    <div style="cursor: pointer; padding: 4px 8px; font-size: 18px; opacity: 0.7;" id="notif-close">×</div>
  `;
  
  // Tap on banner (except close button) opens the report
  banner.addEventListener('click', (e) => {
    if (e.target.id === 'notif-close') {
      banner.remove();
    } else {
      banner.remove();
      if (data) handleNotificationTap(data);
    }
  });
  
  document.body.appendChild(banner);
  setTimeout(() => {
    if (banner.parentElement) banner.remove();
  }, 8000);

  // Add slide animation
  const style = document.createElement('style');
  style.textContent = `@keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }`;
  document.head.appendChild(style);
}
