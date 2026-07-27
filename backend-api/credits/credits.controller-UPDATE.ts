// ===========================================
// UPDATE TO EXISTING credits.controller.ts
// ===========================================
// Add this code to your existing credits controller

import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CreditsService } from './credits.service';
import { ReferralService } from '../referral/referral.service';

interface PurchaseCreditsDto {
  packageId: string;
  walletAddress: string;
  txSignature: string;
}

@Controller('api/credits')
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly referralService: ReferralService // INJECT REFERRAL SERVICE
  ) {}

  @Post('purchase')
  async purchaseCredits(
    @Req() req: any,
    @Body() purchaseDto: PurchaseCreditsDto
  ) {
    const userId = req.user.id;
    const { packageId, walletAddress, txSignature } = purchaseDto;

    // Validate input
    if (!packageId || !walletAddress || !txSignature) {
      throw new BadRequestException('Missing required fields: packageId, walletAddress, txSignature');
    }

    // 1. Verify Solana transaction
    const isValid = await this.creditsService.verifyTransaction(
      txSignature,
      walletAddress,
      packageId
    );

    if (!isValid) {
      throw new BadRequestException('Invalid or unconfirmed transaction');
    }

    // 2. Credit user's account
    const result = await this.creditsService.addCredits(userId, packageId);

    // 3. Check and award referral bonus
    const referralResult = await this.referralService.awardReferralBonus(
      userId,
      packageId,
      result.creditsAdded,
      result.amountPaid
    );

    // Log referral bonus result
    if (referralResult.awarded) {
      console.log(`Referral bonus awarded: ${referralResult.bonus_credits} credits to user ${referralResult.referrer_user_id}`);
    }

    return {
      success: true,
      credits: result.creditsAdded,
      newBalance: result.newBalance,
      transaction: {
        signature: txSignature,
        package: packageId,
      },
      referralBonus: referralResult.awarded ? {
        awarded: true,
        referrerUserId: referralResult.referrer_user_id,
        bonusCredits: referralResult.bonus_credits,
        bonusPercentage: referralResult.bonus_percentage,
      } : null,
    };
  }
}

// ===========================================
// ALSO UPDATE credits.module.ts
// ===========================================
// Import ReferralModule:

import { Module } from '@nestjs/common';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { ReferralModule } from '../referral/referral.module'; // ADD THIS

@Module({
  imports: [ReferralModule], // ADD THIS
  controllers: [CreditsController],
  providers: [CreditsService],
})
export class CreditsModule {}
