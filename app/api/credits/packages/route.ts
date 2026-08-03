import { NextRequest, NextResponse } from 'next/server';
import { CreditPackage } from '@/types/credits';

/**
 * GET /api/credits/packages
 * Returns the available credit packages for the manual purchase system.
 * These are fixed tiers — the user picks one, pays the admin, submits a tx hash.
 */
export async function GET(request: NextRequest) {
  const packages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter',
      credits: 100,
      priceSol: 0.5,
      priceUsd: 4.99,
      bonusPercentage: 20,
      displayOrder: 1,
    },
    {
      id: 'basic',
      name: 'Basic',
      credits: 250,
      priceSol: 0.9,
      priceUsd: 9,
      bonusPercentage: 25,
      displayOrder: 2,
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 600,
      priceSol: 1.6,
      priceUsd: 19,
      bonusPercentage: 30,
      displayOrder: 3,
      isHot: true,
      isBestValue: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      credits: 1300,
      priceSol: 3.5,
      priceUsd: 39,
      bonusPercentage: 35,
      displayOrder: 4,
    },
  ];

  return NextResponse.json({ packages });
}
