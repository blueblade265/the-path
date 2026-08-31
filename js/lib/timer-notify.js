// Background-tab / app-switched notifications for timer completion — NOT full Web Push.
// Real push needs a server to send a message that wakes the OS regardless of whether the
// browser is even running; this only fires while the page's own JS is still alive
// somewhere, even hidden/backgrounded, via the service worker's showNotification. Mobile
// browsers throttle a hidden tab's JS over time, so this can arrive a bit late if you've
// been away for a while — still a real improvement for the common "switched to texts
// mid-rest" case. Full lock-screen-reliable push is a separate, bigger build (VAPID keys +
// a subscriptions table + a server-side scheduler) — deliberately not this.
//
// Requires a real user gesture to grant (requestNotificationPermission, wired to a button
// in More) — browsers refuse a permission prompt triggered any other way.

export function notificationStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

// Only actually shows anything if permission is granted AND the page isn't currently
// visible — no point interrupting you with a system notification for a timer you're
// already looking at complete on-screen.
export async function notifyTimerDone(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  if (!navigator.serviceWorker) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'the-path-timer',
      renotify: true
    });
  } catch { /* no active SW registration yet — nothing else to fall back to */ }
}
