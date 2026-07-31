import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(workspaceRoot, ".env"));

// Local defaults so mockup-sandbox does not require Replit env.
process.env.PORT ||= process.env.MOCKUP_PORT || "8082";
process.env.BASE_PATH ||= "/";
process.env.NODE_ENV ||= "development";

const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

console.log(
  `[mockup-sandbox] PORT=${process.env.PORT} BASE_PATH=${process.env.BASE_PATH}`,
);

const child = spawn(pnpmCmd, ["exec", "vite", "dev"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
