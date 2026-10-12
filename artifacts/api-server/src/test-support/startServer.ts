/**
 * Boots the BUILT bundle (dist/index.mjs) as a child process against a given
 * database, on a free port. This is the same approach as mountOrder.test.ts —
 * source files use extensionless imports that only esbuild resolves — but
 * pointed at a real database so authenticated routes can be exercised.
 */
import { spawn } from "node:child_process";
import net from "node:net";

import { bundleEntry, TEST_SESSION_SECRET } from "./env.ts";

export interface TestServer {
  /** e.g. http://127.0.0.1:41234/api */
  base: string;
  /** stdout+stderr of the server so far, for failure messages. */
  logs(): string;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer(opts: {
  databaseUrl: string;
  /** Extra/overriding env. A key set to `undefined` is REMOVED from the child's env. */
  env?: Record<string, string | undefined>;
}): Promise<TestServer> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/api`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: opts.databaseUrl,
    SESSION_SECRET: TEST_SESSION_SECRET,
    // chat.ts and generate.ts construct the OpenAI client at module scope.
    OPENAI_API_KEY: "sk-test-placeholder",
    // True in production; tests that need the flag off pass { STUDENT_ACCOUNTS: undefined }.
    STUDENT_ACCOUNTS: "true",
  };
  for (const [key, value] of Object.entries(opts.env ?? {})) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  const child = spawn(process.execPath, [bundleEntry], { env, stdio: ["ignore", "pipe", "pipe"] });
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
