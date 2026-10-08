import { logger } from "./logger.ts";

/**
 * Shared chrome for every outgoing mail: logo + bilingual wordmark/tagline up
 * top, a light card around the message, a footer link back to the site. One
 * shell so a design tweak (or a future subject) touches one place instead of
 * every `render*Html` function separately.
 */
function renderEmailShell(bodyHtml: string): string {
  return `
    <div style="background:#F1F5F9;padding:24px 12px;font-family:Tahoma,Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B1220;">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" dir="rtl">
                <tr>
                  <td style="padding-inline-end:10px;vertical-align:middle;">
                    <img src="https://www.iqrra.com/icon-192.png" width="36" height="36" alt="إقرأ" style="display:block;border-radius:8px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:17px;font-weight:bold;color:#FFFFFF;line-height:1.3;">إقرأ <span style="font-weight:normal;color:#94A3B8;font-size:13px;">Iqrra</span></div>
                    <div style="font-size:12px;color:#94A3B8;line-height:1.4;">رفيقك في تحضير الحصص · AI Teaching Assistant</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <div style="padding:24px 20px;">
          ${bodyHtml}
        </div>
        <div style="padding:16px 20px;border-top:1px solid #E2E8F0;text-align:center;">
          <a href="https://www.iqrra.com" style="font-size:12px;color:#94A3B8;text-decoration:none;">iqrra.com</a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Sends the 6-digit signup verification code via Resend's REST API.
 *
 * Plain `fetch`, not the `resend` npm package — one POST call doesn't need a
 * dependency. Unset key means no email infra is configured (see
 * .env.example): the caller still creates the account and logs the code
 * instead, same "no key = degrade, don't fail" shape as the Unsplash/YouTube
 * integrations elsewhere in this app. The difference here is that a missing
 * key blocks the *user*, not just a nice-to-have photo — so this is
 * `[REQUIRED for registration in production]`, not merely optional.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // The code in the log is how local dev signs up; in production it would let
    // anyone with log access verify any address, so it never goes there.
    const loggable = process.env.NODE_ENV === "production" ? { to } : { to, code };
    logger.warn(loggable, "RESEND_API_KEY not set — verification email not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqrra <onboarding@resend.dev>",
        to,
        subject: "رمز تأكيد بريدك الإلكتروني في إقرأ / Your Iqrra verification code",
        html: renderVerificationEmailHtml(code),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend send threw");
    return false;
  }
}

function renderVerificationEmailHtml(code: string): string {
  return renderEmailShell(`
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>رمز تأكيد بريدك الإلكتروني في إقرأ هو:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#F1F5F9;border-radius:8px;padding:12px;text-align:center;">${code}</p>
      <p>يصلح هذا الرمز لمدة 15 دقيقة. إذا لم تطلب إنشاء حساب في إقرأ، يمكنك تجاهل هذه الرسالة.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hi,</p>
      <p>Your Iqrra email verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#F1F5F9;border-radius:8px;padding:12px;text-align:center;">${code}</p>
      <p>This code expires in 15 minutes. If you didn't create an Iqrra account, you can ignore this email.</p>
    </div>
  `);
}

/**
 * The password-reset code. Same transport, same failure posture and same
 * bilingual shape as the verification mail above — the difference is the
 * wording, because the two arrive in very different moments and a teacher who
 * asked for neither should be able to tell them apart at a glance.
 */
export async function sendPasswordResetEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Deliberately does NOT log the code. The verification path logs its own
    // so a developer can finish a signup with no mail configured; this one
    // resets an existing account's password, and a code in a log file is a
    // takeover waiting for whoever reads the log.
    logger.warn({ to }, "RESEND_API_KEY not set — password reset email not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqrra <onboarding@resend.dev>",
        to,
        subject: "رمز إعادة تعيين كلمة المرور في إقرأ / Your Iqrra password reset code",
        html: renderPasswordResetEmailHtml(code),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend password reset send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend password reset send threw");
    return false;
  }
}

/**
 * Sent instead of a code when /forgot-password matches an account that has
 * no password — it signed up with Google. The API response stays `{ok:true}`
 * either way (see auth.ts), so this costs nothing on the enumeration front:
 * only the inbox's owner ever reads which email they got.
 */
export async function sendGoogleAccountNoticeEmail(to: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ to }, "RESEND_API_KEY not set — google-account notice not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqrra <onboarding@resend.dev>",
        to,
        subject: "حسابك مرتبط بجوجل / Your account uses Google sign-in",
        html: renderGoogleAccountNoticeHtml(),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend google-account notice send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend google-account notice send threw");
    return false;
  }
}

function renderGoogleAccountNoticeHtml(): string {
  return renderEmailShell(`
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>طلب أحدهم (على الأرجح أنت) رمز إعادة تعيين كلمة مرور لهذا البريد، لكن حسابك في إقرأ لا يستخدم كلمة مرور — إنه مرتبط بحساب جوجل.</p>
      <p>سجّل الدخول من زر «المتابعة عبر جوجل» بدلاً من ذلك.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hi,</p>
      <p>Someone (probably you) asked to reset the password for this email, but your Iqrra account doesn't have a password — it's linked to Google sign-in.</p>
      <p>Use the "Continue with Google" button to sign in instead.</p>
    </div>
  `);
}

function renderPasswordResetEmailHtml(code: string): string {
  return renderEmailShell(`
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>رمز إعادة تعيين كلمة المرور في إقرأ هو:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#F1F5F9;border-radius:8px;padding:12px;text-align:center;">${code}</p>
      <p>يصلح هذا الرمز لمدة 15 دقيقة. إذا لم تطلب إعادة تعيين كلمة المرور فلا حاجة إلى فعل شيء، وكلمة مرورك الحالية تبقى كما هي.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hi,</p>
      <p>Your Iqrra password reset code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#F1F5F9;border-radius:8px;padding:12px;text-align:center;">${code}</p>
      <p>This code expires in 15 minutes. If you didn't ask to reset your password, there's nothing to do — your current password still works.</p>
    </div>
  `);
}

/**
 * `reason`/`lessonRef` ultimately trace back to a teacher's report and a
 * lesson id — neither is attacker-controlled today (no free-text field
 * exists yet), but this is the one place in the file that interpolates
 * anything other than a server-generated code, so it escapes rather than
 * assuming that stays true.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Tells a `system_admin` a teacher flagged a shared AI artifact. Same
 * transport and failure posture as every other email here: no key means no
 * send, logged and swallowed — the report itself must not depend on mail
 * being configured.
 */
export async function sendArtifactReportedEmail(
  to: string,
  info: { kind: string; lessonRef: string },
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ to }, "RESEND_API_KEY not set — artifact-report notice not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqrra <onboarding@resend.dev>",
        to,
        subject: "تقرير محتوى جديد بانتظار المراجعة / New content report awaiting review",
        html: renderArtifactReportedEmailHtml(info),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend artifact-report notice send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend artifact-report notice send threw");
    return false;
  }
}

function renderArtifactReportedEmailHtml(info: { kind: string; lessonRef: string }): string {
  const kind = escapeHtml(info.kind);
  const lessonRef = escapeHtml(info.lessonRef || "—");
  return renderEmailShell(`
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>أبلغ معلّم عن مشكلة في مادة مولَّدة بالذكاء الاصطناعي، وهي بانتظار مراجعتك.</p>
      <p><strong>النوع:</strong> ${kind}</p>
      <p><strong>الدرس:</strong> ${lessonRef}</p>
      <p>راجع البلاغ من لوحة الإدارة داخل التطبيق.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>A teacher reported a problem with an AI-generated ${kind}, awaiting your review.</p>
      <p><strong>Lesson:</strong> ${lessonRef}</p>
      <p>Review it from the admin dashboard in the app.</p>
    </div>
  `);
}
