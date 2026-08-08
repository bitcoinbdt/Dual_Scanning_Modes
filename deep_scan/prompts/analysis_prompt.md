# Analysis Prompt: Module-Level Signals Interpretation

## Task
Your task is to analyze normalized transaction logs, transfer streams, pool reserve states, and holder profiles for a specific token contract and generate granular interpretations for the selected module.

## Core Template (FACT-to-IMPACT reasoning)
For each detected anomaly or notable signal, you must output your analysis matching this structure:

```markdown
### [Signal Identifier / Title]
* **FACT**: [Description of raw data: timestamp, block number, addresses, tx hashes]
* **METRIC**: [Calculated metric: percentages, ratio changes, Gini index, slippage]
* **PATTERN**: [Comparison to historic baseline: is this typical for this token? How does it compare to standard DEX distributions?]
* **SIGNAL**: [Underlying inference: e.g. whale distribution, coordinated cluster entry]
* **TRADER IMPACT**: [Execution effect: e.g. 15% execution slippage for $10k order, high exit lockup risk]
* **CONFIDENCE**: [Score 0-100 / Explain factors (e.g. data freshness, source RPC verification)]
```

## Guidance per Analytical Domain

### 1. Wallets & Funding
* Search for common funding nodes (common addresses sending gas to multiple buying addresses).
* Group addresses by close transaction block intervals.
* Label clusters as "Potentially connected clusters" rather than "Co-owned wallets."

### 2. Liquidity & Slips
* Calculate slippage utilizing constant-product arithmetic:
  $$\Delta y = y - \frac{k}{x + \Delta x}$$
* Account for liquidity distribution across multiple DEX pools. Distinguish between total pool liquidity and the fraction that is realistically route-accessible.

### 3. Capital Flows
* Evaluate the Capital Sensitivity Multiplier:
  $$\text{Sensitivity} = \frac{\Delta \text{Market Cap}}{\text{Net Capital Flow}}$$
* Flag high sensitivity values where small swaps produce volatile price shifts.
