import { logger } from "./logger.ts";

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
    logger.warn({ to, code }, "RESEND_API_KEY not set — verification code logged instead of emailed");
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
        from: process.env.RESEND_FROM_EMAIL ?? "Iqraa <onboarding@resend.dev>",
        to,
        subject: "رمز تأكيد بريدك الإلكتروني في إقرأ / Your Iqraa verification code",
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
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>رمز تأكيد بريدك الإلكتروني في إقرأ هو:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>يصلح هذا الرمز لمدة 15 دقيقة. إذا لم تطلب إنشاء حساب في إقرأ، يمكنك تجاهل هذه الرسالة.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hi,</p>
      <p>Your Iqraa email verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
      <p>This code expires in 15 minutes. If you didn't create an Iqraa account, you can ignore this email.</p>
    </div>
  `;
}
