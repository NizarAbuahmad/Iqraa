/**
 * A stand-in for the private R2 bucket, running in the test process. The built server (a child
 * process — startServer.ts) is pointed at it with R2_ENDPOINT, so a DB test can upload a photo
 * through the real route, read back the very bytes that were stored, and — as importantly —
 * assert which keys exist and which do not.
 *
 * Path-style only (`/<bucket>/<key>`); the server is told so by R2_FORCE_PATH_STYLE. Signatures
 * are not checked: the point is what the API stores and deletes, not AWS's auth.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface S3Stub {
  /** e.g. http://127.0.0.1:41234 */
  endpoint: string;
  keys(): string[];
  body(key: string): Buffer | undefined;
  /** Test-only: stores an object without going through the server, to seed what a route would have stored. */
  putForTest(key: string, body: Buffer): Promise<void>;
  close(): Promise<void>;
}

/** The SDK may send a PUT body as `aws-chunked`: `<hex size>;chunk-signature=…\r\n<data>\r\n … 0\r\n`. Store only the data. */
function decodeAwsChunked(buf: Buffer): Buffer {
  const parts: Buffer[] = [];
  let pos = 0;
  for (;;) {
    const lineEnd = buf.indexOf("\r\n", pos);
    if (lineEnd < 0) break;
    const size = parseInt(buf.toString("ascii", pos, lineEnd).split(";")[0]!, 16);
    if (!Number.isFinite(size) || size === 0) break;
    parts.push(buf.subarray(lineEnd + 2, lineEnd + 2 + size));
    pos = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(parts);
}

export async function startS3Stub(bucket = "iqraa-media"): Promise<S3Stub> {
  const objects = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const prefix = `/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    const chunks: Buffer[] = [];
    req.on("data", c => chunks.push(c as Buffer));
    req.on("end", () => {
      if (req.method === "PUT") {
        let body: Buffer = Buffer.concat(chunks);
        const encoding = String(req.headers["content-encoding"] ?? "");
        const sha = String(req.headers["x-amz-content-sha256"] ?? "");
        if (encoding.includes("aws-chunked") || sha.startsWith("STREAMING")) body = decodeAwsChunked(body);
        objects.set(key, body);
        res.statusCode = 200;
        res.setHeader("ETag", '"stub"');
        res.end();
      } else if (req.method === "GET") {
        const body = objects.get(key);
        if (!body) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/xml");
          res.end("<Error><Code>NoSuchKey</Code></Error>");
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Length", String(body.length));
        res.end(body);
      } else if (req.method === "DELETE") {
        objects.delete(key);
        res.statusCode = 204;
        res.end();
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    keys: () => [...objects.keys()].sort(),
    body: key => objects.get(key),
    putForTest: async (key, body) => {
      objects.set(key, body);
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

/** The env a server needs to talk to the stub — pass as `startServer({ env })`. */
export function s3Env(stub: S3Stub): Record<string, string> {
  return {
    R2_ENDPOINT: stub.endpoint,
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_FORCE_PATH_STYLE: "true",
  };
}
