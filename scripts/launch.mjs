#!/usr/bin/env node
// scripts/launch.mjs
// Cross-platform launcher for users who already have Node installed.
// Run with: npm run launch
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { createConnection } from "node:net";

const isWindows = platform() === "win32";
const isMac = platform() === "darwin";

function green(msg) { process.stdout.write(`\x1b[32m✅  ${msg}\x1b[0m\n`); }
function red(msg) { process.stdout.write(`\x1b[31m❌  ${msg}\x1b[0m\n`); }
function info(msg) { process.stdout.write(`\x1b[36mℹ️   ${msg}\x1b[0m\n`); }

console.log("\n  Aperture Launcher\n");

// ── Phase 1: Check Node.js version ────────────────────────────────────────────
const nodeVersion = process.versions.node;
const nodeMajor = parseInt(nodeVersion.split(".")[0], 10);
if (nodeMajor < 18) {
  red(`Node.js ${nodeVersion} is too old. Please install Node.js 18 or higher.`);
  console.log("  👉  https://nodejs.org/en/download\n");
  process.exit(1);
}
green(`Node.js ${nodeVersion} detected.`);

// ── Phase 2: Install dependencies ─────────────────────────────────────────────
if (!existsSync("node_modules")) {
  info("Installing dependencies (this only happens once)...");
  try {
    execSync("npm install", { stdio: "inherit" });
    green("Dependencies installed.");
  } catch {
    red("Dependency installation failed. Make sure you have an internet connection.");
    process.exit(1);
  }
} else {
  green("Dependencies already installed.");
}

// ── Phase 3: Build if needed ──────────────────────────────────────────────────
if (!existsSync(".next")) {
  info("Building Aperture for the first time (this may take a minute)...");
  try {
    execSync("npm run build", { stdio: "inherit" });
    green("Build complete.");
  } catch {
    red("Build failed. Please check the output above.");
    process.exit(1);
  }
} else {
  green("App already built.");
}

// ── Phase 4: Find a free port ─────────────────────────────────────────────────
async function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = createConnection(port, "localhost");
    socket.on("connect", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => resolve(true));
  });
}

async function findFreePort() {
  for (let p = 3000; p <= 3009; p++) {
    if (await isPortFree(p)) return p;
  }
  return 3000;
}

const port = await findFreePort();

// ── Phase 5: Start server ─────────────────────────────────────────────────────
info(`Starting Aperture on port ${port}...`);
const env = { ...process.env, PORT: String(port) };
const server = spawn("npm", ["start"], { env, stdio: "pipe", shell: isWindows });

// ── Wait for server to respond ────────────────────────────────────────────────
const url = `http://localhost:${port}`;
const maxWait = 60;
let waited = 0;
process.stdout.write("  Waiting for server");

await new Promise((resolve, reject) => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) {
        clearInterval(interval);
        resolve();
      }
    } catch {
      waited++;
      process.stdout.write(".");
      if (waited >= maxWait) {
        clearInterval(interval);
        reject(new Error("Timed out waiting for server"));
      }
    }
  }, 1000);
});
console.log("");

green(`Aperture is running at ${url}`);
info("Opening your browser...");

// Open browser
if (isMac) execSync(`open ${url}`);
else if (isWindows) execSync(`start ${url}`, { shell: true });
else execSync(`xdg-open ${url} 2>/dev/null || true`, { shell: true });

console.log("\n  Press Ctrl+C to stop Aperture.\n");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n");
  info("Stopping Aperture...");
  server.kill();
  process.exit(0);
});
process.on("SIGTERM", () => { server.kill(); process.exit(0); });

server.on("exit", () => process.exit(0));
