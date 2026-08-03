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
  metadataBase: new URL('https://scanner.coinxera.com'),
  title: {
    default: 'OnChain Alpha Scanner - Token Analysis & Security Scanner',
    template: '%s | OnChain Alpha Scanner',
  },
  description: 'Advanced cryptocurrency token scanner with on-chain analysis, security audits, P&L analysis, and real-time market intelligence.',
  keywords: ['token scanner', 'crypto security', 'solana scanner', 'BSC scanner', 'ethereum scanner', 'on-chain analysis', 'rug pull detector', 'P&L analysis'],
  authors: [{ name: 'OnChain Alpha' }],
  verification: {
    google: '5z5ZX_cY44RAb70VUQCtLvUdObxfJK9IFx_lqDIqvcE',
  },
  openGraph: {
    type: 'website',
    siteName: 'OnChain Alpha Scanner',
    title: 'OnChain Alpha Scanner - Token Analysis & Security Scanner',
    description: 'Advanced cryptocurrency token scanner with on-chain analysis, security audits, P&L analysis, and real-time market intelligence.',
    url: 'https://scanner.coinxera.com',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OnChain Alpha Scanner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OnChain Alpha Scanner',
    description: 'Advanced cryptocurrency token scanner with on-chain analysis, security audits, P&L analysis, and real-time market intelligence.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://scanner.coinxera.com',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': 'OnChain Alpha Scanner',
    'url': 'https://scanner.coinxera.com',
    'applicationCategory': 'FinanceApplication',
    'description': 'Advanced multi-chain token security scanner with on-chain analysis, security audits, and real-time market intelligence.',
    'offers': {
      '@type': 'Offer',
      'priceCurrency': 'USD',
      'price': '0',
      'description': 'Credit-based scan pricing starting from free tiers.'
    }
  };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://sanpifotyozeinatpyki.supabase.co" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
