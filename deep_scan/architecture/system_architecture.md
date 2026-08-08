# System Architecture

## Overview
The Deep Scan intelligence engine is divided into distinct layers to isolate raw data fetching, caching, analysis, and report generation. This decoupled design ensures stability, high performance, and minimal RPC load.

---

## 1. Component Block Diagram

```mermaid
graph TD
    subgraph Client Interface
        A[CLI / UI / API Router]
    end

    subgraph Orchestration Layer
        B[Deep Scan Coordinator]
        C[Task Runner / Live Websockets]
    end

    subgraph Data Ingestion & Cache
        D[RPC Adapters]
        E[Indexer Subgraphs]
        F[GeckoTerminal API]
        G[Local Caching DB sqlite/postgres]
    end

    subgraph Analytical Core
        H[Liquidity Engine V2/V3]
        I[Wallet Graph Classifier]
        J[Regime Classifier]
        K[Risk Synthesis Block]
    end

    subgraph Output Generation
        L[Evidence Engine]
        M[Report Synthesizer]
    end

    A -->|1. Request Contract Address| B
    B -->|2. Check Cache| G
    B -->|3. Fetch Logs & Reserves| D
    B -->|3. Fetch Candle History| E
    B -->|3. Fetch Price Feeds| F
    D & E & F -->|Normalize & Save| G
    G -->|4. Read Normalized Data| H & I & J & K
    H & I & J & K -->|5. Analytical Metrics| L
    L -->|6. Map Evidence | M
    M -->|7. Formatted JSON / MD| A
```

---

## 2. Core Subsystems

### 2.1 Ingestion & Adapter Layer
Handles JSON-RPC multi-calls, HTTP REST requests, and graph queries. Translates provider-specific responses into standardized local structures. Implements client-side rate limiters and automatic retry strategies.

### 2.2 Cache & Persistence Layer
A local lightweight database storing block logs, address profiling records, and transaction listings. Enables complex graph searches (like tracing co-funding parent addresses) without hitting remote blockchain nodes repeatedly.

### 2.3 Analysis Core (Modules 1-14)
Independent, functional execution blocks that ingest data arrays and compute scores, trends, and execution slippage. Modules have zero side effects and are tested individually against fixed datasets.

### 2.4 Evidence & Synthesis Layer (Module 15)
Inspects outputs from all analysis cores. Builds the `evidence` pointers and synthesizes the finalized markdown report, resolving conflicting indicators before passing results to the outer interface.
