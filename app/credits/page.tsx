import type { Metadata } from 'next';
import CreditsClient from './CreditsClient';

export const metadata: Metadata = {
  title: 'Complete Payment',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreditsPage() {
  return <CreditsClient />;
}
