/**
 * Boots the BUILT bundle (dist/index.mjs) as a child process against a given
 * database, on a port the OS picks. This is the same approach as mountOrder.test.ts —
 * source files use extensionless imports that only esbuild resolves — but
 * pointed at a real database so authenticated routes can be exercised.
 */
import { spawn } from "node:child_process";

import { bundleEntry, TEST_SESSION_SECRET } from "./env.ts";

export interface TestServer {
  /** e.g. http://127.0.0.1:41234/api */
  base: string;
  /** stdout+stderr of the server so far, for failure messages. */
  logs(): string;
  stop(): Promise<void>;
}

/**
 * The server binds PORT=0 itself and reports the port the OS gave it over IPC
 * (src/index.ts). It used to bind a port this function had picked and closed: in
 * that gap another test file, running in parallel, could start its own server on
 * the same port, `/healthz` answered from there, and every request in this file
 * reached the other file's database — seen in CI as a 401 «User not found» for a
 * user this file had just inserted.
 */
export async function startServer(opts: {
  databaseUrl: string;
  /** Extra/overriding env. A key set to `undefined` is REMOVED from the child's env. */
  env?: Record<string, string | undefined>;
}): Promise<TestServer> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: "0",
    DATABASE_URL: opts.databaseUrl,
    SESSION_SECRET: TEST_SESSION_SECRET,
    // chat.ts and generate.ts construct the OpenAI client at module scope.
    OPENAI_API_KEY: "sk-test-placeholder",
    // True in production; tests that need the flag off pass { STUDENT_ACCOUNTS: undefined }.
    STUDENT_ACCOUNTS: "true",
    // No DB test may ever reach Expo: port 9 is closed, so a push sent by a
    // test that did not ask for the stub fails at once (and is logged). Push
    // tests pass { EXPO_PUSH_URL: stub.url }.
    EXPO_PUSH_URL: "http://127.0.0.1:9/push-disabled-in-tests",
    // Quiet hours would change the channel and sound at night; tests must not
    // depend on the time of day. The rule itself is unit-tested.
    PUSH_QUIET_HOURS: "off",
  };
  for (const [key, value] of Object.entries(opts.env ?? {})) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const child = spawn(process.execPath, [bundleEntry], { env, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let logs = "";
  child.stdout?.on("data", d => {
    logs += String(d);
  });
  child.stderr?.on("data", d => {
    logs += String(d);
  });
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + 30_000;
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`server did not report its port within 30s:\n${logs.slice(-2000)}`));
    }, 30_000);
    child.on("message", (m: unknown) => {
      const listening = (m as { listening?: unknown } | null)?.listening;
      if (typeof listening === "number" && listening > 0) {
        clearTimeout(timer);
        resolve(listening);
      }
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error(`server exited during boot:\n${logs.slice(-2000)}`));
    });
  });
  // The port is known; the channel is not needed again, and an open one keeps this process alive.
  child.disconnect();
  const base = `http://127.0.0.1:${port}/api`;

  for (;;) {
    if (exited) throw new Error(`server exited during boot:\n${logs.slice(-2000)}`);
    try {
      const res = await fetch(`${base}/healthz`);
      if (res.ok) break;
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server did not start within 30s:\n${logs.slice(-2000)}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  return {
    base,
    logs: () => logs,
    async stop() {
      if (exited) return;
      await new Promise<void>(resolve => {
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}
