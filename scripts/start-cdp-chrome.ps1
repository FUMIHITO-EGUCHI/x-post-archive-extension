[CmdletBinding()]
param(
  [int]$Port = 9223,
  [string]$ProfileDirName = ".codex-cdp-profile-2",
  [switch]$ResetProfile,
  [switch]$SkipExtension
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-BrowserExecutable {
  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Chrome executable was not found."
}

function Wait-ForCdp {
  param(
    [Parameter(Mandatory = $true)]
    [int]$PortNumber
  )

  $versionUrl = "http://127.0.0.1:$PortNumber/json/version"
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      return Invoke-RestMethod -Uri $versionUrl
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "CDP endpoint did not respond on port $PortNumber."
}

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$browserPath = Find-BrowserExecutable
$profileDir = Join-Path $repoRoot $ProfileDirName
$extensionDir = Join-Path $repoRoot ".output\chrome-mv3"

if (-not $SkipExtension -and -not (Test-Path (Join-Path $extensionDir "manifest.json"))) {
  throw "Built extension was not found at '$extensionDir'. Run 'npm run build' first."
}

Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

if ($ResetProfile -and (Test-Path $profileDir)) {
  Remove-Item -LiteralPath $profileDir -Recurse -Force
}

$isNewProfile = -not (Test-Path $profileDir)

if (-not (Test-Path $profileDir)) {
  New-Item -ItemType Directory -Path $profileDir | Out-Null
}

# Phase 1: If this is a new profile, enable Chrome developer mode before loading the extension.
# Chrome stable requires developer mode to be enabled in the profile for --load-extension to work.
# Note: --disable-extensions-except is NOT allowed in Chrome stable and is silently ignored.
if ($isNewProfile -and -not $SkipExtension) {
  Write-Host "New profile detected. Enabling developer mode..." -ForegroundColor Yellow

  $setupArgs = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  )

  Start-Process -FilePath $browserPath -ArgumentList $setupArgs | Out-Null
  Wait-ForCdp -PortNumber $Port | Out-Null

  $nodeScript = Join-Path $PSScriptRoot "enable-dev-mode.mjs"
  $devModeOutput = node $nodeScript $Port 2>&1
  Write-Host "Developer mode: $devModeOutput" -ForegroundColor Yellow

  # enable-dev-mode.mjs closes Chrome gracefully via Browser.close CDP command.
  # Wait for the process to fully exit before restarting.
  Start-Sleep -Seconds 3
  Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
}

# Phase 2: Start Chrome with extension loaded.
$argumentList = @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=$profileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank"
)

if (-not $SkipExtension) {
  $argumentList += "--load-extension=$extensionDir"
}

Start-Process -FilePath $browserPath -ArgumentList $argumentList | Out-Null

$versionInfo = Wait-ForCdp -PortNumber $Port
$targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list"

# Identify our extension by its service_worker URL ending in /background.js.
# Built-in Chrome component extensions (Google Network Speech etc.) use /service_worker.js,
# so /background.js uniquely identifies the extension defined in this repository.
$extensionTarget = $targets | Where-Object { $_.type -eq "service_worker" -and $_.url -like "chrome-extension://*/background.js" } | Select-Object -First 1
$extensionId = $null

if ($null -ne $extensionTarget -and $extensionTarget.url -match "^chrome-extension://([^/]+)/") {
  $extensionId = $matches[1]
}

Write-Host ""
Write-Host "CDP is ready." -ForegroundColor Green
Write-Host "Browser: $($versionInfo.Browser)"
Write-Host "Port: $Port"
Write-Host "Profile: $profileDir"
Write-Host "CDP endpoint: http://127.0.0.1:$Port"
Write-Host "Browser WebSocket: $($versionInfo.webSocketDebuggerUrl)"

if ($SkipExtension) {
  Write-Host "Extension loading: skipped"
} elseif ($null -ne $extensionId) {
  Write-Host "Extension ID: $extensionId"
  Write-Host "Viewer URL: chrome-extension://$extensionId/viewer.html"
} else {
  Write-Warning "Chrome started, but the extension service worker was not detected."
  Write-Warning "Try running with -ResetProfile to re-initialize the developer mode setup."
}
