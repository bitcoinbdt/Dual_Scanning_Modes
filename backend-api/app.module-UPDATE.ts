// ===========================================
// UPDATE TO EXISTING app.module.ts
// ===========================================
// Add ReferralModule to your main app module

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReferralModule } from './referral/referral.module'; // ADD THIS
import { CreditsModule } from './credits/credits.module';
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ReferralModule, // ADD THIS
    CreditsModule,
    // ... other modules
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
