import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { Navigation } from '@/components/Navigation';
import { AuthModal } from '@/components/AuthModal';
import { CreditStoreModal } from '@/components/CreditStoreModal';
import { Home } from '@/pages/Home';
import { Pricing } from '@/pages/Pricing';
import { Referrals } from '@/pages/Referrals';
import { Credits } from '@/pages/Credits';
import { Agent } from '@/pages/Agent';
import { Signup } from '@/pages/Signup';
import { AuthCallback } from '@/pages/AuthCallback';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminPaymentMethods } from '@/pages/admin/AdminPaymentMethods';
import { AdminCreditRequests } from '@/pages/admin/AdminCreditRequests';

function AppShell() {
  const { user, isAdmin, loading } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [creditStoreOpen, setCreditStoreOpen] = useState(false);
  const [creditStorePkg, setCreditStorePkg] = useState<string | null>(null);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthRoute = location.pathname === '/auth/callback' || location.pathname === '/signup';

  const openCreditStore = (pkg?: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setCreditStorePkg(pkg ?? null);
    setCreditStoreOpen(true);
  };

  const navigateToCredits = (pkg: string) => {
    navigate(`/credits?package=${pkg}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-themed">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!isAdminRoute && !isAuthRoute && (
        <Navigation
          onOpenAuth={() => setAuthOpen(true)}
          onOpenCreditStore={() => openCreditStore()}
        />
      )}

      <Routes>
        <Route path="/" element={<Home onOpenCreditStore={openCreditStore} />} />
        <Route path="/pricing" element={<Pricing onOpenCreditStore={openCreditStore} />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/agent" element={<Agent />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {isAdmin && (
          <>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/payment-methods" element={<AdminPaymentMethods />} />
            <Route path="/admin/credit-requests" element={<AdminCreditRequests />} />
          </>
        )}
        <Route path="*" element={<Home onOpenCreditStore={openCreditStore} />} />
      </Routes>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <CreditStoreModal
        open={creditStoreOpen}
        onClose={() => setCreditStoreOpen(false)}
        preselectedPackage={creditStorePkg}
        onNavigateCredits={navigateToCredits}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
