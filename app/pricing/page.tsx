import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
  title: 'Pricing & Credits',
  description: 'Simple credit-based pricing. No subscriptions. Buy credits and scan any token instantly on Solana, BSC, or Ethereum.',
  openGraph: {
    title: 'Pricing & Credits | OnChain Alpha Scanner',
    url: '/pricing',
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
