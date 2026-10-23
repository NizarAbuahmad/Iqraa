/**
 * The logic of holdScopedConnection, with its collaborators passed in so it can be
 * tested without a database (importing @workspace/db throws without DATABASE_URL).
 * The real wiring is middlewares/holdScopedConnection.ts.
 */
export interface HeldScope {
  end(failed?: boolean): Promise<void>;
  stats(): { statements: number; heldMs: number };
}

export interface HeldDeps<S extends HeldScope> {
  identity(): { userId: string; role: string } | undefined;
  /** A held scope for this caller, or undefined (enforcement off). */
  open(identity: { userId: string; role: string }): S | undefined;
  run<T>(scope: S, fn: () => T): T;
  log(info: { route: string; statements: number; heldMs: number }): void;
}

export interface HeldReq {
  method: string;
  originalUrl?: string;
  url?: string;
}

export interface HeldRes {
  once(event: "finish" | "close", cb: () => void): unknown;
}

export function makeHoldScopedConnection<S extends HeldScope>(deps: HeldDeps<S>) {
  return function holdScopedConnection(req: HeldReq, res: HeldRes, next: () => void): void {
    const identity = deps.identity();
    // Only reads are held (the scope is READ ONLY), and only for a known caller; anything
    // else, and enforcement off, runs the handler on the ordinary per-statement path.
    const scope = req.method === "GET" && identity ? deps.open(identity) : undefined;
    if (!scope) {
      next();
      return;
    }
    const route = `${req.method} ${(req.originalUrl ?? req.url ?? "").split("?")[0]}`;
    let ended = false;
    // `finish` after a normal response, `close` when the client hangs up first. The scope is
    // captured here: a `close` callback does not inherit the request's async store.
    const done = () => {
      if (ended) return;
      ended = true;
      // An end() that rejects is swallowed and the log still runs; the final catch keeps a
      // throwing log from becoming an unhandled rejection.
      void scope
        .end()
        .then(() => undefined, () => undefined)
        .then(() => deps.log({ route, ...scope.stats() }))
        .catch(() => undefined);
    };
    res.once("finish", done);
    res.once("close", done);
    deps.run(scope, next);
  };
}
