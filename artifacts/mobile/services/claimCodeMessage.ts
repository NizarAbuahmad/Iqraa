/**
 * The message a teacher actually sends when sharing a student's link code.
 *
 * Until now the share button did not exist and the copy button put six bare
 * characters on the clipboard. A parent receiving `ABC234` and nothing else has
 * no idea what it is, where to type it, or that it expires. The exam flow next
 * door already learned this — `app/evaluations/[id]/index.tsx` copies a whole
 * URL "to paste into WhatsApp" rather than the code alone.
 *
 * ## Why this is not `services/parentMessage.ts`
 *
 * That composer is a different genre and, more importantly, it requires
 * `studentGender`: its output says «حضرة ولي أمر الطالبة». The roster does not
 * record gender, and `ai-tools/parent-message.tsx` says outright that guessing
 * it would misgender a real child. A screen that shares a code has no business
 * growing a gender picker to do it, so this composes without one — every
 * sentence here is gender-neutral by construction.
 *
 * ## Why no deep link
 *
 * `app.json`'s scheme is still the untouched Expo default and
 * `Linking.createURL` is called nowhere, so a real deep link means scheme
 * config on two platforms plus universal-link setup. A plain https link into
 * the web build teachers are actually demoed on costs nothing and works today.
 * When `origin` is absent — native, where there is no `window` — the line is
 * dropped rather than emitted half-formed.
 *
 * Pure by design: no react-native import, so `node --test` can load it. Same
 * reason `routeGating.ts` and `messageMerge.ts` live apart from their screens.
 */

export interface ClaimCodeMessageInput {
  studentName: string;
  code: string;
  /** Already localised by the caller — this module formats no dates. */
  expiresOn: string;
  /** Where the app is served. Absent on native; the whole line is then dropped. */
  origin?: string;
  teacherName?: string;
  /**
   * What the sign-up field is actually labelled, passed in rather than
   * hardcoded. The teacher's screen and the parent's form once called this
   * two different things, which sent parents hunting for a label that did not
   * exist; passing the real label means renaming it cannot silently re-open
   * that gap — `claimCodeMessage.test.ts` asserts the two agree.
   */
  fieldLabel: string;
}

/** Joins non-empty blocks, so a dropped clause leaves no blank run. */
function paragraphs(blocks: Array<string | null>): string {
  return blocks.filter((b): b is string => !!b).join('\n\n');
}

export function composeClaimCodeMessage(input: ClaimCodeMessageInput, isAr: boolean): string {
  const { studentName, code, expiresOn, origin, teacherName, fieldLabel } = input;

  if (isAr) {
    return paragraphs([
      'السلام عليكم ورحمة الله وبركاته،',
      `يمكنكم متابعة أخبار ${studentName} والتواصل معي داخل تطبيق اقرأ.`,
      // The code sits alone on its line, unpunctuated, so a long-press in
      // WhatsApp selects it and nothing else.
      `${fieldLabel}:\n${code}`,
      `ينتهي في: ${expiresOn}`,
      origin ? `افتح ${origin} ثم «إنشاء حساب»، واختر «وليّ أمر»، وأدخل الرمز أعلاه.` : null,
      teacherName ? `وتفضّلوا بقبول فائق الاحترام،\n${teacherName}` : 'وتفضّلوا بقبول فائق الاحترام،',
    ]);
  }

  return paragraphs([
    'Hello,',
    `You can follow ${studentName}'s progress and message me inside the Iqraa app.`,
    `${fieldLabel}:\n${code}`,
    `Expires: ${expiresOn}`,
    origin ? `Open ${origin}, choose "Create account", pick "Parent", and enter the code above.` : null,
    teacherName ? `Kind regards,\n${teacherName}` : 'Kind regards,',
  ]);
}
