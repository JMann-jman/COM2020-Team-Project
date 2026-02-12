$projectRoot = Split-Path -Parent $PSCommandPath
$python = Join-Path $projectRoot "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "venv not found. Run: python -m venv venv && .\venv\Scripts\pip install -r noise_pollution_app_backend\requirements.txt" -ForegroundColor Red
    exit 1
}

$backendPath = Join-Path $projectRoot "noise_pollution_app_backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; & '$python' backend_app.py"

$frontendPath = Join-Path $projectRoot "noise_pollution_app_frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; & '$python' app.py"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5000"