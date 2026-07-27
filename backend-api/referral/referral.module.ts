import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService], // Export for use in other modules (e.g., credits)
})
export class ReferralModule {}
