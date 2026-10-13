/**
 * The message a teacher posts to a class chat to hand out an exam.
 *
 * Pure and dependency-free so `node --test` can load it. The chat limit is
 * 4000 characters (api-server `MAX_BODY_LENGTH`); only the title can be long, so
 * that is what gets cut, never the code or the link.
 */
const MAX_BODY = 4000;
const MAX_TITLE = 200;

export function buildExamShareMessage(args: {
  title: string;
  shareCode: string;
  origin: string;
  lang: 'ar' | 'en';
}): string {
  const code = args.shareCode.trim();
  if (!code) throw new Error('An exam with no share code has nothing to share');

  const url = `${args.origin}/take/${code}`;
  const ar = args.lang === 'ar';
  const raw = args.title.trim();
  const title = raw.length > MAX_TITLE ? `${raw.slice(0, MAX_TITLE)}…` : raw;

  const lines = ar
    ? [
        title ? `📝 امتحان: ${title}` : '📝 امتحان جديد',
        'افتح الرابط واختر اسمك من القائمة:',
        url,
        `رمز الامتحان: ${code}`,
      ]
    : [
        title ? `📝 Exam: ${title}` : '📝 New exam',
        'Open the link and pick your name from the list:',
        url,
        `Exam code: ${code}`,
      ];
  return lines.join('\n').slice(0, MAX_BODY);
}
