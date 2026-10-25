import React, { useEffect, useRef } from 'react';
import { AppContext, useAppState } from './hooks/useAppState';
import { hashPin } from './utils/helpers';
import { TopHeader } from './components/layout/TopHeader';
import { BottomNav } from './components/layout/BottomNav';
import { Toast } from './components/ui/Toast';
import { PinScreen } from './components/auth/PinScreen';
import { Onboarding } from './components/auth/Onboarding';
import { HomePage } from './pages/HomePage';
import { ManagePage } from './pages/ManagePage';
import { RestockPage } from './pages/RestockPage';
import { ProfilePage } from './pages/ProfilePage';
import { Page } from './types';

const pageTitles: Record<Page, string> = {
  home: 'Dashboard',
  manage: 'Manage',
  restock: 'Inventory',
  profile: 'Profile',
};

const App: React.FC = () => {
  const app = useAppState();
  const { state, updateState, showToast, toast, isOnline, syncStatus, currentPage, setCurrentPage, setManageMode } = app;

  const [isLocked, setIsLocked] = React.useState(() => Boolean(state.pin));
  const [showOnboarding, setShowOnboarding] = React.useState(() => !state.onboardingSeen);
  const [pinSetupStep, setPinSetupStep] = React.useState<'setup' | 'confirm'>('setup');
  const [tempPin, setTempPin] = React.useState('');
  const lastActivity = useRef(Date.now());

  // Auto-lock after inactivity (0 = never)
  useEffect(() => {
    if (!state.pin || state.autoLockMinutes <= 0) return;
    const checkInactivity = () => {
      if (Date.now() - lastActivity.current > state.autoLockMinutes * 60 * 1000 && !showOnboarding) {
        setIsLocked(true);
      }
    };
    const interval = setInterval(checkInactivity, 10000);
    return () => clearInterval(interval);
  }, [state.autoLockMinutes, state.pin, showOnboarding]);

  // Reset activity timer on interaction
  useEffect(() => {
    const resetTimer = () => { lastActivity.current = Date.now(); };
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  // Keyboard shortcuts (ignored while typing)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isLocked || showOnboarding || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (document.querySelector('.modal-overlay, .bottom-sheet, .pin-overlay')) return;
      if (e.key === 'o') { setManageMode('output'); setCurrentPage('manage'); }
      if (e.key === 'w') { setManageMode('waste'); setCurrentPage('manage'); }
      if (e.key === 'r') { setManageMode('restock'); setCurrentPage('manage'); }
      if (e.key === 'Escape') setCurrentPage('home');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLocked, showOnboarding, setCurrentPage, setManageMode]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setPinSetupStep('setup');
    if (!state.onboardingSeen) updateState({ onboardingSeen: true });
  };

  const handlePinSetupComplete = (pin: string) => {
    if (pinSetupStep === 'setup') {
      setTempPin(pin);
      setPinSetupStep('confirm');
    } else {
      if (pin === tempPin) {
        updateState({ pin: hashPin(pin) });
        setIsLocked(false);
        lastActivity.current = Date.now();
        showToast('PIN set! Welcome to Inventory Pro');
      } else {
        showToast('PINs do not match. Try again.');
        setPinSetupStep('setup');
      }
      setTempPin('');
    }
  };

  const handlePinVerify = () => {
    lastActivity.current = Date.now();
    setIsLocked(false);
  };

  const lock = React.useCallback(() => setIsLocked(true), []);
  const replayTutorial = React.useCallback(() => setShowOnboarding(true), []);

  const { toast: _toast, ...appContext } = app;
  const contextValue = { ...appContext, lock, replayTutorial };

  // Render onboarding
  if (showOnboarding) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-shell">
          <Onboarding onComplete={handleOnboardingComplete} />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  // Render PIN setup (after onboarding, first time)
  if (!state.pin && state.onboardingSeen) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-shell">
          <PinScreen
            key={pinSetupStep}
            mode={pinSetupStep === 'setup' ? 'setup' : 'confirm'}
            onComplete={handlePinSetupComplete}
          />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  // Render lock screen
  if (isLocked && state.pin) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-shell">
          <PinScreen
            mode="verify"
            existingHash={state.pin}
            onComplete={handlePinVerify}
          />
          <Toast message={toast.msg} visible={toast.visible} />
        </div>
      </AppContext.Provider>
    );
  }

  // Main app layout with TopHeader + Page + BottomNav
  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        {/* Top Header */}
        <TopHeader
          title={pageTitles[currentPage]}
          isOnline={isOnline}
          syncStatus={syncStatus}
          onSync={app.syncNow}
        />

        {/* Page Content */}
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'manage' && <ManagePage />}
        {currentPage === 'restock' && <RestockPage />}
        {currentPage === 'profile' && <ProfilePage />}

        {/* Bottom Navigation */}
        <BottomNav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />

        {/* Toast */}
        <Toast message={toast.msg} visible={toast.visible} />
      </div>
    </AppContext.Provider>
  );
};

export default App;
