param(
  [switch]$NoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Cleaning dist folder..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

Write-Host "Building nodes..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  throw "Build failed."
}

Write-Host "Copying icons..." -ForegroundColor Cyan
$iconMap = @{
    "Project.png" = "KumihoProject"
    "Space.png" = "KumihoSpace"
    "Graph.png" = "KumihoGraph"
    "Revision.png" = "KumihoRevision"
    "Item.png" = "KumihoItem"
    "Artifact.png" = "KumihoArtifact"
    "Bundle.png" = "KumihoBundle"
    "Search.png" = "KumihoSearch"
    "ResolveKref.png" = "KumihoResolveKref"
    "EventStream.png" = "KumihoEventStream"
}

foreach ($icon in $iconMap.Keys) {
    $source = Join-Path $projectRoot "nodes\images\$icon"
    $destDir = Join-Path $projectRoot "dist\nodes\$($iconMap[$icon])"
    $dest = Join-Path $destDir $icon
    
    if (Test-Path $source) {
        if (Test-Path $destDir) {
            Copy-Item -Path $source -Destination $dest -Force
            Write-Host "Copied $icon to $destDir" -ForegroundColor Green
        } else {
            Write-Host "Destination directory $destDir does not exist." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Icon $source not found." -ForegroundColor Yellow
    }
}

$customDir = Join-Path $env:USERPROFILE ".n8n\\custom"

if (-not (Test-Path $customDir)) {
  New-Item -ItemType Directory -Force -Path $customDir | Out-Null
}

Set-Location $customDir

if (-not (Test-Path "package.json")) {
  Write-Host "Initializing custom directory..." -ForegroundColor Cyan
  npm init -y
}

# Remove any existing link/install
if (Test-Path "node_modules/n8n-nodes-kumiho") {
    Write-Host "Removing existing package from custom directory..." -ForegroundColor Cyan
    npm uninstall n8n-nodes-kumiho
}

# Also clean up the official nodes directory where UI-installed nodes go
$officialNodesDir = Join-Path $env:USERPROFILE ".n8n\\nodes"
if (Test-Path "$officialNodesDir\\node_modules\\n8n-nodes-kumiho") {
    Write-Host "Removing duplicate from official nodes directory..." -ForegroundColor Cyan
    Remove-Item -Path "$officialNodesDir\\node_modules\\n8n-nodes-kumiho" -Recurse -Force
}

Write-Host "Packing and installing..." -ForegroundColor Cyan
# 1. Create a tarball of the project (avoids symlink issues)
$tarball = npm pack "$projectRoot"

if (-not (Test-Path $tarball)) {
    throw "Failed to create tarball: $tarball"
}

# 2. Install from the tarball
npm install $tarball --omit=peer

# 3. Clean up tarball
Remove-Item $tarball

# 4. Remove n8n-workflow to avoid instance conflicts (peer dependency issue)
if (Test-Path "node_modules/n8n-workflow") {
    Write-Host "Removing local n8n-workflow to prevent conflicts..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "node_modules/n8n-workflow"
}

# Verify installation
$installedDist = Join-Path "node_modules/n8n-nodes-kumiho" "dist"
if (-not (Test-Path $installedDist)) {
    Write-Warning "INSTALLED PACKAGE IS MISSING DIST FOLDER!"
    Get-ChildItem "node_modules/n8n-nodes-kumiho"
} else {
    Write-Host "Verified dist folder exists in installed package." -ForegroundColor Green
}

if (-not $NoStart) {
  Write-Host "Starting n8n..." -ForegroundColor Cyan
  Write-Host "IMPORTANT: If nodes don't show up, please HARD REFRESH your browser (Ctrl+F5)" -ForegroundColor Yellow
  $env:N8N_LOG_LEVEL = 'debug'
  $env:N8N_LOG_OUTPUT = 'console'
  
  # Try letting n8n discover it naturally in the custom folder first
  # If that fails, uncomment the line below to force it
  $env:N8N_CUSTOM_EXTENSIONS = Join-Path $customDir "node_modules"
  Write-Host "N8N_CUSTOM_EXTENSIONS: $env:N8N_CUSTOM_EXTENSIONS" -ForegroundColor Cyan
  
  # Allow access to ComfyUI output and local n8n files
  $env:N8N_RESTRICT_FILE_ACCESS_TO = "$env:USERPROFILE\.n8n-files;C:\ComfyUI\output"
  Write-Host "N8N_RESTRICT_FILE_ACCESS_TO: $env:N8N_RESTRICT_FILE_ACCESS_TO" -ForegroundColor Cyan
  
  npx -y n8n@latest
}
