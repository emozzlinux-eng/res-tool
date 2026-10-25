import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { AppContext, useAppState } from './hooks/useAppState';
import { hashPin, isLegacyPinHash } from './utils/pin';
import { TopHeader } from './components/layout/TopHeader';
import { UpdateBanner } from './components/layout/UpdateBanner';
import { BottomNav } from './components/layout/BottomNav';
import { Toast } from './components/ui/Toast';
import { PinScreen } from './components/auth/PinScreen';
// The three main tabs are code-split so the initial download only contains
// the shell + PIN/onboarding screens. Each chunk is small and gets cached by
// the service worker after first visit; navigation then feels instant.
const Onboarding = lazy(() => import('./components/auth/Onboarding').then(m => ({ default: m.Onboarding })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ManagePage = lazy(() => import('./pages/ManagePage').then(m => ({ default: m.ManagePage })));
const RestockPage = lazy(() => import('./pages/RestockPage').then(m => ({ default: m.RestockPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
import { Page, DEFAULT_PIN, DEMO_STATE } from './types';

const pageTitles: Record<Page, string> = {
  home: 'Dashboard',
  manage: 'Manage',
  restock: 'Inventory',
  profile: 'Profile',
};

/** Minimal placeholder shown while a lazily-loaded tab chunk arrives. */
const PageFallback = () => (
  <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="status" aria-label="Loading">
    <span style={{ opacity: 0.5, fontSize: 14 }}>Loading…</span>
  </div>
);

const App = () => {
  const {
    state,
    setState,
    updateState,
    showToast,
    toast,
    isOnline,
    currentPage,
    setCurrentPage,
    lastSavedLabel,
  } = useAppState();

  const [isLocked, setIsLocked] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Change-PIN flow driven from the Profile page
  const [changingPin, setChangingPin] = useState(false);
  const [changePinStep, setChangePinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [newPinTemp, setNewPinTemp] = useState('');
  const lastActivity = useRef(Date.now());

  // Auto-lock
  useEffect(() => {
    const checkInactivity = () => {
      if (Date.now() - lastActivity.current > state.autoLockMinutes * 60 * 1000) {
        if (state.pin && state.onboardingSeen && !showOnboarding) {
          setIsLocked(true);
        }
      }
    };
    const interval = setInterval(checkInactivity, 10000);
    return () => clearInterval(interval);
    // onboardingSeen read fresh inside the interval; deps intentionally narrow (rewritten in Phase 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (document.hidden && state.pin && state.onboardingSeen && !showOnboarding) setIsLocked(true);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
    // onboardingSeen read fresh inside the handler; deps intentionally narrow (rewritten in Phase 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.privacyBlur, state.pin, showOnboarding]);

  // Check if first launch
  useEffect(() => {
    if (!state.onboardingSeen) {
      setShowOnboarding(true);
      setIsLocked(false);
    }
    // Runs only on mount to detect first launch; deps intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If PIN was cleared (e.g. Reset All Data), restore the default PIN 000000
  useEffect(() => {
    if (state.onboardingSeen && !state.pin) {
      (async () => {
        updateState({ pin: await hashPin(DEFAULT_PIN) });
        setIsLocked(true);
        showToast('PIN reset to default: 000000');
      })();
    }
    // updateState/showToast are stable refs from the app hook; deps intentionally narrow (rewritten in Phase 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.onboardingSeen, state.pin]);

  // Keyboard shortcuts — desktop nicety only. Escape returns to the dashboard;
  // single-letter page jumps were removed because they fired while typing in
  // search boxes on some Android keyboards (target.tagName was empty there).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isLocked || showOnboarding) return;
      if (e.key === 'Escape') setCurrentPage('home');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLocked, showOnboarding, setCurrentPage]);

  const handleOnboardingComplete = async () => {
    // First use: the default PIN is 000000 (changeable via Profile → Change PIN)
    updateState({ pin: await hashPin(DEFAULT_PIN), onboardingSeen: true });
    setShowOnboarding(false);
    setIsLocked(false);
    showToast('Welcome! Default PIN is 000000 — change it in Profile.');
  };

  const handleLoadDemo = async () => {
    // Onboarding "Try a demo" path: seed the sample preset, then finish setup.
    // Spread order matters: DEMO_STATE first so pin/onboardingSeen below win.
    updateState({ ...DEMO_STATE, pin: await hashPin(DEFAULT_PIN), onboardingSeen: true });
    setShowOnboarding(false);
    setIsLocked(false);
    showToast('Demo data loaded! Default PIN is 000000 — reset it anytime from Profile.');
  };

  const handlePinVerify = async (pin: string) => {
    // Never unlock on an empty/missing PIN hash — the caller (PinScreen)
    // always verifies against state.pin before calling this.
    if (!state.pin) return;
    setIsLocked(false);
    lastActivity.current = Date.now();
    // Transparently upgrade legacy weak PIN hashes on successful unlock
    if (isLegacyPinHash(state.pin)) {
      updateState({ pin: await hashPin(pin) });
      showToast('PIN security upgraded to PBKDF2-SHA-256');
    }
  };

  // Panic wipe completed on the PIN screen — return to first-run state.
  // Reload so every screen, timer and cached value starts from a clean slate.
  const handlePanicWipe = () => {
    window.location.reload();
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

  const lock = useCallback(() => setIsLocked(true), []);
  const replayTutorial = useCallback(() => setShowOnboarding(true), []);

  const contextValue = useMemo(() => ({
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
          <Suspense fallback={<PageFallback />}>
            <Onboarding onComplete={handleOnboardingComplete} onLoadDemo={handleLoadDemo} />
          </Suspense>
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

  // Render lock screen (default PIN 000000 until changed)
  if (isLocked && state.onboardingSeen) {
    return (
      <AppContext.Provider value={contextValue}>
        <div className="app-shell">
          <PinScreen
            mode="verify"
            existingHash={state.pin || undefined}
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
          lastSavedLabel={lastSavedLabel}
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
          <Suspense fallback={<PageFallback />}>
            {currentPage === 'home' && <HomePage />}
            {currentPage === 'manage' && <ManagePage />}
            {currentPage === 'restock' && <RestockPage />}
            {currentPage === 'profile' && <ProfilePage onOpenChangePin={() => setChangingPin(true)} />}
          </Suspense>
        </div>

        {/* Bottom Navigation */}
        <BottomNav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />

        {/* Toast */}
        <Toast message={toast.msg} visible={toast.visible} />

        {/* PWA update prompt (manual reload only) */}
        <UpdateBanner />
      </div>
    </AppContext.Provider>
  );
};

export default App;
