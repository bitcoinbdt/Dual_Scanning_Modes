import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CreditProvider } from '@/contexts/CreditContext';
import { Toaster } from 'react-hot-toast';
import CookieConsent from '@/components/CookieConsent';
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://scanner.coinxera.com'),
  title: {
    default: 'OnChain Crypto Scanner - Token Contract Address Scanner & Security Audits',
    template: '%s | OnChain Crypto Scanner',
  },
  description: 'OnChain Crypto Scanner – the #1 token contract address scanner. Instant on-chain security audits, rug-pull detection, P&L analysis, and real-time market intelligence for Solana, BSC & Ethereum.',
  keywords: ['token contract address scanner', 'onchain crypto scanner', 'token scanner', 'crypto contract scanner', 'solana token scanner', 'BSC token scanner', 'ethereum token scanner', 'on-chain analysis', 'rug pull detector', 'crypto security audit', 'P&L analysis', 'smart contract scanner'],
  authors: [{ name: 'OnChain Crypto Scanner' }],
  verification: {
    google: '5z5ZX_cY44RAb70VUQCtLvUdObxfJK9IFx_lqDIqvcE',
  },
  openGraph: {
    type: 'website',
    siteName: 'OnChain Crypto Scanner',
    title: 'OnChain Crypto Scanner - Token Contract Address Scanner & Security Audits',
    description: 'OnChain Crypto Scanner – the #1 token contract address scanner. Instant on-chain security audits, rug-pull detection, P&L analysis, and real-time market intelligence for Solana, BSC & Ethereum.',
    url: 'https://scanner.coinxera.com',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OnChain Crypto Scanner - Token Contract Address Scanner' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OnChain Crypto Scanner',
    description: 'OnChain Crypto Scanner – the #1 token contract address scanner. Instant on-chain security audits, rug-pull detection, P&L analysis, and real-time market intelligence for Solana, BSC & Ethereum.',
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
    'name': 'OnChain Crypto Scanner',
    'alternateName': 'Token Contract Address Scanner',
    'url': 'https://scanner.coinxera.com',
    'applicationCategory': 'FinanceApplication',
    'description': 'OnChain Crypto Scanner is the #1 token contract address scanner. Scan any crypto token contract for security risks, rug-pull signals, on-chain analytics, and P&L data across Solana, BSC & Ethereum.',
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
        <ChunkErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <CreditProvider>
                {children}
                <Toaster position="top-right" />
                <CookieConsent />
              </CreditProvider>
            </AuthProvider>
          </ThemeProvider>
        </ChunkErrorBoundary>
      </body>
    </html>
  );
}
