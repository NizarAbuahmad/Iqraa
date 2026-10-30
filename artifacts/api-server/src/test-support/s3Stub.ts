/**
 * A stand-in for the private R2 bucket, running in the test process. The built server (a child
 * process — startServer.ts) is pointed at it with R2_ENDPOINT, so a DB test can upload a photo
 * through the real route, read back the very bytes that were stored, and — as importantly —
 * assert which keys exist and which do not.
 *
 * Path-style only (`/<bucket>/<key>`); the server is told so by R2_FORCE_PATH_STYLE. Signatures
 * are not checked: the point is what the API stores and deletes, not AWS's auth. It also answers
 * ListObjectsV2 (`GET /<bucket>?list-type=2`), with a page size a test can shrink to force paging.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface S3Stub {
  /** e.g. http://127.0.0.1:41234 */
  endpoint: string;
  keys(): string[];
  body(key: string): Buffer | undefined;
  /** Test-only: stores an object without going through the server, to seed what a route would have stored. `lastModified` defaults to now. */
  putForTest(key: string, body: Buffer, lastModified?: Date): Promise<void>;
  /** When the object was stored (or seeded), if it exists. */
  lastModified(key: string): Date | undefined;
  /** How many ListObjectsV2 requests the stub has answered — proof that a listing really paged. */
  listRequests(): number;
  close(): Promise<void>;
}

export interface S3StubOptions {
  /** The most keys one ListObjectsV2 answer carries, whatever `max-keys` asks for. Default 1000, like S3. */
  pageSize?: number;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** An opaque continuation token: the last key returned, base64url so it survives a query string. */
const encodeToken = (key: string): string => Buffer.from(key, "utf8").toString("base64url");
const decodeToken = (token: string): string => Buffer.from(token, "base64url").toString("utf8");

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

export async function startS3Stub(bucket = "iqraa-media", options: S3StubOptions = {}): Promise<S3Stub> {
  const pageSize = options.pageSize ?? 1000;
  const objects = new Map<string, { body: Buffer; lastModified: Date }>();
  let listCount = 0;

  /** ListObjectsV2: `GET /<bucket>?list-type=2&prefix=&max-keys=&continuation-token=`. */
  function listObjectsV2(url: URL, res: http.ServerResponse): void {
    listCount++;
    const prefix = url.searchParams.get("prefix") ?? "";
    const requested = Number(url.searchParams.get("max-keys") ?? pageSize);
    const maxKeys = Math.max(1, Math.min(pageSize, Number.isFinite(requested) ? requested : pageSize));
    const token = url.searchParams.get("continuation-token");
    const after = token ? decodeToken(token) : null;
    const matching = [...objects.keys()].filter(k => k.startsWith(prefix) && (after === null || k > after)).sort();
    const page = matching.slice(0, maxKeys);
    const truncated = matching.length > page.length;
    const contents = page
      .map(k => {
        const o = objects.get(k)!;
        return (
          `<Contents><Key>${xmlEscape(k)}</Key><LastModified>${o.lastModified.toISOString()}</LastModified>` +
          `<ETag>&quot;stub&quot;</ETag><Size>${o.body.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`
        );
      })
      .join("");
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">` +
      `<Name>${xmlEscape(bucket)}</Name><Prefix>${xmlEscape(prefix)}</Prefix><KeyCount>${page.length}</KeyCount>` +
      `<MaxKeys>${maxKeys}</MaxKeys><IsTruncated>${truncated}</IsTruncated>` +
      (truncated ? `<NextContinuationToken>${encodeToken(page[page.length - 1]!)}</NextContinuationToken>` : "") +
      contents +
      `</ListBucketResult>`;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml");
    res.end(xml);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    if (req.method === "GET" && (url.pathname === `/${bucket}` || url.pathname === `/${bucket}/`)) {
      if (url.searchParams.get("list-type") === "2") {
        listObjectsV2(url, res);
      } else {
        res.statusCode = 400;
        res.end();
      }
      return;
    }
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
        objects.set(key, { body, lastModified: new Date() });
        res.statusCode = 200;
        res.setHeader("ETag", '"stub"');
        res.end();
      } else if (req.method === "GET") {
        const body = objects.get(key)?.body;
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
    body: key => objects.get(key)?.body,
    putForTest: async (key, body, lastModified = new Date()) => {
      objects.set(key, { body, lastModified });
    },
    lastModified: key => objects.get(key)?.lastModified,
    listRequests: () => listCount,
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
