/**
 * Sanitize user input to prevent XSS
 */
export const sanitize = (str: string): string => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
};

/**
 * Hash PIN for secure storage
 */
export const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(36)}_${pin.length}`;
};

/**
 * Verify PIN against stored hash
 */
export const verifyPin = (pin: string, storedHash: string): boolean => {
  if (!storedHash.startsWith('h_')) return false;
  return hashPin(pin) === storedHash;
};

/**
 * Format timestamp to "time ago" string
 */
export const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Get greeting based on time of day
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/**
 * Get formatted date string
 */
export const getFormattedDate = (): string => {
  return new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * Get current time string
 */
export const getCurrentTime = (): string => {
  return new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};
