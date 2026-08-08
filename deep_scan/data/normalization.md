# Data Normalization & Standardization

## Overview
Blockchain networks, explorer schemas, and decentralized exchange pools write logs in divergent structures. This document defines the normalization rules to translate these heterogeneous structures into standard formats matching the JSON schemas under `schemas/`.

---

## 1. Decimal & Precision Standardization
* **Internal Calculation**: Always convert token amounts into absolute big integers (wei units) for calculations.
* **Standardized Presentation**: Divide by $10^{\text{decimals}}$ to output standardized decimal strings in the JSON schemas (e.g. `amount_token`: `"1500.25"`).
* **Base Asset Valuation**: Standardize all stablecoins and base native assets (e.g., WETH, SOL, USDC) to USD values using real-time price feeds.

---

## 2. Event Log Normalization
Standardize raw logs from different AMM versions (Uniswap V2, V3, and custom curves) into a single transaction type format:

### Uniswap V2 Swap Event
* Raw fields: `sender`, `amount0In`, `amount1In`, `amount0Out`, `amount1Out`, `to`.
* Normalization map:
  * `tx_type`: If `amount0In > 0` and token0 is WETH, type is `swap_buy`.
  * `amount_token`: Output token amount (whichever Out parameter corresponds to target token).

### Uniswap V3 Swap Event
* Raw fields: `sender`, `recipient`, `amount0`, `amount1`, `sqrtPriceX96`, `liquidity`, `tick`.
* Normalization map:
  * Check signs of `amount0` and `amount1` (negative means output, positive means input) to determine trade direction and size.

---

## 3. Address Format Normalization
* **EVM Networks**: Convert all addresses to lowercased checksum format prior to database insertion.
* **Solana Network**: Maintain case-sensitive Base58 strings. Do not lowercase Solana keys.

---

## 4. Chain Metadata Mapping
Ensure all block heights, transaction receipts, and gas values conform to the standard types listed in `schemas/transaction.json`. Convert native gas costs (e.g., SOL, ETH, gas units $\cdot$ gas price) to USD values based on block-timestamp token values.
