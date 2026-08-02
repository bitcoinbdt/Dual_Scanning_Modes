import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CreditProvider } from '@/contexts/CreditContext';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OnChain Alpha Scanner - Token Analysis & Security Scanner',
  description: 'Advanced cryptocurrency token scanner with on-chain analysis, security audits, and real-time market intelligence.',
  verification: {
    google: 'ZsYbrbAdLRABTM8nTNaSKaSIUXal1wZKL6Y7DlJIqbM',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <CreditProvider>
              {children}
              <Toaster position="top-right" />
              <CookieConsent />
            </CreditProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
