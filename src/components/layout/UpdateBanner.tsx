import React from 'react';
// Virtual import provided by vite-plugin-pwa (dev mode stubs it out safely).
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Shows a "New version available" toast when the service worker has installed
 * an update and is waiting for clients to close (`registerType: 'prompt'`).
 * We never skipWaiting automatically — reloading mid-session is the user's call.
 */
export const UpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <button
        type="button"
        className="update-banner__reload"
        onClick={() => void updateServiceWorker(true)}
      >
        New version available. Reload ↻
      </button>
    </div>
  );
};
