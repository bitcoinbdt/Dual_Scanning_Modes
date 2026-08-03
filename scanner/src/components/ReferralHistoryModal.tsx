import { useEffect, useState } from 'react';
import { X, Gift, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Referral } from '@/lib/types';

interface ReferralHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function ReferralHistoryModal({ open, onClose }: ReferralHistoryModalProps) {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error) setReferrals((data || []) as Referral[]);
          setLoading(false);
        });
    }
  }, [open, user]);

  if (!open) return null;

  const totalEarned = referrals.reduce((sum, r) => sum + r.bonus_credits, 0);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg glass-strong rounded-2xl p-6 animate-scale-in max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-primary-themed" />
          <h2 className="text-xl font-bold gradient-text">Referral History</h2>
        </div>
        <p className="text-sm text-muted-themed mb-4">
          Total earned: <span className="text-primary-themed font-bold">{totalEarned}</span> bonus
          credits from {referrals.length} referral{referrals.length !== 1 ? 's' : ''}
        </p>

        {loading ? (
          <div className="py-8 text-center text-muted-themed">Loading...</div>
        ) : referrals.length === 0 ? (
          <div className="py-8 text-center text-muted-themed">
            No referral earnings yet. Share your code to earn bonus credits!
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="glass rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-themed">{r.package_name} package</div>
                  <div className="text-xs text-muted-themed">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-primary-themed font-bold">
                  <Zap className="w-4 h-4" />+{r.bonus_credits}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
