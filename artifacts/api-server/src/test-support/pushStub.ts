/**
 * A stand-in for Expo's push endpoint, running in the test process. The built
 * server (a child process — startServer.ts) is pointed at it with
 * EXPO_PUSH_URL, so every message it would have sent to Expo lands here
 * instead, and a DB test can assert who was pushed, what it said, on which
 * channel — and, as importantly, who was not.
 *
 * A message is recorded when its request ARRIVES, before any delayed answer.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StubMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: "default" | null;
  badge?: number;
}

export interface PushStub {
  /** e.g. http://127.0.0.1:41234/push */
  url: string;
  /** Everything received since the last clear(), in arrival order. */
  messages(): StubMessage[];
  clear(): void;
  /** Answer DeviceNotRegistered for this token from now on. */
  markDead(token: string): void;
  /** Answer the next request with this HTTP status (default 500) and record nothing from it. */
  failNext(status?: number): void;
  /** Hold the answer to the next request for `ms`. */
  delayNext(ms: number): void;
  /** Resolve with every message once `pred` holds; reject after `timeoutMs` (default 3000). */
  waitFor(pred: (all: StubMessage[]) => boolean, timeoutMs?: number): Promise<StubMessage[]>;
  /** Wait `ms` (default 300) for stragglers, then return everything received. */
  settle(ms?: number): Promise<StubMessage[]>;
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function startPushStub(): Promise<PushStub> {
  let received: StubMessage[] = [];
  const dead = new Set<string>();
  let failStatus: number | null = null;
  let delayMs = 0;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => {
      raw += String(chunk);
    });
    req.on("end", () => {
      if (failStatus !== null) {
        const status = failStatus;
        failStatus = null;
        res.writeHead(status, { "Content-Type": "text/plain" });
        res.end("stub failure");
        return;
      }
      let batch: StubMessage[];
      try {
        batch = JSON.parse(raw) as StubMessage[];
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("bad json");
        return;
      }
      received.push(...batch);
      const data = batch.map((m, i) =>
        dead.has(m.to)
          ? { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }
          : { status: "ok", id: `ticket-${received.length - batch.length + i}` },
      );
      const wait = delayMs;
      delayMs = 0;
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data }));
      }, wait);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/push`,
    messages: () => [...received],
    clear() {
      received = [];
    },
    markDead(token) {
      dead.add(token);
    },
    failNext(status = 500) {
      failStatus = status;
    },
    delayNext(ms) {
      delayMs = ms;
    },
    async waitFor(pred, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (pred(received)) return [...received];
        if (Date.now() > deadline) {
          throw new Error(`push stub: waited ${timeoutMs}ms; received ${JSON.stringify(received).slice(0, 2000)}`);
        }
        await sleep(50);
      }
    },
    async settle(ms = 300) {
      await sleep(ms);
      return [...received];
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
