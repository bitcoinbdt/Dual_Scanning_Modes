# Data Flow Pipelines

## Overview
This document trace the path of data from the initial contract address entry to the final trader-facing intelligence report.

---

## 1. Sequence Diagram: Data Pipeline Flow

```mermaid
sequenceDiagram
    participant User as User / Client
    participant Coord as Coordinator
    participant Cache as Cache Database
    participant Providers as External APIs / Nodes
    participant Engine as Analytical Engine
    participant Synthesizer as Report Synthesizer

    User->>Coord: Scan(Address, Network, PositionSize)
    Coord->>Cache: Query Metadata & State
    alt Cache Hit & Fresh (Age < TTL)
        Cache-->>Coord: Return Cached Data
    else Cache Miss / Stale
        Coord->>Providers: Batch RPC (Reserves, Metadata)
        Coord->>Providers: Subgraph Query (Historical Trades)
        Coord->>Providers: Price Feed (Spot USD)
        Providers-->>Coord: Raw Payload Response
        Coord->>Cache: Normalize & Write Payload
    end

    Coord->>Engine: Run Modules (1 - 14)
    Engine->>Engine: Calculate Slippage, HHI, Whales, ROI
    Engine-->>Coord: Sub-scores & Metrics JSON

    Coord->>Synthesizer: Compile Signal Report
    Synthesizer->>Synthesizer: Assemble Evidence Trails (Fact -> Impact)
    Synthesizer->>Synthesizer: Prioritize Top Risks
    Synthesizer-->>User: Return Report & API Response
```

---

## 2. Data Transformation Stages

### Stage 1: Validation & Ingestion
* Input validation checks contract format.
* Metadata fetch identifies target decimal values.

### Stage 2: Normalization & Storage
* Numeric values converted to strings.
* Gas metrics standardized to USD equivalent.
* Events indexed by block height.

### Stage 3: Feature Ingestion
* Module runners slice data into specific windows (5m, 1h, 24h, 7d).
* Computes mathematical matrices (constant product derivatives, wallet graphs).

### Stage 4: Evidentiary Mapping
* Metrics are checked against threshold configurations.
* Triggers populate the `evidence` schema list.
* Final Markdown and JSON are rendered.
