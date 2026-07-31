import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(workspaceRoot, ".env"));

// Root .env uses PORT for the API (8080). Expo should use a separate port.
const mobilePort = process.env.MOBILE_PORT || process.env.EXPO_PORT || "8081";
process.env.PORT = mobilePort;

// Prefer an explicit local API base URL. Keep Replit-style EXPO_PUBLIC_DOMAIN
// behavior when that variable is already set by the environment.
if (!process.env.EXPO_PUBLIC_API_BASE_URL && !process.env.EXPO_PUBLIC_DOMAIN) {
  const apiPort = process.env.API_PORT || "8080";
  process.env.EXPO_PUBLIC_API_BASE_URL = `http://localhost:${apiPort}/api`;
}

const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";
const extraArgs = process.argv.slice(2).filter((arg) => arg !== "--");

console.log(
  `[mobile] PORT=${process.env.PORT}` +
    (process.env.EXPO_PUBLIC_API_BASE_URL
      ? ` EXPO_PUBLIC_API_BASE_URL=${process.env.EXPO_PUBLIC_API_BASE_URL}`
      : "") +
    (process.env.EXPO_PUBLIC_DOMAIN
      ? ` EXPO_PUBLIC_DOMAIN=${process.env.EXPO_PUBLIC_DOMAIN}`
      : ""),
);

const child = spawn(
  pnpmCmd,
  ["exec", "expo", "start", "--localhost", "--port", process.env.PORT, ...extraArgs],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: isWin,
  },
);

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
