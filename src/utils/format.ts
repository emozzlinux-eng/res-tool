/**
 * Small display-formatting and date helpers shared across pages.
 */

/** Format timestamp to "time ago" string */
export const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/** Get greeting based on time of day */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/** Get formatted date string, e.g. "Sunday, October 25, 2026" */
export const getFormattedDate = (): string =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/** Get current time string, e.g. "02:30 PM" */
export const getCurrentTime = (): string =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/** Format money with the shop currency symbol, e.g. "$12.50". */
export const fmtMoney = (currency: string, n: number): string =>
  `${currency}${n.toFixed(2)}`;

/** Day key in YYYY-MM-DD local time (spreadsheet & grouping friendly). */
export const dayKey = (d: Date | number): string => new Date(d).toLocaleDateString('en-CA');
