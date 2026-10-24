/**
 * The mail a parent receives to approve their child's account. Pure (no logger, no fetch) so a test can load it;
 * `email.ts` wraps it in the shared shell and sends it.
 *
 * The child's first name is typed by the child, so it is escaped like every other interpolation here.
 */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const guardianConsentSubject =
  "طلب موافقة وليّ الأمر على حساب في إقرأ / Parent approval for an Iqrra account";

const BUTTON =
  "display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:bold;" +
  "padding:12px 24px;border-radius:8px;";

export function guardianConsentBodyHtml(childFirstName: string, link: string): string {
  // Isolated for bidi: an Arabic name inside the English sentence (and a Latin one inside the Arabic) must not
  // reorder the words around it.
  const name = `<bdi>${esc(childFirstName.trim() || "—")}</bdi>`;
  const href = esc(link);
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>أنشأ <b>${name}</b> حسابًا في «إقرأ»، وهي منصّة تساعد الطلبة في دروسهم وفق المنهاج الأردني. لا يعمل الحساب إلا بعد موافقتك بصفتك وليّ الأمر.</p>
      <p>بالضغط على «أوافق» في الصفحة التالية تؤكّد أنك وليّ أمر ${name} أو وصيّه القانوني، وأنك توافق على استخدامه منصّة «إقرأ» وفق شروط الاستخدام وسياسة الخصوصية. ويمكنك أيضًا الرفض من الصفحة نفسها.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${href}" style="${BUTTON}">مراجعة الطلب</a></p>
      <p>الرابط صالح 7 أيام ويُستخدم مرة واحدة فقط. إذا لم تكن تتوقّع هذه الرسالة فتجاهلها، ولن يُفعَّل الحساب.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hello,</p>
      <p><b>${name}</b> created a student account on Iqrra, a platform that helps pupils with their lessons in the Jordanian curriculum. The account does not work until you, as their parent or legal guardian, approve it.</p>
      <p>By pressing “Approve” on the next page you confirm that you are ${name}'s parent or legal guardian and that you agree to their using Iqrra under the terms of use and privacy policy. You can also decline on the same page.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${href}" style="${BUTTON}">Review the request</a></p>
      <p>This link works once and for 7 days. If you were not expecting this email, ignore it and the account will not be activated.</p>
    </div>
  `;
}
