# OnChain Alpha Scanner Workspace Rules

## Coding Guidelines

1. **TypeScript First**: Ensure all new files are written in TypeScript and exports are properly typed.
2. **Modular Architecture**: Separate raw API clients (e.g., Codex, Bitquery) from business logic aggregators and data normalization services.
3. **Environment Secrets**: Do not commit API keys or endpoints directly. Reference them using `process.env`.
4. **Resilient Network Code**: Always implement error try-catch blocks and provide default fallback payloads if third-party APIs rate limit or crash.
5. **No Placeholders**: Write fully functional implementations with inline comments.

## Launchpad & Deployer Scanner Directives

- Validate Solana/EVM addresses before running search routines or fetching transaction signatures.
- Cache public API responses (especially prices and volumes) for at least 60 seconds to avoid exceeding free-tier limits.
- Calculate relative ages and assign correct visual warning severity badges for new launch tokens.
