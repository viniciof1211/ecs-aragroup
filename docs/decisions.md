# ECS ARA Comercial — Architectural Decision Records (ADRs)

## ADR-001: Static JSON + Client-Side Polling (No Backend)

**Status**: Accepted  
**Date**: 2026-02-18

**Context**: The platform needs to display lead data from Bitrix24 CRM. Options were: (a) build a backend API server, (b) use Bitrix24 MCP server, (c) use static ETL data + direct webhook polling.

**Decision**: Use pre-processed static JSON files from ETL as the base dataset, supplemented by client-side Bitrix24 webhook polling every 180 seconds for live updates.

**Consequences**:
- ✅ Zero server-side infrastructure cost (only nginx serving static files)
- ✅ Instant deployment — no database migrations, no API versioning
- ✅ Works offline with cached data
- ❌ No real-time push updates (polling only)
- ❌ Large initial JSON payload (~17K leads) loaded in browser
- ❌ ETL must be re-run manually for historical data refresh

---

## ADR-002: nginx Reverse Proxy for Bitrix24 CORS

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: Browser-direct calls to `hogaresfuncionales.bitrix24.es` fail with CORS errors. Initial implementation used direct fetch which worked in some browsers but failed in production.

**Decision**: Route all Bitrix24 API calls through `/api/bitrix/` which nginx (prod) and Vite dev server (dev) proxy to the actual webhook URL.

**Consequences**:
- ✅ Eliminates all CORS issues in both dev and prod
- ✅ Webhook credentials not exposed in client-side JavaScript
- ❌ Webhook credentials embedded in `nginx.conf` (acceptable for internal tool)
- ❌ Adds latency from double-hop (browser → nginx → Bitrix24)

---

## ADR-003: POST with URL-Encoded Nested Params for Bitrix24 API

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: Initial implementation sent Bitrix24 API parameters as JSON-stringified query strings via GET, which returned HTTP 400 errors.

**Decision**: Use POST method with `application/x-www-form-urlencoded` body, encoding nested objects as `order[DATE_MODIFY]=DESC`, `select[0]=ID`, etc. via custom `toBitrixParams()` encoder.

**Consequences**:
- ✅ Bitrix24 REST API accepts the requests correctly
- ✅ Handles complex nested filters and field selections
- ❌ Custom encoder needed (no standard library for Bitrix24's format)

---

## ADR-004: Time Filter Applies to Interactions Only, Not Leads

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: Initial global time filter implementation filtered both leads and interactions by date, causing "Total Leads = 1" when most leads had no recent activity.

**Decision**: The global time filter only filters **interactions** (for time-based charts like activity feed, channel mix, heatmap). Leads are **never filtered out** — KPIs, funnels, and tables always show the full dataset. An `activeLeads` subset is available for "active in period" metrics.

**Consequences**:
- ✅ Total Leads always reflects the true dataset size (17K+)
- ✅ KPIs, segment funnels, and lead tables are always complete
- ✅ Time-based charts (activity, channel mix) correctly reflect the selected period
- ❌ Time filter has no visible effect on lead-count KPIs (by design)

---

## ADR-005: Percentage-Normalized Radar Chart for ECS Breakdown

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: The ECS score breakdown radar chart used a fixed domain `[0, 25]` for all axes, but dimensions have different maximums (Recency 25, Frequency 25, Depth 25, Channels 15, Velocity 10). This caused Velocity 5/10 (50%) to render at the same visual size as Recency 5/25 (20%).

**Decision**: Normalize all values to percentages (0–100) before rendering: `pct = (value / max) × 100`. The domain is `[0, 100]` for all axes. The table below the chart still shows raw values (e.g., "5/10").

**Consequences**:
- ✅ Each axis accurately represents the proportion of its own maximum
- ✅ Visual shape correctly reflects relative engagement strengths
- ❌ Axis labels don't show raw values (mitigated by the table below)

---

## ADR-006: Pattern-Based Spanish Translation (No External API)

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: The Modal.run sentiment AI agent returns results in mixed English/Spanish text. A translation layer is needed for the Spanish-speaking user base.

**Decision**: Use a client-side pattern-based translation engine (`translate-es.ts`) with 200+ regex phrase mappings. Always apply translations (never skip based on detected language, since text is mixed). Multi-word phrases are matched before single words.

**Consequences**:
- ✅ No external translation API dependency or cost
- ✅ Instant translation, no network latency
- ✅ Handles mixed English/Spanish text correctly
- ❌ Incomplete coverage — new English phrases from the AI require manual dictionary additions
- ❌ No grammatical awareness (word-by-word replacement)

---

## ADR-007: Clickable Lead Rows in Analytics Tables

**Status**: Accepted  
**Date**: 2026-02-19

**Context**: Analytics tables (Sentiment, Predictive, Prescriptive) displayed lead names as plain text with no way to navigate to the detailed lead view.

**Decision**: All lead rows in analytics tables are clickable, navigating to `/leads/{id}`. Lead names are styled with primary color and hover underline to indicate interactivity.

**Consequences**:
- ✅ Seamless navigation from analytics insights to lead details
- ✅ Consistent UX pattern across all analytics tabs
- ❌ Entire row is clickable (may interfere with future per-cell actions)

---

## ADR-008: Zustand for State Management

**Status**: Accepted  
**Date**: 2026-02-18

**Context**: The app needs global state for time filter, sentiment results, user preferences, experiment tracking, and lead explorer filters. Options: Redux, Zustand, Jotai, Context API.

**Decision**: Use Zustand with `persist` middleware for stores that need localStorage persistence.

**Consequences**:
- ✅ Minimal boilerplate (~10 lines per store)
- ✅ Built-in persistence middleware
- ✅ No provider wrappers needed
- ✅ Works well with React 19
- ❌ Less middleware ecosystem than Redux
- ❌ No built-in devtools (though zustand/devtools exists)

---

## ADR-009: Infinite Scroll for Sentiment Leads Table

**Status**: Accepted  
**Date**: 2026-02-18

**Context**: The "Leads por Sentimiento" table initially had a hard `.slice(0, 50)` limit, preventing users from seeing all analyzed leads.

**Decision**: Replace the fixed limit with infinite scroll: start with 50 visible rows, load 50 more when the user scrolls near the bottom. Uses a scroll event handler on the container div.

**Consequences**:
- ✅ All leads are accessible without pagination controls
- ✅ Initial render is fast (only 50 rows)
- ✅ Progressive loading feels natural
- ❌ No virtualization (acceptable for sentiment-analyzed subset, typically < 1000 leads)

---

## ADR-010: Employee Leaderboard Shows All Employees

**Status**: Accepted  
**Date**: 2026-02-18

**Context**: The "Rendimiento por Empleado" chart in the Diagnostic tab was limited to top 10 employees via `.slice(0, 10)`.

**Decision**: Remove the slice limit and show all employees, sorted by average score descending.

**Consequences**:
- ✅ Complete visibility into all employee performance
- ✅ No arbitrary cutoff that might hide underperformers
- ❌ Table may be long if there are many employees (mitigated by scroll)
