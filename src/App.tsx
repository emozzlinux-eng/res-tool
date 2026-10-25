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
import { ShoppingPage } from './pages/ShoppingPage';
import { ProfilePage } from './pages/ProfilePage';
import { Page, DEFAULT_STATE } from './types';

const pageTitles: Record<Page, string> = {
  home: 'Dashboard',
  manage: 'Manage',
  restock: 'Inventory',
  shopping: 'List',
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
  // Change-PIN flow driven from the Profile page
  const [changingPin, setChangingPin] = React.useState(false);
  const [changePinStep, setChangePinStep] = React.useState<'old' | 'new' | 'confirm'>('old');
  const [newPinTemp, setNewPinTemp] = React.useState('');
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

  // Privacy: lock immediately when the tab/window loses focus (optional)
  useEffect(() => {
    if (!state.privacyBlur) return;
    const onHide = () => {
      document
        .querySelector('.page-stage--blurrable')
        ?.classList.toggle('privacy-hidden', document.hidden);
      if (document.hidden && state.pin && !showOnboarding) setIsLocked(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [state.privacyBlur, state.pin, showOnboarding]);

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
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'o') setCurrentPage('manage');
      if (e.key === 'w') setCurrentPage('manage');
      if (e.key === 'r') setCurrentPage('restock');
      if (e.key === 'l') setCurrentPage('shopping');
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

  const handlePinSetupComplete = async (pin: string) => {
    if (pinSetupStep === 'setup') {
      setTempPin(pin);
      setPinSetupStep('confirm');
    } else {
      if (pin === tempPin) {
        updateState({ pin: await hashPin(pin), onboardingSeen: true });
        setIsLocked(false);
        showToast('PIN set! Welcome to Inventory Pro');
      } else {
        showToast('PINs do not match. Try again.');
        setPinSetupStep('setup');
      }
    }
  };

  const handlePinVerify = async (pin: string) => {
    setIsLocked(false);
    lastActivity.current = Date.now();
    // Transparently upgrade legacy weak PIN hashes on successful unlock
    if (state.pin.startsWith('h_')) {
      updateState({ pin: await hashPin(pin) });
      showToast('PIN security upgraded to SHA-256');
    }
  };

  // Panic wipe completed on the PIN screen — return to first-run state
  const handlePanicWipe = () => {
    setState({ ...DEFAULT_STATE });
    setIsLocked(true);
    setShowOnboarding(false);
  };

  // Change-PIN flow (opened from Profile)
  const handleChangePinComplete = async (pin: string) => {
    if (changePinStep === 'old') {
      setChangePinStep('new');
    } else if (changePinStep === 'new') {
      setNewPinTemp(pin);
      setChangePinStep('confirm');
    } else {
      if (pin === newPinTemp) {
        updateState({ pin: await hashPin(pin) });
        showToast('PIN changed successfully');
      } else {
        showToast('PINs do not match. Start again.');
      }
      setChangingPin(false);
      setChangePinStep('old');
      setNewPinTemp('');
    }
  };

  const cancelChangePin = () => {
    setChangingPin(false);
    setChangePinStep('old');
    setNewPinTemp('');
  };

  const lock = React.useCallback(() => setIsLocked(true), []);
  const replayTutorial = React.useCallback(() => setShowOnboarding(true), []);

  const contextValue = React.useMemo(() => ({
    state,
    setState,
    updateState,
    showToast,
    isOnline,
    currentPage,
    setCurrentPage,
    lock,
    replayTutorial,
  }), [state, setState, updateState, showToast, isOnline, currentPage, setCurrentPage, lock, replayTutorial]);

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

  // Change-PIN overlay (from Profile, app stays unlocked behind it)
  if (changingPin) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-shell">
          <div className="relative h-full">
            <PinScreen
              mode={changePinStep === 'old' ? 'change-old' : changePinStep === 'new' ? 'change-new' : 'change-confirm'}
              existingHash={changePinStep === 'old' ? state.pin : undefined}
              onComplete={handleChangePinComplete}
            />
            <button
              onClick={cancelChangePin}
              className="absolute top-4 left-4 text-sm font-medium text-[var(--text-sub)] underline"
            >
              Cancel
            </button>
          </div>
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
            scrambleKeypad={state.scrambleKeypad}
            panicWipeEnabled={state.panicWipeEnabled}
            onPanicWipe={handlePanicWipe}
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
          rightAction={
            <button
              onClick={lock}
              aria-label="Lock now"
              title="Lock now"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-main)] active:scale-95 transition-transform"
            >
              🔒
            </button>
          }
        />

        {/* Page Content (optionally blurred when the window loses focus — shoulder-surfing protection) */}
        <div className={`page-stage ${state.privacyBlur ? 'page-stage--blurrable' : ''}`}>
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'manage' && <ManagePage />}
          {currentPage === 'restock' && <RestockPage />}
          {currentPage === 'shopping' && <ShoppingPage />}
          {currentPage === 'profile' && <ProfilePage onOpenChangePin={() => setChangingPin(true)} />}
        </div>

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
