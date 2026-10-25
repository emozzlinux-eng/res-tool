/**
 * Device feedback helpers: haptics, system sounds and notifications.
 * Every function is a safe no-op on platforms that lack the capability.
 */

/** Trigger a short haptic tick on supporting devices (safe no-op elsewhere). */
export const vibrate = (ms: number | number[] = 12): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
};

/**
 * Play the platform's built-in light notification sound (iOS/Android webviews
 * and some desktop browsers). Silent no-op where unsupported. Used as an
 * audible companion to low-stock alerts.
 */
export const playBeep = (): void => {
  try {
    if ('audio' in window && typeof (window as unknown as { audio: unknown }).audio === 'function') {
      (window as unknown as { audio: (s: string) => void }).audio('notification');
    }
  } catch {
    /* ignore */
  }
};

/**
 * Show an in-app system-style alert banner for critical stock warnings.
 * Uses the Notification API when permission was granted; otherwise callers
 * fall back to toasts/banners inside the app UI.
 */
export const showSystemNotification = async (title: string, body: string): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    await navigator.serviceWorker?.ready;
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'inventory-pro' });
    return true;
  } catch {
    return false;
  }
};

export const notificationsSupported = (): boolean =>
  'Notification' in window && Notification.permission !== 'denied';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};
