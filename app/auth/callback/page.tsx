import type { Metadata } from 'next';
import AuthCallbackClient from './AuthCallbackClient';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthCallbackPage() {
  return <AuthCallbackClient />;
}