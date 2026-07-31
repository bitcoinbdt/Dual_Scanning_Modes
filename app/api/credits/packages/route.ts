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
      credits: 50,
      priceSol: 0.5,
      priceUsd: 10,
      bonusPercentage: 0,
      displayOrder: 1,
    },
    {
      id: 'basic',
      name: 'Basic',
      credits: 100,
      priceSol: 0.9,
      priceUsd: 18,
      bonusPercentage: 10,
      displayOrder: 2,
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 200,
      priceSol: 1.6,
      priceUsd: 32,
      bonusPercentage: 20,
      displayOrder: 3,
      isHot: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      credits: 500,
      priceSol: 3.5,
      priceUsd: 70,
      bonusPercentage: 30,
      displayOrder: 4,
      isBestValue: true,
    },
  ];

  return NextResponse.json({ packages });
}
