[CmdletBinding()]
param(
  [int]$Port = 9222
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$extensionDir = Join-Path $repoRoot ".output\chrome-mv3"
$driverScript = Join-Path $PSScriptRoot "trigger-load-unpacked.mjs"

if (-not (Test-Path (Join-Path $extensionDir "manifest.json"))) {
  throw "Built extension was not found at '$extensionDir'. Run 'npm run build' first."
}

$senderScript = @"
param([string]`$PathToSend)
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Seconds 2
[System.Windows.Forms.SendKeys]::SendWait('%d')
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait(`$PathToSend)
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 1
[System.Windows.Forms.SendKeys]::SendWait('%s')
"@

$encodedSenderScript = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($senderScript))
$senderProcess = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList @(
    "-NoProfile",
    "-STA",
    "-EncodedCommand",
    $encodedSenderScript,
    $extensionDir
  ) `
  -WindowStyle Hidden `
  -PassThru

try {
  node $driverScript $Port
} finally {
  $senderProcess.WaitForExit()
}
