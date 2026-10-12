/**
 * One HTTP call to a test server, as a given user (or none). A body, when
 * given, goes as JSON. Shared by the DB-backed route tests.
 */
import { accessToken } from "./tokens.ts";
import type { TestServer } from "./startServer.ts";

export interface CallResult {
  status: number;
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

export async function call(
  server: TestServer,
  method: string,
  path: string,
  userId?: string,
  body?: unknown,
): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (userId) headers["Authorization"] = `Bearer ${accessToken(userId)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}
