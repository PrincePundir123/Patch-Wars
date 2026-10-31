# Run browser checks in fresh-server batches without weakening API rate limits.
param([string]$Batch = 'all')
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectPath
if (Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Port 3002 is occupied. Stop the existing test server before running these isolated checks.'
}
$env:PORT = '3002'
$env:HOST = '127.0.0.1'
$env:WEB_ORIGIN = 'http://localhost:3002'
$env:ADMIN_KEY = 'ui-redesign-verification-key-local-only'
$env:NODE_ENV = 'development'
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3002'
New-Item -ItemType Directory -Force '.data/stream-verification' | Out-Null
$groups = @(
  @{ name = 'app'; files = @('app.spec.ts') },
  @{ name = 'workspace'; files = @('chat-dock.spec.ts', 'close-match.spec.ts', 'display.spec.ts') },
  @{ name = 'players'; files = @('live-experience.spec.ts', 'player-actions.spec.ts') },
  @{ name = 'streaming'; files = @('priorities.spec.ts', 'streaming.spec.ts', 'sunstone.spec.ts') }
)
foreach ($group in $groups) {
  if ($Batch -ne 'all' -and $group.name -notin $Batch.Split(',')) { continue }
  $streamServer = Start-Process -FilePath 'node' -ArgumentList 'dist/server/index.js' -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput ".data/stream-verification/$($group.name)-server.log" -RedirectStandardError ".data/stream-verification/$($group.name)-errors.log"
  try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      if ($streamServer.HasExited) { throw 'The isolated test server exited before startup.' }
      try { Invoke-RestMethod 'http://localhost:3002/health' | Out-Null; $ready = $true; break } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'The isolated test server did not become ready.' }
    Write-Output "Running $($group.name) browser batch"
    & pnpm.cmd exec playwright test @($group.files) --output "test-results/stream-$($group.name)"
    if ($LASTEXITCODE -ne 0) { throw "Browser batch failed: $($group.name)" }
  } finally {
    if (-not $streamServer.HasExited) { Stop-Process -Id $streamServer.Id; $streamServer.WaitForExit() }
  }
}
