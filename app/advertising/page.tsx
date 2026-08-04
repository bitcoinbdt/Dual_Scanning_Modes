import type { Metadata } from 'next';
import AdvertisingClient from './AdvertisingClient';

export const metadata: Metadata = {
  title: 'Token Advertising',
  description: 'Feature your token across OnChain Crypto Scanner. Boost visibility with credit-based advertising to active crypto traders.',
  openGraph: {
    title: 'Token Advertising | OnChain Crypto Scanner',
    url: '/advertising',
  },
};

export default function AdvertisingPage() {
  return <AdvertisingClient />;
}
