/**
 * A stand-in for Resend's batch endpoint, running in the test process. The built
 * server (a child process — startServer.ts) is pointed at it with RESEND_API_URL
 * and a fake RESEND_API_KEY, so a DB test can assert exactly who would have been
 * mailed, and what, without any mail leaving the machine.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StubMail {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface ResendStub {
  /** e.g. http://127.0.0.1:41234 — the value for RESEND_API_URL. */
  url: string;
  /** Every mail accepted since the last clear(), in arrival order. */
  mails(): StubMail[];
  clear(): void;
  /** Refuse the next request, whatever it is, with this status (default 500) and record nothing from it. */
  failNext(status?: number): void;
  close(): Promise<void>;
}

export async function startResendStub(): Promise<ResendStub> {
  let received: StubMail[] = [];
  let failStatus: number | null = null;

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
      if (req.method !== "POST" || req.url !== "/emails/batch") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not the batch endpoint");
        return;
      }
      try {
        received.push(...(JSON.parse(raw) as StubMail[]));
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("bad json");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    mails: () => [...received],
    clear() {
      received = [];
    },
    failNext(status = 500) {
      failStatus = status;
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
