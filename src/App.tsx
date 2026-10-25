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
  const {
    state,
    setState,
    updateState,
    showToast,
    toast,
    isOnline,
    currentPage,
    setCurrentPage,
  } = useAppState();

  const [isLocked, setIsLocked] = React.useState(true);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [pinSetupStep, setPinSetupStep] = React.useState<'setup' | 'confirm'>('setup');
  const [tempPin, setTempPin] = React.useState('');
  const lastActivity = useRef(Date.now());

  // Auto-lock
  useEffect(() => {
    const checkInactivity = () => {
      if (Date.now() - lastActivity.current > state.autoLockMinutes * 60 * 1000) {
        if (state.pin && !showOnboarding) {
          setIsLocked(true);
        }
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

  // Check if first launch
  useEffect(() => {
    if (!state.onboardingSeen) {
      setShowOnboarding(true);
      setIsLocked(false);
    } else if (!state.pin) {
      setShowOnboarding(false);
      setIsLocked(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isLocked || showOnboarding) return;
      if (e.key === 'o') setCurrentPage('manage');
      if (e.key === 'w') setCurrentPage('manage');
      if (e.key === 'r') setCurrentPage('restock');
      if (e.key === 'Escape') setCurrentPage('home');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLocked, showOnboarding, setCurrentPage]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setPinSetupStep('setup');
    setIsLocked(true);
  };

  const handlePinSetupComplete = (pin: string) => {
    if (pinSetupStep === 'setup') {
      setTempPin(pin);
      setPinSetupStep('confirm');
    } else {
      if (pin === tempPin) {
        updateState({ pin: hashPin(pin), onboardingSeen: true });
        setIsLocked(false);
        showToast('PIN set! Welcome to Inventory Pro');
      } else {
        showToast('PINs do not match. Try again.');
        setPinSetupStep('setup');
      }
    }
  };

  const handlePinVerify = () => {
    setIsLocked(false);
  };

  const contextValue = React.useMemo(() => ({
    state,
    setState,
    updateState,
    showToast,
    isOnline,
    currentPage,
    setCurrentPage,
  }), [state, setState, updateState, showToast, isOnline, currentPage, setCurrentPage]);

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
