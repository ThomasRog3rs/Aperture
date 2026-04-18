#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Aperture – macOS bootstrap launcher
# Double-click start.command in Finder, or run: bash start.command
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

  if command -v brew &>/dev/null; then
    info "Homebrew found. Installing Node.js via Homebrew..."
    brew install node
  else
    info "Homebrew not found. Installing Homebrew first..."
    echo ""
    echo "  Homebrew is a free package manager for macOS."
    echo "  It will be installed automatically — no admin password required for Homebrew itself."
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon
    if [ -f "/opt/homebrew/bin/brew" ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    if command -v brew &>/dev/null; then
      info "Homebrew installed. Installing Node.js..."
      brew install node
    else
      red "Could not install Homebrew automatically."
      echo ""
      echo "  Please install Node.js manually:"
      echo "  👉  https://nodejs.org/en/download"
      echo ""
      echo "  Then double-click start.command again."
      read -r -p "  Press Enter to close..."
      exit 1
    fi
  fi

  if command -v node &>/dev/null; then
    NODE_VERSION="$(node --version 2>/dev/null | sed 's/v//')"
    green "Node.js $NODE_VERSION installed successfully."
  else
    red "Node.js installation failed."
    echo "  Please install it manually from: https://nodejs.org/en/download"
    read -r -p "  Press Enter to close..."
    exit 1
  fi
fi

# ── Phase 3: Install npm dependencies ────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  info "Installing dependencies (this only happens once)..."
  if ! npm install; then
    red "Dependency installation failed."
    echo "  Make sure you have an internet connection and try again."
    read -r -p "  Press Enter to close..."
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
    read -r -p "  Press Enter to close..."
    exit 1
  fi
  green "Build complete."
else
  green "App already built."
fi

# ── Phase 5: Find a free port ─────────────────────────────────────────────────
PORT=3000
for p in 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009; do
  if ! lsof -i:"$p" &>/dev/null 2>&1; then
    PORT=$p
    break
  fi
done

# ── Phase 6: Start the server ─────────────────────────────────────────────────

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
    read -r -p "  Press Enter to close..."
    exit 1
  fi
done
echo ""

green "Aperture is running at $URL"
echo ""
echo "  Opening your browser..."
open "$URL"
echo ""
echo "  Press Ctrl+C to stop Aperture."
echo ""

# Keep running until Ctrl+C
trap 'echo ""; info "Stopping Aperture..."; kill "$SERVER_PID" 2>/dev/null; exit 0' INT TERM
wait "$SERVER_PID"
