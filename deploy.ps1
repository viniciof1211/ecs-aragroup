<#
.SYNOPSIS
    Deploy ECS Lead Intelligence to Azure Container Apps.
.DESCRIPTION
    Builds Docker image, pushes to ACR, and deploys to Azure Container Apps.
    Environment: cae-6uluhllxv7asm
    App Name: ecs-aragroupcr
    ACR: cr6uluhllxv7asm
    Resource Group: rg-cocinas-prod
    Location: East US 2
#>

param(
    [switch]$SkipBuild,
    [switch]$SkipPush,
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

# Configuration
$SubscriptionId = "fc30746c-e06a-42e3-98ab-f7d74ab3b360"
$ResourceGroupName = "rg-cocinas-prod"
$Location = "East US 2"
$AcrName = "cr6uluhllxv7asm"
$EnvironmentName = "cae-6uluhllxv7asm"
$AppName = "ecs-aragroupcr"
$ImageName = "ecs-aragroupcr"
$FullImageTag = "$AcrName.azurecr.io/${ImageName}:${Tag}"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ECS Lead Intelligence - Azure Deploy" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Subscription: $SubscriptionId" -ForegroundColor Gray
Write-Host "  Resource Group: $ResourceGroupName" -ForegroundColor Gray
Write-Host "  ACR: $AcrName" -ForegroundColor Gray
Write-Host "  Environment: $EnvironmentName" -ForegroundColor Gray
Write-Host "  App: $AppName" -ForegroundColor Gray
Write-Host "  Image: $FullImageTag" -ForegroundColor Gray
Write-Host ""

# Step 1: Set Azure subscription
Write-Host "[1/6] Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to set subscription. Run 'az login' first." -ForegroundColor Red
    exit 1
}
Write-Host "  Subscription set" -ForegroundColor Green

# Step 2: Local Vite build
if (-not $SkipBuild) {
    Write-Host "[2/6] Building app locally (npm run build)..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Vite build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Vite build complete" -ForegroundColor Green
} else {
    Write-Host '[2/6] Skipping local build (--SkipBuild)' -ForegroundColor DarkGray
}

# Step 3: Build and Push Docker image via ACR Build
if (-not $SkipPush) {
    Write-Host "[3/6] Building Docker image in ACR (cloud build)..." -ForegroundColor Yellow
    Write-Host "  Uploading dist/ + nginx.conf + Dockerfile + docker-entrypoint.sh..." -ForegroundColor Gray

    # Create a minimal build context with only what the Dockerfile needs
    $tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_ -Force; New-Item -ItemType Directory -Path $_ }
    try {
        Copy-Item -Path "dist" -Destination "$tempDir\" -Recurse
        Copy-Item -Path "nginx.conf" -Destination "$tempDir\"
        Copy-Item -Path "Dockerfile" -Destination "$tempDir\"
        Copy-Item -Path "docker-entrypoint.sh" -Destination "$tempDir\"

        Write-Host "  Starting ACR build..." -ForegroundColor Gray
        az acr build --registry $AcrName --image "${ImageName}:${Tag}" --file "$tempDir\Dockerfile" "$tempDir"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: ACR build failed." -ForegroundColor Red
            exit 1
        }
        Write-Host "  ACR build complete" -ForegroundColor Green
    } finally {
        Remove-Item -Path $tempDir -Recurse -Force
    }
} else {
    Write-Host '[3/6] Skipping ACR build (--SkipPush)' -ForegroundColor DarkGray
}

# Step 4: Ensure Container App Environment exists
Write-Host "[4/6] Ensuring Container App Environment exists..." -ForegroundColor Yellow
$envCheck = az containerapp env show --name $EnvironmentName --resource-group $ResourceGroupName --output json 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating Container App Environment..." -ForegroundColor Gray
    az containerapp env create --name $EnvironmentName --resource-group $ResourceGroupName --location "$Location"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create Container App Environment." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Environment created" -ForegroundColor Green
} else {
    Write-Host "  Environment exists" -ForegroundColor Green
}

# Step 5: Deploy or Update Container App
Write-Host "[5/6] Deploying Container App..." -ForegroundColor Yellow
$existingApp = az containerapp show --name $AppName --resource-group $ResourceGroupName --output json 2>$null

if ($LASTEXITCODE -ne 0) {
    # Create new Container App
    Write-Host "  Creating new Container App..." -ForegroundColor Gray
    # Read OpenRouter API key from .env file
    $OpenRouterKey = ""
    if (Test-Path ".env") {
        $envLine = Get-Content ".env" | Where-Object { $_ -match "^VITE_OPENROUTER_API_KEY=" }
        if ($envLine) { $OpenRouterKey = ($envLine -split "=", 2)[1].Trim() }
    }
    az containerapp create `
        --name $AppName `
        --resource-group $ResourceGroupName `
        --environment $EnvironmentName `
        --image $FullImageTag `
        --target-port 80 `
        --ingress external `
        --cpu 1.0 `
        --memory 2Gi `
        --min-replicas 1 `
        --max-replicas 3 `
        --env-vars "OPENROUTER_API_KEY=$OpenRouterKey" `
        --revision-suffix (Get-Date -Format "yyyyMMddHHmmss")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create Container App." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Container App created" -ForegroundColor Green
} else {
    # Update existing Container App
    Write-Host "  Updating existing Container App..." -ForegroundColor Gray
    # Read OpenRouter API key from .env file
    $OpenRouterKey = ""
    if (Test-Path ".env") {
        $envLine = Get-Content ".env" | Where-Object { $_ -match "^VITE_OPENROUTER_API_KEY=" }
        if ($envLine) { $OpenRouterKey = ($envLine -split "=", 2)[1].Trim() }
    }
    az containerapp update `
        --name $AppName `
        --resource-group $ResourceGroupName `
        --image $FullImageTag `
        --set-env-vars "OPENROUTER_API_KEY=$OpenRouterKey" `
        --revision-suffix (Get-Date -Format "yyyyMMddHHmmss")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to update Container App." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Container App updated" -ForegroundColor Green
}

# Step 6: Verify deployment
Write-Host "[6/6] Verifying deployment..." -ForegroundColor Yellow
$appInfo = az containerapp show --name $AppName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
$AppUrl = $appInfo.properties.configuration.ingress.fqdn
Write-Host "  App URL: https://$AppUrl" -ForegroundColor Green
Write-Host "  Health: https://$AppUrl/health" -ForegroundColor Gray

# Test health endpoint
Write-Host "  Testing health endpoint..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://$AppUrl/health" -TimeoutSec 30
    if ($response.StatusCode -eq 200) {
        Write-Host "  Health check passed" -ForegroundColor Green
    } else {
        Write-Host "  Health check returned $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App: https://$AppUrl" -ForegroundColor Cyan
Write-Host "  Health: https://$AppUrl/health" -ForegroundColor Gray
