# ECS ARA Comercial — Deployment Guide

## Infrastructure

| Component | Service | Details |
|-----------|---------|---------|
| **App Hosting** | Azure Container Apps | `ecs-aragroupcr` in `cae-6uluhllxv7asm` environment |
| **Container Registry** | Azure Container Registry | `cr6uluhllxv7asm.azurecr.io/ecs-aragroupcr:latest` |
| **Resource Group** | `rg-cocinas-prod` | Subscription `fc30746c-e06a-42e3-98ab-f7d74ab3b360` |
| **Region** | East US 2 | |
| **Scale** | 1–3 replicas | 0.5 vCPU, 1 GiB RAM per replica |

## Live URLs

- **App**: https://ecs-aragroupcr.grayhill-769056ba.eastus2.azurecontainerapps.io
- **Health**: https://ecs-aragroupcr.grayhill-769056ba.eastus2.azurecontainerapps.io/health

## Deploy Process

The `deploy.ps1` script automates the full pipeline:

```
[1] Vite build (tsc + vite build → dist/)
[2] Docker build (copies dist/ + nginx.conf into nginx:alpine)
[3] ACR push (az acr build → cr6uluhllxv7asm.azurecr.io)
[4] Container App environment check
[5] Container App create/update
[6] Health check verification
```

### Quick Deploy (skip local build if already built)

```powershell
.\deploy.ps1 -SkipBuild
```

### Full Deploy

```powershell
.\deploy.ps1
```

## Dockerfile

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Pre-built approach: Vite builds locally, Docker just copies static files into nginx.

## nginx Configuration

Key features of `nginx.conf`:

| Feature | Config |
|---------|--------|
| **SPA fallback** | `try_files $uri $uri/ /index.html` |
| **Gzip** | Enabled for JSON, JS, CSS, SVG (level 6, min 1000 bytes) |
| **Static asset caching** | 1 year, `immutable` for JS/CSS/images |
| **Data file caching** | 5 min, `must-revalidate` for `/data/*.json` |
| **Bitrix24 proxy** | `/api/bitrix/` → `proxy_pass https://hogaresfuncionales.bitrix24.es/rest/...` |
| **Health endpoint** | `/health` returns `{"status":"ok"}` |

### Bitrix24 Proxy (CORS Solution)

The browser cannot call Bitrix24 directly due to CORS. Both dev and prod use a proxy:

- **Production (nginx)**: `location /api/bitrix/` with `proxy_pass`, `proxy_ssl_server_name on`, forwards `Content-Type` and `Content-Length` headers for POST bodies
- **Development (Vite)**: `server.proxy` in `vite.config.ts` rewrites `/api/bitrix` → `/rest/9946/...`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_BITRIX_WEBHOOK_URL` | `/api/bitrix` | Bitrix24 webhook URL (uses proxy by default) |
| `VITE_POLL_INTERVAL_SECONDS` | `180` | Bitrix polling interval in seconds |
| `VITE_SENTIMENT_API_URL` | Modal.run URL | Sentiment analysis API endpoint |
| `VITE_SUPABASE_URL` | — | Supabase project URL (optional) |
| `VITE_SUPABASE_ANON_KEY` | — | Supabase anon key (optional) |
