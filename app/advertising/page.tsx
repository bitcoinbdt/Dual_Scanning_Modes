import type { Metadata } from 'next';
import AdvertisingClient from './AdvertisingClient';

export const metadata: Metadata = {
  title: 'Token Advertising',
  description: 'Feature your token across OnChain Alpha Scanner. Boost visibility with credit-based advertising.',
  openGraph: {
    title: 'Token Advertising | OnChain Alpha Scanner',
    url: '/advertising',
  },
};

export default function AdvertisingPage() {
  return <AdvertisingClient />;
}
