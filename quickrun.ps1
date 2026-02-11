$projectRoot = Split-Path -Parent $PSCommandPath

$backendPath = Join-Path $projectRoot "noise_pollution_app_backend"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; python backend_app.py"

$frontendPath = Join-Path $projectRoot "noise_pollution_app_frontend"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; python app.py"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5000"
