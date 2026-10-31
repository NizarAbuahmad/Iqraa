/**
 * GET|POST /email/unsubscribe?t= and POST /email/resubscribe?t= — the link at
 * the foot of every email the API sends (lib/emailUnsubscribe.ts). No session:
 * the person may have no account, and the encrypted token is the credential.
 * An altered or invented token gets the same neutral "not valid" page.
 *
 * GET only *asks* — a mail scanner that pre-fetches links would otherwise
 * unsubscribe everyone it scans. The button POSTs here, and so does a mail
 * client's own one-click «Unsubscribe» (`List-Unsubscribe-Post`, RFC 8058).
 * The confirmation offers an undo, because sign-in codes keep coming but
 * nothing else does, and a mis-tap should not cost someone their invites.
 *
 * Every path starts `/email/`, so mounting this router at the root shadows
 * nothing (mountOrder.test.ts).
 */
import { Router } from "express";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { escapeHtml, readEmailUnsubscribeToken, unsubscribePage } from "../lib/emailUnsubscribe.ts";
import { suppressEmail, unsuppressEmail } from "../lib/emailSuppression.ts";

const router = Router();
const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 120, name: "email-unsubscribe" });

const invalid = unsubscribePage('<p>هذا الرابط غير صالح.</p><p dir="ltr">This link is not valid.</p>');
const failed = unsubscribePage('<p>تعذّر إتمام الطلب. حاول مرة أخرى لاحقًا.</p><p dir="ltr">Something went wrong. Please try again later.</p>');

// The token is base64url (checked by readEmailUnsubscribeToken), so it is safe in an attribute as-is.
const form = (path: string, t: string, label: string, quiet = false) =>
  `<form method="post" action="/api/email/${path}?t=${t}"><button type="submit"${quiet ? ' class="quiet"' : ""}>${label}</button></form>`;

router.get("/email/unsubscribe", limiter, (req, res) => {
  const t = req.query["t"];
  const email = readEmailUnsubscribeToken(t);
  if (!email) {
    res.status(400).type("html").send(invalid);
    return;
  }
  const shown = `<bdi dir="ltr">${escapeHtml(email)}</bdi>`;
  res.type("html").send(
    unsubscribePage(
      `<p>هل تريد إيقاف رسائل إقرأ إلى ${shown}؟</p><p dir="ltr">Stop Iqrra emails to ${shown}?</p>` +
        form("unsubscribe", t as string, "إلغاء الاشتراك · Unsubscribe"),
    ),
  );
});

router.post("/email/unsubscribe", limiter, async (req, res) => {
  const t = req.query["t"];
  const email = readEmailUnsubscribeToken(t);
  if (!email) {
    res.status(400).type("html").send(invalid);
    return;
  }
  // A mail client's one-click POST says so in its body; the page's button sends none.
  const oneClick = (req.body as Record<string, unknown> | undefined)?.["List-Unsubscribe"] === "One-Click";
  try {
    await suppressEmail(email, oneClick ? "one-click" : "link");
    logger.info({ source: oneClick ? "one-click" : "link" }, "email address unsubscribed");
    res.type("html").send(
      unsubscribePage(
        "<p>تم إلغاء اشتراكك، ولن نراسلك على هذا البريد بعد الآن. يُستثنى من ذلك رمزٌ تطلبه أنت لإنشاء حساب أو لاستعادة كلمة المرور، فبدونه لا تصل إلى حسابك.</p>" +
          "<p dir=\"ltr\">You're unsubscribed, and we won't email this address again — except a code you ask for yourself to create an account or reset a password, without which you could not reach your account.</p>" +
          form("resubscribe", t as string, "تراجع · Undo", true),
      ),
    );
  } catch (err) {
    logger.error({ err }, "email unsubscribe failed");
    res.status(500).type("html").send(failed);
  }
});

router.post("/email/resubscribe", limiter, async (req, res) => {
  const email = readEmailUnsubscribeToken(req.query["t"]);
  if (!email) {
    res.status(400).type("html").send(invalid);
    return;
  }
  try {
    await unsuppressEmail(email);
    logger.info("email address resubscribed");
    res.type("html").send(unsubscribePage('<p>عاد اشتراكك، وستصلك رسائل إقرأ كما كانت.</p><p dir="ltr">You\'re subscribed again.</p>'));
  } catch (err) {
    logger.error({ err }, "email resubscribe failed");
    res.status(500).type("html").send(failed);
  }
});

export default router;
