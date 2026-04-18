# ─────────────────────────────────────────────────────────────────────────────
# Aperture – Windows PowerShell bootstrap launcher
# Called automatically by start.bat, or run directly in PowerShell:
#   powershell -ExecutionPolicy Bypass -File start.ps1
# ─────────────────────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# ── Colour helpers ────────────────────────────────────────────────────────────
function Write-Ok    { param($msg) Write-Host "✅  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "⚠️   $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "❌  $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "ℹ️   $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "  Aperture Launcher" -ForegroundColor White
Write-Host ""

# ── Phase 1: Check Node.js ────────────────────────────────────────────────────
$RequiredNodeMajor = 18
$NodeOk = $false

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    $NodeVersionRaw = (node --version 2>&1) -replace "^v", ""
    $NodeMajor = [int]($NodeVersionRaw -split "\.")[0]
    if ($NodeMajor -ge $RequiredNodeMajor) {
        Write-Ok "Node.js $NodeVersionRaw is already installed."
        $NodeOk = $true
    } else {
        Write-Warn "Node.js $NodeVersionRaw found, but version $RequiredNodeMajor or higher is required."
    }
}

# ── Phase 2: Install Node.js if missing ──────────────────────────────────────
if (-not $NodeOk) {
    Write-Info "Attempting to install Node.js automatically..."

    $Installed = $false

    # Try winget first (Windows 10 21H2+ / Windows 11)
    $WingetCmd = Get-Command winget -ErrorAction SilentlyContinue
    if ($WingetCmd) {
        Write-Info "Using winget to install Node.js LTS..."
        try {
            winget install --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
            $Installed = $true
        } catch {
            Write-Warn "winget install failed, trying Chocolatey..."
        }
    }

    # Try Chocolatey
    if (-not $Installed) {
        $ChocoCmd = Get-Command choco -ErrorAction SilentlyContinue
        if ($ChocoCmd) {
            Write-Info "Using Chocolatey to install Node.js LTS..."
            try {
                choco install nodejs-lts -y
                $Installed = $true
            } catch {
                Write-Warn "Chocolatey install failed, trying direct download..."
            }
        }
    }

    # Fallback: direct MSI download
    if (-not $Installed) {
        Write-Info "Downloading Node.js LTS installer directly..."
        $Arch = if ([System.Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $MsiUrl = "https://nodejs.org/dist/latest-v20.x/node-v20.19.1-$Arch.msi"
        $MsiPath = "$env:TEMP\nodejs-lts.msi"
        try {
            Write-Info "Downloading from $MsiUrl ..."
            Invoke-WebRequest -Uri $MsiUrl -OutFile $MsiPath -UseBasicParsing
            Write-Info "Running installer silently..."
            Start-Process msiexec.exe -ArgumentList "/i `"$MsiPath`" /quiet /norestart" -Wait
            $Installed = $true
        } catch {
            Write-Err "Could not download or install Node.js automatically."
            Write-Host ""
            Write-Host "  Please install Node.js manually:" -ForegroundColor White
            Write-Host "  👉  https://nodejs.org/en/download" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "  Then double-click start.bat again." -ForegroundColor White
            Read-Host "  Press Enter to close"
            exit 1
        }
    }

    # Refresh PATH so node is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")

    $NodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($NodeCmd) {
        $NodeVersionRaw = (node --version 2>&1) -replace "^v", ""
        Write-Ok "Node.js $NodeVersionRaw installed successfully."
    } else {
        Write-Err "Node.js was installed but could not be found in PATH."
        Write-Host "  Please restart your computer and run start.bat again." -ForegroundColor White
        Read-Host "  Press Enter to close"
        exit 1
    }
}

# ── Phase 3: Install npm dependencies ────────────────────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing dependencies (this only happens once)..."
    try {
        npm install
        Write-Ok "Dependencies installed."
    } catch {
        Write-Err "Dependency installation failed."
        Write-Host "  Make sure you have an internet connection and try again." -ForegroundColor White
        Read-Host "  Press Enter to close"
        exit 1
    }
} else {
    Write-Ok "Dependencies already installed."
}

# ── Phase 4: Build the app (first run only) ───────────────────────────────────
if (-not (Test-Path ".next")) {
    Write-Info "Building Aperture for the first time (this may take a minute)..."
    try {
        npm run build
        Write-Ok "Build complete."
    } catch {
        Write-Err "Build failed. Please check the output above for errors."
        Read-Host "  Press Enter to close"
        exit 1
    }
} else {
    Write-Ok "App already built."
}

# ── Phase 5: Find a free port ─────────────────────────────────────────────────
$Port = 3000
foreach ($p in 3000..3009) {
    $TcpTest = Test-NetConnection -ComputerName localhost -Port $p -InformationLevel Quiet -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
    if (-not $TcpTest) {
        $Port = $p
        break
    }
}

# ── Phase 5: Start the server ─────────────────────────────────────────────────
Write-Info "Starting Aperture on port $Port..."
$env:PORT = $Port
$ServerProcess = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow

# ── Wait for server to become ready ──────────────────────────────────────────
$Url = "http://localhost:$Port"
$MaxWait = 60
$Waited = 0
Write-Host "  Waiting for server" -NoNewline
while ($true) {
    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        break
    } catch {
        Start-Sleep -Seconds 1
        $Waited++
        Write-Host "." -NoNewline
        if ($Waited -ge $MaxWait) {
            Write-Host ""
            Write-Err "Server did not start within ${MaxWait}s."
            Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
            Read-Host "  Press Enter to close"
            exit 1
        }
    }
}
Write-Host ""

Write-Ok "Aperture is running at $Url"
Write-Host ""
Write-Info "Opening your browser..."
Start-Process $Url
Write-Host ""
Write-Host "  Press Ctrl+C to stop Aperture." -ForegroundColor White
Write-Host ""

# Keep running until Ctrl+C
try {
    $ServerProcess.WaitForExit()
} finally {
    Write-Host ""
    Write-Info "Stopping Aperture..."
    Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
}
