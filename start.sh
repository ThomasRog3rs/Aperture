#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Aperture – Linux bootstrap launcher
# Double-click this file or run: bash start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colour helpers ────────────────────────────────────────────────────────────
green()  { printf '\033[0;32m✅  %s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m⚠️   %s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m❌  %s\033[0m\n' "$*"; }
info()   { printf '\033[0;36mℹ️   %s\033[0m\n' "$*"; }

echo ""
echo "  ▄████████  ██████████  █████████  ████████▄  ███████████  ███    █▄  ████████▄  ██████████"
echo "  ██   ████ ████    ████ ███    ███ ███    ███ ███     ████ ███    ███ ███    ███ ████    ███"
echo "  ███   ███ ███        ██ ███    ███ ███    ███ ████████▀   ███    ███ ███    ███ ███   █████"
echo "  ▀████████ ███        ██ █████████  ███    ███ ███         ██████████ ███    ███ ████  █████"
echo "                                                                              Aperture Launcher"
echo ""

# ── Phase 1: Check Node.js ────────────────────────────────────────────────────
REQUIRED_NODE_MAJOR=18
NODE_OK=false

if command -v node &>/dev/null; then
  NODE_VERSION="$(node --version 2>/dev/null | sed 's/v//')"
  NODE_MAJOR="$(echo "$NODE_VERSION" | cut -d. -f1)"
  if [ "$NODE_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ] 2>/dev/null; then
    green "Node.js $NODE_VERSION is already installed."
    NODE_OK=true
  else
    yellow "Node.js $NODE_VERSION found, but version $REQUIRED_NODE_MAJOR or higher is required."
  fi
fi

# ── Phase 2: Install Node.js if missing ──────────────────────────────────────
if [ "$NODE_OK" = false ]; then
  info "Attempting to install Node.js automatically..."

  if command -v apt-get &>/dev/null; then
    info "Detected apt package manager (Debian/Ubuntu)."
    sudo apt-get update -qq
    sudo apt-get install -y nodejs npm
  elif command -v dnf &>/dev/null; then
    info "Detected dnf package manager (Fedora/RHEL)."
    sudo dnf install -y nodejs npm
  elif command -v yum &>/dev/null; then
    info "Detected yum package manager (CentOS/older RHEL)."
    sudo yum install -y nodejs npm
  elif command -v pacman &>/dev/null; then
    info "Detected pacman package manager (Arch Linux)."
    sudo pacman -Sy --noconfirm nodejs npm
  elif command -v zypper &>/dev/null; then
    info "Detected zypper package manager (openSUSE)."
    sudo zypper install -y nodejs npm
  else
    info "No known package manager found. Trying nvm (Node Version Manager)..."
    if ! command -v nvm &>/dev/null; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      # shellcheck disable=SC1090
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    if command -v nvm &>/dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
      export NVM_DIR="$HOME/.nvm"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      nvm install --lts
      nvm use --lts
    else
      red "Could not install Node.js automatically."
      echo ""
      echo "  Please install Node.js manually:"
      echo "  👉  https://nodejs.org/en/download"
      echo ""
      echo "  Then run this script again: bash start.sh"
      exit 1
    fi
  fi

  # Verify installation
  if command -v node &>/dev/null; then
    NODE_VERSION="$(node --version 2>/dev/null | sed 's/v//')"
    green "Node.js $NODE_VERSION installed successfully."
  else
    red "Node.js installation failed."
    echo "  Please install it manually from: https://nodejs.org/en/download"
    exit 1
  fi
fi

# ── Phase 3: Install npm dependencies ────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  info "Installing dependencies (this only happens once)..."
  if ! npm install; then
    red "Dependency installation failed."
    echo "  Make sure you have an internet connection and try again."
    echo "  If the problem persists, try: sudo npm install"
    exit 1
  fi
  green "Dependencies installed."
else
  green "Dependencies already installed."
fi

# ── Phase 4: Build the app (first run only) ───────────────────────────────────
BUILD_DIR=".next"
if [ ! -d "$BUILD_DIR" ]; then
  info "Building Aperture for the first time (this may take a minute)..."
  if ! npm run build; then
    red "Build failed. Please check the output above for errors."
    exit 1
  fi
  green "Build complete."
else
  green "App already built."
fi

# ── Phase 5: Find a free port ─────────────────────────────────────────────────
PORT=3000
for p in 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009; do
  if ! lsof -i:"$p" &>/dev/null 2>&1 && ! ss -tlnp 2>/dev/null | grep -q ":$p "; then
    PORT=$p
    break
  fi
done

# ── Phase 5: Start the server ─────────────────────────────────────────────────
info "Starting Aperture on port $PORT..."
PORT=$PORT npm start &
SERVER_PID=$!

# ── Wait for server to become ready ──────────────────────────────────────────
URL="http://localhost:$PORT"
MAX_WAIT=60
WAITED=0
printf "  Waiting for server"
while ! curl -s "$URL" -o /dev/null 2>/dev/null; do
  sleep 1
  WAITED=$((WAITED + 1))
  printf "."
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    echo ""
    red "Server did not start within ${MAX_WAIT}s."
    kill "$SERVER_PID" 2>/dev/null || true
    exit 1
  fi
done
echo ""

green "Aperture is running at $URL"
echo ""
echo "  Opening your browser..."
xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null || true
echo ""
echo "  Press Ctrl+C to stop Aperture."
echo ""

# Keep running until Ctrl+C
trap 'echo ""; info "Stopping Aperture..."; kill "$SERVER_PID" 2>/dev/null; exit 0' INT TERM
wait "$SERVER_PID"
