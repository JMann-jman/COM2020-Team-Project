$projectRoot = Split-Path -Parent $PSCommandPath
$python = Join-Path $projectRoot "venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "venv not found. Creating virtual environment and installing dependencies..." -ForegroundColor Yellow

    $sysPythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $sysPythonCmd) {
        Write-Host "No system 'python' found in PATH. Please install Python 3 and rerun." -ForegroundColor Red
        exit 1
    }

    & $sysPythonCmd.Source -m venv (Join-Path $projectRoot 'venv')
    $python = Join-Path $projectRoot "venv\Scripts\python.exe"

    Write-Host "Upgrading pip in venv..."
    & $python -m pip install --upgrade pip

    Write-Host "Installing backend requirements..."
    & $python -m pip install -r (Join-Path $projectRoot 'noise_pollution_app_backend\requirements.txt')
}

$backendPath = Join-Path $projectRoot "noise_pollution_app_backend"
$backendCmd = "Set-Location '$backendPath'; & '" + $python + "' backend_app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

$frontendPath = Join-Path $projectRoot "noise_pollution_app_frontend"
$frontendCmd = "Set-Location '$frontendPath'; & '" + $python + "' app.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 3
Start-Process "http://localhost:5000"