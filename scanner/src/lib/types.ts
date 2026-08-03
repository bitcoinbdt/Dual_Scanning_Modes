export interface Profile {
  id: string;
  email: string;
  full_name: string;
  credits: number;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  network: string;
  address: string;
  qr_code_url: string | null;
  instructions: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreditRequest {
  id: string;
  user_id: string;
  user_email: string;
  package_name: string;
  credits: number;
  price_usd: number;
  payment_method_id: string | null;
  payment_method_name: string;
  payment_method_network: string;
  tx_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  bonus_credits: number;
  package_name: string;
  purchase_credits: number;
  created_at: string;
}

export interface ScanHistory {
  id: string;
  user_id: string;
  mode: string;
  chain: string;
  token_address: string;
  token_symbol: string;
  credits_spent: number;
  created_at: string;
}

export interface CreditPackage {
  name: string;
  credits: number;
  priceUsd: number;
  priceSol: string;
  bonusPct: number;
  bonusCredits: number;
  hot?: boolean;
  totalCredits: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    name: 'Starter',
    credits: 50,
    priceUsd: 10,
    priceSol: '0.5',
    bonusPct: 0,
    bonusCredits: 0,
    totalCredits: 50,
  },
  {
    name: 'Basic',
    credits: 100,
    priceUsd: 18,
    priceSol: '0.9',
    bonusPct: 10,
    bonusCredits: 10,
    totalCredits: 110,
  },
  {
    name: 'Pro',
    credits: 200,
    priceUsd: 32,
    priceSol: '1.6',
    bonusPct: 20,
    bonusCredits: 40,
    hot: true,
    totalCredits: 240,
  },
  {
    name: 'Premium',
    credits: 500,
    priceUsd: 80,
    priceSol: '3.5',
    bonusPct: 30,
    bonusCredits: 150,
    totalCredits: 650,
  },
];

export interface ReferralTier {
  name: string;
  credits: number;
  priceSol: string;
  bonus: number;
  bonusPct: number;
  hot?: boolean;
  best?: boolean;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { name: 'Starter', credits: 50, priceSol: '0.5', bonus: 5, bonusPct: 10 },
  { name: 'Basic', credits: 100, priceSol: '0.9', bonus: 15, bonusPct: 15 },
  { name: 'Pro', credits: 200, priceSol: '1.6', bonus: 40, bonusPct: 20, hot: true },
  { name: 'Premium', credits: 500, priceSol: '3.5', bonus: 125, bonusPct: 25, best: true },
];

export interface ElevatorOption {
  credits: number;
  transactions: number;
  label: string;
}

export const ELEVATOR_OPTIONS: ElevatorOption[] = [
  { credits: 5, transactions: 50, label: '50 Transactions' },
  { credits: 10, transactions: 100, label: '100 Transactions' },
  { credits: 20, transactions: 200, label: '200 Transactions' },
  { credits: 30, transactions: 500, label: '500 Transactions' },
];

export const BASIC_SCAN_COST = 2;

export interface ChainInfo {
  id: string;
  label: string;
  color: string;
}

export const CHAINS: ChainInfo[] = [
  { id: 'auto', label: 'Auto-detect', color: 'purple' },
  { id: 'solana', label: 'Solana', color: 'cyan' },
  { id: 'bsc', label: 'BSC', color: 'yellow' },
  { id: 'ethereum', label: 'Ethereum', color: 'blue' },
];
