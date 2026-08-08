# Module 10: Live Risk Monitoring

## Objective
Establish websocket connections to monitor real-time swap logs and block updates, triggering instant alerts when thresholds are crossed.

## Required Data
* Live transaction streams (swaps, transfers, mint/burn).
* Mempool transactions (optional, for frontrunning warnings).

## Data Sources
* Websocket JSON-RPC endpoints (`eth_subscribe` to logs).
* Custom streaming index nodes.

## Inputs
* Token contract address.
* Set of pool addresses mapped for the token.

## Processing Logic
1. **Subscribe to Logs**: Establish a persistent websocket listener for ERC-20 `Transfer` and Uniswap/AMM `Swap` log topics.
2. **Threshold Checks**: Run incoming transactions through real-time checks:
   * Is transaction value $\ge$ 5% of active pool liquidity?
   * Is sender a known whale/deployer wallet?
   * Did pool reserves decrease by $> 5\%$ in a single block?
3. **Alert Dispatch**: Format and queue alerts for validated events.

## Metrics
* **Real-time Volume Rate**: USD transaction volume per minute.
* **Block Reserve Change (%)**: Reserve delta between consecutive block heights.

## Detection Logic
* **Alert Trigger**: Trigger "Whale Sale Alert" when an address transfers $> 1\%$ of supply to a pool or executes a sell order $> \$25,000$ USD.

## Output Schema
```json
{
  "module": "live_monitoring",
  "alerts_queued": [
    {
      "alert_type": "LARGE_SELL",
      "tx_hash": "0xabc...",
      "timestamp": 17894212,
      "amount_usd": 32000.0,
      "price_impact_pct": 5.4
    }
  ]
}
```

## Evidence Requirements
* Transaction hash of the triggering transaction.
* Event logs indicating token transfer or swap details.

## Confidence Calculation
* **High (100)**: Direct on-chain transaction logs confirmed in a mined block.
* **Medium (70-90)**: Pending mempool transaction (subject to replacement/cancellation).
* **Low (0-69)**: Aggregator estimates.

## Failure Conditions
* Websocket connection dropped.
* Node RPC provider falls behind the active tip.

## Data Limitations
* High latency block networks (e.g. Ethereum L1) limit true instant real-time reactions compared to fast Solana/Base L2s.
