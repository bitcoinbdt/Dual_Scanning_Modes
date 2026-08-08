# Module 11: Multi-DEX Liquidity Mapping

## Objective
Map the distribution, reserve depths, volumes, and concentration of token liquidity across all decentralized exchanges (DEXs).

## Required Data
* Factory contracts, pool registries, and pair reserve indices.

## Data Sources
* DEX index subgraphs.
* Direct RPC registry readings (`getPair` factory queries).

## Inputs
* Token contract address.
* List of supported DEX factory addresses.

## Processing Logic
1. **Pool Discovery**: Query known DEX factory contracts (e.g. Uniswap V2/V3, Sushi, Balancer) for trading pairs matching the target token.
2. **Reserve Query**: Fetch token and stable/base token reserves (e.g., WETH, USDC) for each discovered pool.
3. **Liquidity Calculation**: Convert reserves into USD value using current base token rates.
4. **Fragmentation Analysis**: Compute the Herfindahl Index on pool reserves to assess liquidity concentration.

## Metrics
* **Total Liquidity USD**: Sum of liquidity across all pools.
* **Pool Share (%)**: Percentage of total liquidity inside each specific pool.
* **Fragmentation index**: `low` ($> 80\%$ in one pool), `medium` (50-80%), `high` (< 50% in the largest pool, scattered), `critical` (extremely low liquidity spread across multiple tiny pools).

## Detection Logic
* **Liquidity Fragmentation Alert**: If total liquidity is $> \$100,000$ USD, but no single pool holds $> 30\%$ of it, flag "Highly Fragmented Liquidity." This forces traders to route through complex paths, increasing gas and routing slippage.

## Output Schema
Reference schema: `schemas/liquidity.json`.
```json
{
  "module": "dex_liquidity",
  "total_liquidity_usd": 320000.00,
  "pools_mapped": [
    {
      "pool_address": "0xpool1...",
      "dex": "Uniswap V2",
      "pair": "TOKEN/WETH",
      "liquidity_usd": 240000.00
    }
  ]
}
```

## Evidence Requirements
* Pool contract addresses and verified active reserves.
* Factory transaction records proving pool creation.

## Confidence Calculation
* **High (95-100)**: Direct query of contract state on active chain RPC.
* **Medium (70-94)**: Aggregated GeckoTerminal/DexScreener API readings.
* **Low (0-69)**: Fragmented or custom AMM integrations with unverified codebases.

## Failure Conditions
* Factory contract address mismatch.
* Token decimals parsing error distorting reserve values.

## Data Limitations
* Does not map hidden private pools, OTC pools, or off-chain order books.
