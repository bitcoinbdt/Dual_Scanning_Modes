import type { Metadata } from 'next';
import AgentClient from './AgentClient';

export const metadata: Metadata = {
  title: 'Crypto Hype Agent',
  description: 'AI-powered crypto agent that fetches and ranks the top 20 boosted DexScreener tokens with live pair enrichment.',
  openGraph: {
    title: 'Crypto Hype Agent | OnChain Crypto Scanner',
    url: '/agent',
  },
};

export default function AgentPage() {
  return <AgentClient />;
}
