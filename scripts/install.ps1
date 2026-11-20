# AI Agency OS - installation Windows (PowerShell). Usage :
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "== AI Agency OS : installation ==" -ForegroundColor Cyan

$py = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $py = @("py", "-3") }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $py = @("python") }
if (-not $py) { Write-Host "Python introuvable. Installez Python 3.11+ depuis https://www.python.org (cochez 'Add to PATH')." -ForegroundColor Red; exit 1 }
& $py[0] $py[1..9] -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if ($LASTEXITCODE -ne 0) { Write-Host "Python 3.11+ requis." -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".venv")) { & $py[0] $py[1..9] -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip -q
& .\.venv\Scripts\python.exe -m pip install -e ".[api,dev]" -q
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host ".env créé (ajoutez vos clés plus tard)." }

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg absent : installation via winget..." -ForegroundColor Yellow
  try { winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements } catch { Write-Host "Installez ffmpeg : winget install Gyan.FFmpeg" -ForegroundColor Yellow }
  Write-Host "Fermez puis rouvrez le terminal si ffmpeg n'est pas encore détecté." -ForegroundColor Yellow
}
& .\.venv\Scripts\python.exe -m agency doctor
Write-Host "`nPour lancer : double-cliquez sur scripts\start.bat" -ForegroundColor Green
