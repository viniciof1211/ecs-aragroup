# ECS ARA Comercial — System Architecture

## Overview

**ECS (Engagement Continuum Score)** is a lead intelligence platform built for ARA Group Costa Rica. It ingests lead and interaction data from Bitrix24 CRM via webhook polling, computes a multi-dimensional engagement score, runs AI-powered sentiment analysis, and presents actionable analytics through a modern SPA dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                            │
│  React 19 · TypeScript · Vite 8 · Tailwind v4 · Recharts       │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Dashboard │ │Analytics │ │Lead      │ │AB Testing│           │
│  │  KPIs    │ │Sentiment │ │Explorer  │ │Generator │           │
│  │  Funnel  │ │Diagnostic│ │ Profile  │ │Experiment│           │
│  │  Trends  │ │Predictive│ │ Timeline │ │ Tracker  │           │
│  │  Alerts  │ │Prescribe │ │ Advisor  │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              State Management Layer                 │        │
│  │  Zustand Stores · React Query Cache · Persistence   │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ECS Engine   │  │ Sentiment    │  │ Analytics    │          │
│  │ Score Calc   │  │ AI Agent     │  │ Engine       │          │
│  │ Decay Model  │  │ Translation  │  │ Forecasting  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ /api/bitrix/ │   │ Modal.run    │   │ /data/*.json  │
  │ nginx proxy  │   │ Sentiment    │   │ Static ETL    │
  │ → Bitrix24   │   │ Agent API    │   │ Data Files    │
  └──────────────┘   └──────────────┘   └──────────────┘
```

## Deployment

- **Platform**: Azure Container Apps (East US 2)
- **Container**: nginx:alpine serving pre-built Vite dist/
- **Registry**: Azure Container Registry (`cr6uluhllxv7asm.azurecr.io`)
- **URL**: `https://ecs-aragroupcr.grayhill-769056ba.eastus2.azurecontainerapps.io`
- **Deploy script**: `deploy.ps1` — local build → Docker build → ACR push → Container App update
- **Health endpoint**: `/health` returns `{"status":"ok","app":"ecs-aragroupcr"}`

## Key Architectural Decisions

| Decision | Rationale | Tradeoff |
|----------|-----------|----------|
| Static JSON + Bitrix polling (no backend) | Zero server-side infra cost; ETL runs offline | No real-time DB; limited to polling interval |
| nginx reverse proxy for Bitrix24 | Avoids CORS from browser-direct calls | Webhook credentials embedded in nginx.conf |
| Zustand over Redux | Minimal boilerplate for 5 small stores | Less middleware ecosystem |
| React Query for data fetching | Built-in cache, stale-while-revalidate | Extra dependency; cache invalidation complexity |
| Client-side ECS scoring | No backend needed; instant recalculation | CPU-bound on large datasets in browser |
| Pattern-based Spanish translation | No external translation API dependency | Incomplete coverage; requires manual phrase additions |
| Time filter on interactions only | Leads always visible (Total = full dataset) | Time filter doesn't reduce lead counts in KPIs |
| Percentage-normalized radar chart | Accurate visual representation across different axis scales | Requires normalization layer |
