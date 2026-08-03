import { X, Zap, AlertTriangle } from 'lucide-react';

interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  onBuyCredits: () => void;
  needed: number;
  balance: number;
}

export function InsufficientCreditsModal({
  open,
  onClose,
  onBuyCredits,
  needed,
  balance,
}: InsufficientCreditsModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm glass-strong rounded-2xl p-6 text-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.15)' }}
        >
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Not Enough Credits</h2>
        <p className="text-sm text-muted-themed mb-4">
          You need <span className="text-amber-400 font-semibold">{needed} credits</span> for this
          scan, but you have{' '}
          <span className="text-red-400 font-semibold">{balance} credits</span>.
        </p>
        <button
          onClick={() => {
            onClose();
            onBuyCredits();
          }}
          className="w-full gradient-primary text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" /> Buy Credits
        </button>
      </div>
    </div>
  );
}
