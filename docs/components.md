# ECS ARA Comercial — Component Map

## Pages (Route → Component)

| Route | Page | Description |
|-------|------|-------------|
| `/` | `Dashboard` | Executive overview: KPIs, segment funnel, score trends, channel mix, activity feed, alerts, sync status |
| `/leads` | `LeadExplorer` | Searchable/filterable lead table with export (XLSX), segment/status filters, pagination |
| `/leads/:id` | `LeadProfile` | Detailed lead view: score breakdown radar, interaction timeline, sentiment card, AI advisor chat, score history |
| `/analytics` | `Analytics` | Tabbed analytics: Sentiment, Diagnostic, Predictive, Prescriptive |
| `/automation` | `Automation` | Workflow automation rules and triggers |
| `/ab-testing` | `ABTesting` | AI-generated A/B test recommendations with experiment tracking |
| `/settings` | `Settings` | API connections, ECS weight configuration, preferences, data management |

## Layout Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppShell` | `components/layout/` | Root layout: initializes Bitrix polling, renders Header + Sidebar + Outlet + Footer |
| `Header` | `components/layout/` | Top bar: sidebar toggle, time range selector, dark mode toggle, sentiment progress |
| `Sidebar` | `components/layout/` | Navigation menu with route links and icons |
| `Footer` | `components/layout/` | App footer |
| `TimeRangeSelector` | `components/layout/` | Global time filter pills (1 Semana, 1 Mes, 3 Meses, 6 Meses, Todo) |

## Dashboard Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `KPICards` | `leads` | Summary cards: total leads, avg score, segment distribution, trend arrows |
| `SegmentFunnel` | `leads` | Visual funnel of leads by segment (Champion → Dormant) |
| `ScoreTrendChart` | `leads` | Line chart of score distribution over time |
| `TopMovers` | `leads` | Leads with largest score changes (up/down) |
| `ChannelMixChart` | `interactions` | Pie chart of interaction channel distribution |
| `ActivityFeed` | `interactions` | Recent interactions timeline |
| `AlertsPanel` | `leads` | Leads requiring attention (score drops, inactivity) |
| `SyncStatus` | — | Bitrix24 polling status, last poll time, error display |
| `SentimentWidget` | `totalLeads` | Sentiment analysis progress indicator |

## Analytics Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `SentimentPanel` | `leads, interactions` | Batch sentiment analysis, distribution charts, leads-by-sentiment table (infinite scroll, clickable rows) |
| `DiagnosticTab` | `leads, interactions` | Score distribution, channel stats, employee leaderboard (all employees), interaction heatmap, funnel, brand comparison |
| `PredictiveTab` | `leads, interactions` | Score forecasts, churn risk analysis, conversion probability (clickable lead rows) |
| `PrescriptiveTab` | `leads, interactions` | Priority action queue with ROI calculator (clickable lead rows) |

## Lead Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `ScoreBreakdown` | `breakdown` | Radar chart (percentage-normalized) + score table |
| `InteractionTimeline` | `interactions` | Chronological interaction list with type icons |
| `SentimentCard` | `lead, interactions` | Per-lead AI sentiment analysis with translate-to-Spanish |
| `QuickActions` | `lead` | Action buttons (call, email, WhatsApp, schedule) |
| `LeadAdvisorChat` | `lead, interactions` | AI-powered conversion advisor chat widget |

## State Management

### Zustand Stores

| Store | File | Persistence | Purpose |
|-------|------|-------------|---------|
| `useTimeRangeStore` | `stores/` | localStorage | Global time filter (1w, 1m, 3m, 6m, all) |
| `useSentimentStore` | `stores/` | localStorage | Cached sentiment analysis results per lead |
| `useFilterStore` | `stores/` | — | Lead Explorer search/filter/sort/pagination state |
| `usePreferencesStore` | `stores/` | localStorage | Dark mode, UI preferences |
| `useExperimentStore` | `stores/` | localStorage | AB test experiment tracking data |

### React Query Keys

| Key | Source | Consumers |
|-----|--------|-----------|
| `["leads"]` | `/data/leads.json` + Bitrix merge | Dashboard, Analytics, LeadExplorer, ABTesting |
| `["interactions"]` | `/data/interactions.json` | Dashboard, Analytics |
| `["lead", id]` | Derived from `["leads"]` cache | LeadProfile |
| `["lead-interactions", id]` | `/data/interactions.json` filtered | LeadProfile |
| `["score-history", id]` | `/data/score_history.json` filtered | LeadProfile |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useLeads` / `useLead` | Fetch and cache leads data |
| `useInteractions` / `useLeadInteractions` | Fetch and cache interactions |
| `useECSScore` | Compute ECS breakdown from interactions |
| `useBitrixPolling` | Manage Bitrix24 webhook polling lifecycle |
| `useSentiment` | Batch sentiment analysis orchestration |
| `useTimeFilteredData` | Apply global time filter (interactions only; leads always full set) |
| `useScoreHistory` | Fetch longitudinal score data for a lead |
