# Build Script for Development (PowerShell)
# Builds all required packages in the correct order

Write-Host "🏗️  Building packages for development..." -ForegroundColor Cyan
Write-Host "This will take a few minutes. Please be patient.`n" -ForegroundColor Yellow

$packages = @(
    # Core dependencies (order matters!)
    '@ottabase/config',
    '@ottabase/db',
    '@ottabase/utils',
    '@ottabase/ui-base',
    '@ottabase/ui-code-highlight',
    '@ottabase/ui-shadcn',
    '@ottabase/ui-components',
    '@ottabase/ui-mantine',

    # Auth package (CRITICAL - this is what's causing the error!)
    '@ottabase/auth',

    # Other dependencies
    '@ottabase/api',
    '@ottabase/cf',
    '@ottabase/cf-realtime',
    '@ottabase/ottaorm',
    '@ottabase/ottaselect',
    '@ottabase/forms',
    '@ottabase/state',
    '@ottabase/ottaeditor',
    '@ottabase/ottarenderer'
)

$successCount = 0
$failedPackages = @()

foreach ($pkg in $packages) {
    Write-Host "📦 Building $pkg..." -ForegroundColor Blue
    try {
        pnpm --filter $pkg build 2>&1 | Out-Null
        $successCount++
        Write-Host "✅ $pkg built successfully`n" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to build $pkg`n" -ForegroundColor Red
        $failedPackages += $pkg
    }
}

Write-Host "`n$('=' * 60)" -ForegroundColor Gray
Write-Host "`n✨ Build complete!" -ForegroundColor Cyan
Write-Host "   - $successCount/$($packages.Count) packages built successfully"

if ($failedPackages.Count -gt 0) {
    Write-Host "`n⚠️  Failed packages:" -ForegroundColor Yellow
    foreach ($pkg in $failedPackages) {
        Write-Host "   - $pkg"
    }
    Write-Host "`nTry building these manually with:" -ForegroundColor Yellow
    Write-Host "pnpm --filter <package-name> build"
} else {
    Write-Host "`n🎉 All packages built successfully!" -ForegroundColor Green
    Write-Host "`nYou can now start the dev servers:"
    Write-Host "   Terminal 1: pnpm dev:fe"
    Write-Host "   Terminal 2: pnpm dev:be"
}

Write-Host "`n$('=' * 60)`n" -ForegroundColor Gray

# Verify critical files exist
$criticalFile = Join-Path $PSScriptRoot "packages\auth\dist\client-api.mjs"
if (Test-Path $criticalFile) {
    Write-Host "✅ Critical file verified: packages\auth\dist\client-api.mjs" -ForegroundColor Green

    # Check if it exports getSession
    $content = Get-Content $criticalFile -Raw
    if ($content -match "getSession") {
        Write-Host "✅ getSession export verified!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: getSession export not found in client-api.mjs" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Critical file missing: packages\auth\dist\client-api.mjs" -ForegroundColor Red
    Write-Host "   Please run: pnpm --filter @ottabase/auth build"
}

Write-Host ""
