import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, workspaceRoot } from "../../../scripts/load-env.mjs";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(workspaceRoot, ".env");
loadEnvFile(envFile);

process.env.NODE_ENV ||= "development";
process.env.PORT ||= "8080";

const isWin = process.platform === "win32";
const pnpmCmd = isWin ? "pnpm.cmd" : "pnpm";

function run(command, args, { useShell = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: artifactDir,
    env: process.env,
    stdio: "inherit",
    // Only use shell for .cmd shims. Never shell-spawn node.exe — paths with
    // spaces (e.g. C:\Program Files\nodejs\node.exe) break under cmd.exe.
    shell: useShell,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[api-server] NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
run(pnpmCmd, ["run", "build"], { useShell: isWin });

const nodeArgs = ["--enable-source-maps", "./dist/index.mjs"];
if (existsSync(envFile)) {
  nodeArgs.unshift("--env-file", envFile);
}
run(process.execPath, nodeArgs, { useShell: false });
