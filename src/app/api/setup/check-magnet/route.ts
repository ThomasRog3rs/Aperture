import { exec } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execAsync = promisify(exec);

async function checkDocker(): Promise<boolean> {
  try {
    await execAsync("docker ps", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function checkPython(): Promise<string | null> {
  for (const cmd of ["python3", "python"]) {
    try {
      const { stdout } = await execAsync(`${cmd} --version`, { timeout: 5000 });
      const match = stdout.trim().match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major > 3 || (major === 3 && minor >= 9)) {
          return cmd;
        }
      }
    } catch {
      // not available
    }
  }
  return null;
}

export async function GET() {
  const [dockerAvailable, pythonCmd] = await Promise.all([checkDocker(), checkPython()]);

  return NextResponse.json({
    docker: dockerAvailable,
    python: pythonCmd !== null,
    pythonCmd,
    recommendation: dockerAvailable ? "docker" : pythonCmd ? "python" : "none",
  });
}
