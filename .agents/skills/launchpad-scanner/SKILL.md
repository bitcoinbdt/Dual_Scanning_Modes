---
name: launchpad-scanner
description: >-
  Use this skill to guide the integration, detection, and funnel analysis of tokens
  launched via Solana/EVM launchpads (like Pump.fun and Raydium LaunchLab) and deployer behavior profiling.
---

# Launchpad Scanner Customization Skill

This skill defines the technical workflows, directory structures, and API routing requirements for implementing the Launchpad & Deployer Analysis systems.

## Folder Structure

All launchpad scanner libraries and API endpoints should follow this structure:

```text
lib/launchpad/
├── registry.ts              # Launchpad program IDs and contracts
├── detector.ts              # Chain and launchpad detection logic
├── api/
│   ├── codex.ts            # Codex API integration
│   ├── bitquery.ts         # Bitquery GraphQL integration
│   ├── coingecko.ts        # CoinGecko API integration
│   ├── moralis.ts          # Moralis API integration
│   ├── pumpportal.ts       # PumpPortal WebSocket integration
│   └── raydium-sdk.ts      # Raydium SDK integration
├── aggregator.ts            # Data aggregation logic
├── types.ts                 # TypeScript interfaces
└── utils.ts                 # Helper functions

app/api/launchpad/
├── detect/route.ts          # POST endpoint to detect launchpad
├── analyze/route.ts         # POST endpoint to analyze token
└── [launchpad]/route.ts     # GET endpoint per launchpad
```

## Key Workflows

### 1. Launchpad Detection
Inspect either the token creator address or the token creation transaction signatures to locate the source launchpad. Use the following program/contract maps:

**Solana:**
- `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` -> Pump.fun
- `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj` -> Raydium LaunchLab
- `MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG` -> Moonshot

**EVM:**
- `0x1de460f363AF910f51726DEf188F9004276Bf4bc` -> Flap.sh
- `0x5c952063c7fc8610FFDB798152D69F0B9550762b` -> Four.meme

### 2. Token Age Classification
- **Brand New**: 0-72 hours
- **New**: 73-168 hours
- **Established**: 169+ hours

### 3. Deployer Profiling
Analyze:
- Total transactions of the deployer.
- Launch success rate (tokens surviving >30 days).
- Dump frequency and percentage of supply dumped in the first hour.
- Associated/sybil wallet tracking based on transfer patterns.
