# ECS ARA Comercial — Lead Intelligence Platform

**Engagement Continuum Score (ECS)** platform for ARA Group Costa Rica. Ingests lead data from Bitrix24 CRM, computes multi-dimensional engagement scores, runs AI sentiment analysis, and delivers actionable analytics.

**Live**: https://ecs-aragroupcr.grayhill-769056ba.eastus2.azurecontainerapps.io

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite 8 (beta) |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Charts** | Recharts 3 |
| **State** | Zustand 5 (persisted stores) |
| **Data Fetching** | React Query (TanStack Query 5) |
| **Routing** | React Router 7 |
| **Hosting** | Azure Container Apps (nginx:alpine) |
| **CRM** | Bitrix24 webhook polling (180s interval) |
| **AI** | Modal.run sentiment analysis agent |

## Features

- **Dashboard** — KPIs, segment funnel, score trends, channel mix, activity feed, sync status
- **Lead Explorer** — Search, filter, sort, paginate, export to XLSX
- **Lead Profile** — Score breakdown radar, interaction timeline, AI sentiment card, advisor chat
- **Analytics** — Sentiment analysis (batch), diagnostic charts, predictive forecasting, prescriptive actions
- **AB Testing** — AI-generated experiment recommendations with tracking
- **Global Time Filter** — Filter interactions by 1 week, 1 month, 3 months, 6 months, or all time
- **Bitrix24 Sync** — Live polling via nginx reverse proxy (CORS-safe)
- **Spanish Translation** — Pattern-based translation of AI sentiment outputs

## Quick Start

```bash
npm install
npm run dev          # Start dev server with Bitrix24 proxy
npm run build        # Production build
.\deploy.ps1        # Build + deploy to Azure Container Apps
.\deploy.ps1 -SkipBuild  # Deploy pre-built dist/
```

## Project Structure

```
src/
├── pages/           # Route pages (Dashboard, Analytics, LeadExplorer, etc.)
├── components/      # UI components organized by domain
│   ├── layout/      # AppShell, Header, Sidebar, TimeRangeSelector
│   ├── dashboard/   # KPICards, SegmentFunnel, SyncStatus, etc.
│   ├── analytics/   # SentimentPanel, DiagnosticTab, PredictiveTab, etc.
│   ├── leads/       # ScoreBreakdown, SentimentCard, LeadAdvisorChat
│   ├── ab/          # ExecuteTestDialog, ExperimentDashboard
│   └── ui/          # shadcn/ui primitives
├── hooks/           # Custom hooks (useLeads, useBitrixPolling, useSentiment, etc.)
├── stores/          # Zustand stores (time range, sentiment, preferences, etc.)
├── lib/             # Core engines (ECS scoring, analytics, Bitrix poller, translation)
└── types/           # TypeScript type definitions
docs/                # Architecture documentation
scripts/             # ETL and data validation scripts
public/data/         # Static JSON data files from ETL
```

## Architecture Documentation

See the [`docs/`](docs/) folder:

- **[architecture.md](docs/architecture.md)** — System overview and key decisions
- **[data-flow.md](docs/data-flow.md)** — Data sources, caching, Bitrix24 polling details
- **[ecs-scoring.md](docs/ecs-scoring.md)** — ECS scoring engine, dimensions, decay model
- **[components.md](docs/components.md)** — Component map, state management, hooks
- **[deployment.md](docs/deployment.md)** — Azure infrastructure, deploy process, nginx config
- **[decisions.md](docs/decisions.md)** — Architectural Decision Records (ADRs)
