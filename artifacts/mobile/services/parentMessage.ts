/**
 * Parent messages — composes a ready-to-send note to a student's guardian.
 *
 * ── Why this one is not generated ──
 *
 * Every other tool here generates content. This one deliberately does not, and
 * the reason is the subject matter: the message is about a named real child and
 * goes to their parent, usually onward via WhatsApp. A model that invents "لم
 * يسلّم ثلاثة واجبات" when it was one, or softens a genuine concern into praise,
 * produces a message the teacher signs and cannot take back. There is no
 * verification step that would catch it, because only the teacher knows what
 * actually happened.
 *
 * So the split is: **the teacher supplies every fact, this file supplies the
 * register.** Choosing the right formal Arabic — the greeting, the honorific,
 * the closing — is the part teachers actually find slow, and it is the part
 * that can be done deterministically and correctly. Nothing here asserts
 * anything about a student that the teacher did not type.
 *
 * That also means the tool works with `DEMO_MODE` on, offline, and with no API
 * key, which is why it ships working rather than as another "coming soon".
 *
 * ── Why gender is an input ──
 *
 * Arabic inflects for it in almost every clause — ابنكم/ابنتكم، الطالب/الطالبة،
 * أظهر/أظهرت. Writing "ابنكم/ابنتكم" with a slash is what a form letter looks
 * like, and a parent reads it as exactly that. Two toggles remove every slash
 * from the output.
 */

export type MessageKind =
  | 'praise'
  | 'academic-concern'
  | 'missing-homework'
  | 'absence'
  | 'behaviour'
  | 'meeting'
  | 'progress';

export type Gender = 'male' | 'female';
export type Tone = 'formal' | 'warm';

export interface ParentMessageInput {
  studentName: string;
  studentGender: Gender;
  kind: MessageKind;
  /** The teacher's own account of what happened. Never invented here. */
  details?: string;
  teacherName?: string;
  teacherGender?: Gender;
  subject?: string;
  tone?: Tone;
}

export const MESSAGE_KINDS: MessageKind[] = [
  'praise',
  'progress',
  'missing-homework',
  'academic-concern',
  'absence',
  'behaviour',
  'meeting',
];

/** Labels for the picker, kept beside the copy they select. */
export function kindLabel(kind: MessageKind, isAr: boolean): string {
  const ar: Record<MessageKind, string> = {
    praise: 'إشادة وتقدير',
    progress: 'تقرير تقدّم',
    'missing-homework': 'واجبات غير منجزة',
    'academic-concern': 'ملاحظة أكاديمية',
    absence: 'غياب متكرر',
    behaviour: 'ملاحظة سلوكية',
    meeting: 'دعوة لاجتماع',
  };
  const en: Record<MessageKind, string> = {
    praise: 'Praise',
    progress: 'Progress update',
    'missing-homework': 'Missing homework',
    'academic-concern': 'Academic concern',
    absence: 'Repeated absence',
    behaviour: 'Behaviour note',
    meeting: 'Meeting request',
  };
  return isAr ? ar[kind] : en[kind];
}

export function kindEmoji(kind: MessageKind): string {
  return {
    praise: '🌟',
    progress: '📈',
    'missing-homework': '📝',
    'academic-concern': '📚',
    absence: '📅',
    behaviour: '💬',
    meeting: '🤝',
  }[kind];
}

/** Kinds that carry bad news, so the UI can prompt for specifics. */
export function needsDetails(kind: MessageKind): boolean {
  return kind !== 'praise' && kind !== 'progress';
}

// ─── Arabic ───────────────────────────────────────────────────────────────────

function arChild(g: Gender): string {
  return g === 'male' ? 'ابنكم' : 'ابنتكم';
}

function arBody(input: ParentMessageInput): string {
  const { studentName: n, studentGender: g, subject } = input;
  const child = arChild(g);
  // "في مادة الرياضيات" reads wrong when no subject was given; drop the clause
  // rather than emit a dangling "في مادة".
  const inSubject = subject?.trim() ? ` في مادة ${subject.trim()}` : '';
  const did = g === 'male' ? 'أظهر' : 'أظهرت';
  const hasNot = g === 'male' ? 'لم يُنجز' : 'لم تُنجز';
  const wasAbsent = g === 'male' ? 'تغيّب' : 'تغيّبت';

  switch (input.kind) {
    case 'praise':
      return `يسعدني أن أشارككم تميّز ${child} ${n}${inSubject}. فقد ${did} اجتهادًا واضحًا والتزامًا يستحق الثناء، وكان لحضوره الفاعل أثر طيب في الصف.`;
    case 'progress':
      return `أودّ إطلاعكم على تقرير موجز حول مستوى ${child} ${n}${inSubject} خلال الفترة الماضية.`;
    case 'missing-homework':
      return `ألاحظ في الفترة الأخيرة أنّ ${child} ${n} ${hasNot} الواجبات المطلوبة${inSubject}. والواجب المنزلي جزء أساسي من ترسيخ ما نتعلّمه في الحصة.`;
    case 'academic-concern':
      return `أودّ إطلاعكم على ملاحظة تتعلّق بمستوى ${child} ${n}${inSubject}، رغبةً في معالجتها مبكرًا قبل أن تتراكم.`;
    case 'absence':
      return `لاحظت أنّ ${child} ${n} ${wasAbsent} عن عدد من الحصص${inSubject} مؤخرًا، ما يؤثّر في متابعة الدروس المتسلسلة.`;
    case 'behaviour':
      return `أودّ التواصل معكم بخصوص ملاحظة سلوكية تتعلّق بـ${child} ${n} داخل الصف، وأثق أنّ تعاوننا معًا سيعالجها بأفضل صورة.`;
    case 'meeting':
      return `أرجو التكرّم بتحديد موعد يناسبكم لمقابلتي في المدرسة، لمناقشة مستوى ${child} ${n}${inSubject} والاتفاق على خطة متابعة مشتركة.`;
  }
}

function arNextStep(kind: MessageKind): string {
  switch (kind) {
    case 'praise':
      return 'أرجو أن تشاركوه/تشاركوها هذا التقدير في المنزل، فله أثر كبير في الدافعية.';
    case 'progress':
      return 'وأنا على استعداد لتزويدكم بأي تفصيل إضافي عند الحاجة.';
    case 'missing-homework':
      return 'أرجو متابعة إنجاز الواجبات في المنزل، ولا تتردّدوا في التواصل معي إن كان هناك ما يحول دون ذلك.';
    case 'academic-concern':
      return 'أقترح أن نتعاون على خطة متابعة بسيطة، وأنا مستعد لتقديم الدعم اللازم داخل الصف.';
    case 'absence':
      return 'أرجو إعلامي بأي ظرف يستدعي الغياب، لنعمل معًا على تعويض ما فات.';
    case 'behaviour':
      return 'أرجو التواصل معي في الوقت الذي يناسبكم لنتحدّث بشأنها.';
    case 'meeting':
      return 'وسأكون شاكرًا لكم تحديد الوقت الأنسب لكم.';
  }
}

function arSignOff(input: ParentMessageInput): string {
  const role = input.teacherGender === 'female' ? 'معلّمة' : 'معلّم';
  const subject = input.subject?.trim();
  const name = input.teacherName?.trim();
  const line = [name, subject ? `${role} ${subject}` : role].filter(Boolean).join(' — ');
  return `وتفضّلوا بقبول فائق الاحترام،\n${line}`;
}

function composeArabic(input: ParentMessageInput): string {
  const warm = input.tone === 'warm';
  const gender = input.studentGender === 'male' ? 'الطالب' : 'الطالبة';
  const greeting = warm
    ? `أهلًا بكم،\nالسلام عليكم ورحمة الله وبركاته،`
    : `حضرة ولي أمر ${gender} ${input.studentName} المحترم،\nالسلام عليكم ورحمة الله وبركاته،`;

  return [
    greeting,
    arBody(input),
    input.details?.trim(),
    arNextStep(input.kind),
    arSignOff(input),
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ─── English ──────────────────────────────────────────────────────────────────

function enBody(input: ParentMessageInput): string {
  const { studentName: n, studentGender: g, subject } = input;
  const child = g === 'male' ? 'your son' : 'your daughter';
  const they = g === 'male' ? 'he' : 'she';
  const inSubject = subject?.trim() ? ` in ${subject.trim()}` : '';

  switch (input.kind) {
    case 'praise':
      return `I am glad to share how well ${child}, ${n}, is doing${inSubject}. ${they[0].toUpperCase()}${they.slice(1)} has shown clear effort and commitment, and it has had a real effect in class.`;
    case 'progress':
      return `I would like to share a brief update on ${child} ${n}'s progress${inSubject} over the past period.`;
    case 'missing-homework':
      return `I have noticed recently that ${n} has not been completing the assigned homework${inSubject}. Homework is a key part of consolidating what we cover in class.`;
    case 'academic-concern':
      return `I would like to raise a concern about ${n}'s level${inSubject}, so that we can address it early rather than let it build up.`;
    case 'absence':
      return `I have noticed that ${n} has missed a number of classes${inSubject} recently, which affects following lessons that build on each other.`;
    case 'behaviour':
      return `I would like to speak with you about a behaviour matter involving ${n} in class. I am confident that working together we can resolve it well.`;
    case 'meeting':
      return `I would be grateful if you could suggest a time to meet at school, to discuss ${n}'s progress${inSubject} and agree on a shared plan.`;
  }
}

function enNextStep(kind: MessageKind): string {
  switch (kind) {
    case 'praise':          return 'Please do share this recognition at home — it makes a real difference to motivation.';
    case 'progress':        return 'I am happy to provide any further detail you would find useful.';
    case 'missing-homework':return 'Please follow up on homework at home, and do let me know if something is getting in the way.';
    case 'academic-concern':return 'I suggest we agree on a simple follow-up plan, and I will provide support in class.';
    case 'absence':         return 'Please let me know of any circumstances behind the absences so we can make up what was missed.';
    case 'behaviour':       return 'Please contact me at a time that suits you so we can discuss it.';
    case 'meeting':         return 'I would be grateful if you could let me know the time that suits you best.';
  }
}

function composeEnglish(input: ParentMessageInput): string {
  const warm = input.tone === 'warm';
  const greeting = warm
    ? 'Hello,'
    : `Dear Parent/Guardian of ${input.studentName},`;
  const role = input.subject?.trim()
    ? `${input.subject.trim()} Teacher`
    : 'Teacher';
  const signLine = [input.teacherName?.trim(), role].filter(Boolean).join(' — ');

  return [
    greeting,
    enBody(input),
    input.details?.trim(),
    enNextStep(input.kind),
    `Kind regards,\n${signLine}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Compose the message. Returns '' when there is no student name — the caller
 * shows a validation hint rather than a letter addressed to nobody.
 */
export function composeParentMessage(input: ParentMessageInput, isAr: boolean): string {
  if (!input.studentName?.trim()) return '';
  const normalised: ParentMessageInput = {
    ...input,
    studentName: input.studentName.trim(),
  };
  return isAr ? composeArabic(normalised) : composeEnglish(normalised);
}
