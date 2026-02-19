# ECS ARA Comercial — Data Flow

## Data Sources

### 1. Static ETL Data (`/data/*.json`)
Pre-processed data from Bitrix24 XLS exports, transformed by Python ETL scripts into:
- **`leads.json`** — 17,483 ECS leads with scores, segments, metadata
- **`interactions.json`** — Timestamped interaction records per lead
- **`score_history.json`** — Longitudinal score snapshots for trend analysis

### 2. Bitrix24 Webhook Polling (Live)
- **Endpoint**: `https://hogaresfuncionales.bitrix24.es/rest/9946/5itdztxrr5vfefrg/`
- **Proxy**: Browser calls `/api/bitrix/crm.lead.list.json` → nginx/Vite proxy → Bitrix24
- **Interval**: Every 180 seconds (configurable via `VITE_POLL_INTERVAL_SECONDS`)
- **Method**: POST with URL-encoded nested params (`order[DATE_MODIFY]=DESC`, `select[0]=ID`, etc.)
- **Merge strategy**: New leads are merged by `bitrix_id`; existing leads get updated fields and recalculated ECS scores

### 3. Sentiment AI Agent (On-Demand)
- **Endpoint**: `levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run`
- **Trigger**: Manual batch analysis or per-lead analysis from UI
- **Output**: sentiment_score, sentiment_label, engagement_quality, intent_signals, risk_flags, recommended_action, reasoning, ecs_sentiment_bonus

## Data Flow Diagram

```
  Bitrix24 CRM                    Modal.run AI
       │                               │
       │ POST /crm.lead.list.json      │ POST /analyze
       ▼                               ▼
  ┌──────────┐                   ┌──────────┐
  │ nginx    │                   │Sentiment │
  │ proxy    │                   │ Agent    │
  │/api/bitrix│                  │          │
  └────┬─────┘                   └────┬─────┘
       │                              │
       ▼                              ▼
  ┌──────────┐  merge           ┌──────────┐
  │ Bitrix   │──────────┐      │Sentiment │
  │ Poller   │          │      │ Store    │
  │(180s)    │          │      │(Zustand) │
  └──────────┘          │      └──────────┘
                        │
  ┌──────────┐          ▼
  │ Static   │───► React Query Cache ["leads"]
  │ /data/   │         │
  │ *.json   │         ├──► Dashboard (KPIs, Funnel, Trends)
  └──────────┘         ├──► Analytics (Sentiment, Diagnostic, Predictive)
                       ├──► Lead Explorer (Search, Filter, Export)
                       └──► AB Testing (Experiment Generator)
```

## Caching Strategy

| Layer | TTL | Invalidation |
|-------|-----|-------------|
| React Query `["leads"]` | 5 min staleTime | Bitrix poll merges new data directly into cache |
| React Query `["interactions"]` | 5 min staleTime | Invalidated after each Bitrix poll cycle |
| Zustand `useSentimentStore` | Persistent (localStorage) | Manual re-analysis overwrites per-lead |
| Zustand `useTimeRangeStore` | Persistent (localStorage) | User selection |
| Zustand `usePreferencesStore` | Persistent (localStorage) | User toggle |
| Zustand `useExperimentStore` | Persistent (localStorage) | Hydrated on mount |

## Bitrix24 Polling Details

The poller (`src/lib/bitrix-poller.ts`) uses a **proxy architecture** to avoid CORS:

- **Development**: Vite dev server proxy (`/api/bitrix` → `https://hogaresfuncionales.bitrix24.es/rest/...`)
- **Production**: nginx reverse proxy (`location /api/bitrix/` → `proxy_pass https://...`)

Parameters are encoded using `toBitrixParams()` which converts nested objects to Bitrix24's expected format:
```
{ order: { DATE_MODIFY: "DESC" }, select: ["ID", "NAME"] }
→ order[DATE_MODIFY]=DESC&select[0]=ID&select[1]=NAME
```

The merge function (`mergePolledLeads`) matches by `bitrix_id`, updates existing leads, adds new ones, and recalculates ECS scores for all affected leads.
