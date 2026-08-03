import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Sign up for OnChain Alpha Scanner and get instant access to token security audits and on-chain analytics.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupPage() {
  return <SignupClient />;
}
