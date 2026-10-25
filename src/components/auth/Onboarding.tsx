import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

interface OnboardingProps {
  onComplete: () => void;
  /** Optional: seed the workspace with sample data instead of an empty one. */
  onStartDemo?: () => void;
}

const slides = [
  { icon: '🎉', title: 'Welcome to Inventory Pro', features: ['Works 100% offline', '6-digit PIN sign-in', 'Data stays on this device'] },
  { icon: '🧮', title: 'Smart Recipe Tracking', features: ['Log 20 croissants produced', 'Auto-deducts flour per recipe', 'Auto-deducts butter & sugar'] },
  { icon: '📝', title: 'Daily Workflow', features: ['🟢 Output finished goods', '🔴 Log waste & losses', '🔵 Restock ingredients'] },
  { icon: '📲', title: 'Smart Ordering', features: ['Low-stock alerts', 'Auto shopping list', 'WhatsApp integration'] },
  { icon: '🔐', title: "Let's Get Started", features: ['Set up your PIN', 'Secure your data', 'Start managing inventory'] },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onStartDemo }) => {
  const [slide, setSlide] = useState(0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const current = slides[slide];

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      {/* Top bar */}
      <div className="flex justify-between items-center p-4">
        <button onClick={() => setShowSkipConfirm(true)} className="text-sm font-medium text-[var(--text-sub)]">Skip</button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-all" style={{ background: i === slide ? 'var(--primary)' : 'var(--border)' }} />
          ))}
        </div>
        <div className="w-10" />
      </div>

      {/* Content (scrollable on short screens so nothing gets clipped) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-8 py-6">
        <div className="text-6xl mb-8">{current.icon}</div>
        <h2 className="text-2xl font-semibold mb-6 text-center text-[var(--text-main)]">{current.title}</h2>
        <div className="space-y-3 w-full">
          {current.features.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)]">
              <Check size={16} className="text-[var(--success)] flex-shrink-0" />
              <span className="text-sm text-[var(--text-main)]">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 space-y-3">
        <div className="flex gap-3">
          {slide > 0 && (
            <Button variant="outline" fullWidth onClick={() => setSlide(s => s - 1)}>Back</Button>
          )}
          <Button variant="primary" fullWidth onClick={() => {
            if (slide < slides.length - 1) setSlide(s => s + 1);
            else onComplete();
          }}>
            {slide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        </div>
        {/* "Try a demo" was promised by the dead DEMO_STATE dataset — wire it up. */}
        {slide === slides.length - 1 && onStartDemo && (
          <Button variant="outline" fullWidth onClick={onStartDemo}>
            Try a demo with sample data
          </Button>
        )}
      </div>

      {/* Skip Confirmation — Sheet is the app's only modal */}
      {showSkipConfirm && (
        <Sheet title="Skip Onboarding?" onClose={() => setShowSkipConfirm(false)} variant="center">
          <p className="text-sm mb-4 text-[var(--text-sub)]">You can replay the tutorial later from Profile.</p>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setShowSkipConfirm(false)}>Cancel</Button>
            <Button variant="primary" fullWidth onClick={onComplete}>Skip</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
};
