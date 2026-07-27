import { Controller, Get, Post, Body, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ReferralService } from './referral.service';

@Controller('api/referral')
@UseGuards(AuthGuard)
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * GET /api/referral/code
   * Get current user's referral code and stats
   */
  @Get('code')
  async getReferralCode(@Req() req: any) {
    const userId = req.user.id;
    return this.referralService.getReferralCode(userId);
  }

  /**
   * GET /api/referral/history
   * Get referral history with pagination
   * Query params: limit (default 20), offset (default 0)
   */
  @Get('history')
  async getReferralHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const userId = req.user.id;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    // Validate pagination parameters
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new Error('Invalid limit parameter. Must be between 1 and 100.');
    }
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      throw new Error('Invalid offset parameter. Must be 0 or greater.');
    }

    return this.referralService.getReferralHistory(userId, parsedLimit, parsedOffset);
  }

  /**
   * POST /api/referral/apply
   * Apply a referral code
   * Body: { code: string }
   */
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyReferralCode(
    @Req() req: any,
    @Body('code') code: string
  ) {
    if (!code || typeof code !== 'string') {
      throw new Error('Referral code is required');
    }

    const userId = req.user.id;
    return this.referralService.applyReferralCode(userId, code);
  }
}
