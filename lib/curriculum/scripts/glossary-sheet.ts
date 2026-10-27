/**
 * Prints the teacher's review sheets for the glossary:
 *  1. the DRAFT definitions (a model wrote them; shown to nobody until signed off), one row per term;
 *  2. the TERMS of the printed-glossary entries that are served, to skim for a misspelt or reversed term
 *     (the PDF extraction mangles those most, and the term is the answer a student taps).
 *   pnpm --filter @workspace/curriculum run glossary-sheet > sheet.md
 */
import { draftGlossary, isSignedOff, servedGlossary } from '../src/glossary.ts';
import { getBookById } from '../src/catalog.ts';

const cell = (s: string) => s.replace(/\|/g, '\\|');
const drafts = draftGlossary();
const signed = drafts.filter(isSignedOff).length;
const printed = servedGlossary().filter(e => e.source === 'book-glossary');
const bookTitle = (id: string) => getBookById(id)?.titleAr ?? id;

const lines = [
  '# مراجعة تعريفات المصطلحات — كيمياء الصف العاشر، الفصل الأول',
  '',
  'هذه التعريفات **مسوّدة** كتبها نموذج لغوي، ولم تُنقل من الكتاب. لا تظهر للطلبة إلا بعد أن يعتمدها معلّم.',
  'قارِن كل تعريف بالكتاب، وعدّله إن لزم، ثم اكتب «اعتُمد» أو «يُعدَّل» أو «يُرفض».',
  '',
  `المعتمد حتى الآن: ${signed} من ${drafts.length}`,
  '',
  '| # | المصطلح | English | التعريف المقترح | القرار | التعديل |',
  '|---|---|---|---|---|---|',
  ...drafts.map((d, i) => `| ${i + 1} | ${cell(d.ar)} | ${cell(d.en)} | ${cell(d.definitionAr)} | ${isSignedOff(d) ? cell(`اعتُمد (${d.reviewedBy}، ${d.reviewedAt})`) : ''} | |`),
  '',
  'للاعتماد: يضع المسؤول اسم المعلّم وتاريخ المراجعة (YYYY-MM-DD) في `reviewedBy` و`reviewedAt` لذلك المصطلح في',
  '`lib/curriculum/src/data/glossary/chem-g10-s1.draft.json` بعد أن يضع فيه التعديل (إن وُجد).',
  '',
  '# مراجعة سريعة لمصطلحات المسرد المطبوع (التعريفات منقولة من الكتاب)',
  '',
  'انظر إلى عمود المصطلح فقط: هل فيه حرف ناقص، أو كلمتان بترتيب معكوس، أو رمز غريب؟ سجّل رقم الصف.',
  '',
  '| # | الكتاب | الصفحة | المصطلح | English |',
  '|---|---|---|---|---|',
  ...printed.map((e, i) => `| ${i + 1} | ${cell(bookTitle(e.bookId))} | ${e.page ?? ''} | ${cell(e.ar)} | ${cell(e.en)} |`),
];
console.log(lines.join('\n'));
