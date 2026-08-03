import type { Metadata } from 'next';
import ReferralsClient from './ReferralsClient';

export const metadata: Metadata = {
  title: 'Referral Program',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReferralsPage() {
  return <ReferralsClient />;
}
