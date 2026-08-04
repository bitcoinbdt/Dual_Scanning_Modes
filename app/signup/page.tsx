import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Sign up for OnChain Crypto Scanner and get instant access to token contract address scanning, security audits, and on-chain analytics.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
