/**
 * The rules that decide whether an abuse report may name the target it names,
 * with no database attached.
 *
 * Split out for the same reason as claimDecision.ts: `@workspace/db` throws at
 * import when DATABASE_URL is unset and builds a pg.Pool when it is, so a test
 * reaching these rules through routes/messaging.ts would need a live database,
 * and this repo has none. These are trust-boundary rules, so "untestable
 * forever" was not an acceptable place to leave them.
 *
 * What they guard: `POST /messaging/reports` checked that the *reporter* was a
 * participant of the thread and then trusted `reportedUserId` and `messageId`
 * from the body verbatim. `PATCH /moderation/reports/:id` acts on those two
 * fields directly — suspending `report.reportedUserId` and archiving
 * `report.messageId` — so a reporter in any thread could name a teacher they
 * had never spoken to, and a message from a thread they could not see, and an
 * approving admin would carry it out. The admin has no signal in the tool that
 * the target is unrelated to the complaint: the report renders the same either
 * way.
 *
 * The lookups arrive as functions rather than precomputed booleans so the
 * message lookup runs only when a message was actually named, and so a test
 * hands over a plain stub.
 */

export type ReportErrorCode =
  | "report_thread_not_found"
  | "report_target_not_in_thread"
  | "report_message_not_in_thread";

export type ReportResolution =
  | { ok: true }
  | { ok: false; status: number; error: string; code: ReportErrorCode };

/**
 * The rejections. English strings with a code beside them, per the contract
 * claimDecision.ts states: this app is Arabic-first, so a client that printed
 * `error` would put an English sentence in an Arabic screen — branch on `code`.
 */
const THREAD_NOT_FOUND = {
  ok: false,
  status: 404,
  code: "report_thread_not_found",
  error: "Thread not found",
} as const;

/*
 * 400 rather than 404, and deliberately specific: the reporter is already a
 * participant of this thread, so they can see its member list and its messages
 * anyway. Saying "that person is not in this thread" tells them nothing they
 * could not already read, and a vague error here would look like a client bug
 * to whoever hits it legitimately.
 */
const TARGET_NOT_IN_THREAD = {
  ok: false,
  status: 400,
  code: "report_target_not_in_thread",
  error: "The reported user is not a participant of this thread",
} as const;

const MESSAGE_NOT_IN_THREAD = {
  ok: false,
  status: 400,
  code: "report_message_not_in_thread",
  error: "That message does not belong to this thread",
} as const;

export async function resolveReport(args: {
  threadId: string;
  reporterUserId: string;
  reportedUserId: string;
  /** Null when the report is about a participant rather than one message. */
  messageId: string | null;
  /** Whether a user is a participant of `threadId`. */
  isParticipant: (userId: string) => Promise<boolean>;
  /** The thread a message belongs to, or null when no such message exists. */
  threadIdOfMessage: (messageId: string) => Promise<string | null>;
}): Promise<ReportResolution> {
  if (!(await args.isParticipant(args.reporterUserId))) return THREAD_NOT_FOUND;

  // The rule the route was missing. Checked against the same thread the
  // reporter was just admitted to, so a group thread admits anyone in the
  // group and a direct thread admits only the other side.
  if (!(await args.isParticipant(args.reportedUserId))) return TARGET_NOT_IN_THREAD;

  if (args.messageId !== null) {
    // A message id from another thread is the half of this that moderation
    // acts on without ever consulting the thread: `hideMessage` archives
    // `report.messageId` by id alone.
    const owning = await args.threadIdOfMessage(args.messageId);
    if (owning !== args.threadId) return MESSAGE_NOT_IN_THREAD;
  }

  return { ok: true };
}
