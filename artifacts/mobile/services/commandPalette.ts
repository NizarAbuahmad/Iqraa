/**
 * ⌘K — one list of everything the app can be told to do, and the search over it.
 *
 * The tool catalog, the nav and the lesson actions each already exist; this
 * flattens them into one addressable list so a teacher can reach any of them
 * from any screen without hunting through a menu. Screens decide what running
 * a command *does* — this only says what the commands are and which ones match
 * what was typed.
 *
 * Pure TypeScript (the tool catalog's only import is type-only), so `node
 * --test` can run it.
 */
import { WORKFLOW } from './toolCatalog.ts';

/**
 * The part of a `ToolDef` this file needs. Structural rather than the real
 * type so a test can hand it plain objects without reproducing the icon-name
 * union from @expo/vector-icons.
 */
export type ToolLike = {
  id: string;
  titleKey: string;
  descKey: string;
  icon: string;
  route?: string;
  routeParams?: Record<string, string>;
};

export type CommandKind = 'lesson' | 'tool' | 'navigate';

export type Command = {
  id: string;
  kind: CommandKind;
  label: string;
  /** Second line — what it does, or where it goes. */
  hint?: string;
  icon: string;
  /** Route to push. Absent for commands the host handles itself (e.g. change lesson). */
  route?: string;
  routeParams?: Record<string, string>;
  /** Host-handled action id, for commands that are not navigation. */
  action?: 'change-lesson' | 'start-class' | 'ask-iqra';
  /** Extra words that should match this command but are not shown. */
  keywords?: string[];
};

export type NavEntry = { name: string; label: string; icon: string };

/**
 * Same normalisation the prep board uses, for the same reason: a teacher
 * typing «الاقترانات» must find a command labelled «الاقتـرانات», and one
 * typing "khtt" is out of scope but one typing "quiz" must find «اختبار».
 */
export function normalize(s: string): string {
  return (s ?? '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildCommands(opts: {
  lang: 'ar' | 'en';
  /** Tab entries already role-filtered by the caller — the palette must not offer a tab the rail hides. */
  nav: NavEntry[];
  /** The active lesson's topic, when one is picked. */
  lessonTopic?: string | null;
  /**
   * Route params that pin a generator to the active lesson's own grade and
   * subject — `lessonPickerParams` / `scopePickerParams` output, plus the
   * topic.
   *
   * Not optional decoration: every `/ai-tools/*` screen defaults `subjectIdx`
   * to 0, so a tool opened from here without them generates the *first*
   * subject's material. A chemistry teacher pressing ⌘K → «اختبار» would get
   * maths questions under their lesson's title. A tool's own `routeParams`
   * still win, since those name a specific variant of that tool.
   */
  lessonParams?: Record<string, string>;
  /** Translate a tool's title/description key. */
  t: (key: string) => string;
  /** Tool sections; defaults to the shared catalog. */
  workflow?: { tools: ToolLike[] }[];
}): Command[] {
  const isAr = opts.lang === 'ar';
  const out: Command[] = [];

  // Lesson-scoped first: whatever a teacher came here to do, it is almost
  // always about the lesson that is already loaded.
  if (opts.lessonTopic?.trim()) {
    out.push({
      id: 'lesson:ask',
      kind: 'lesson',
      label: isAr ? `اسأل اقرأ عن «${opts.lessonTopic}»` : `Ask IQRA about “${opts.lessonTopic}”`,
      hint: isAr ? 'يفتح المحادثة على الدرس الحالي' : 'Opens the chat on the current lesson',
      icon: 'chatbubble-ellipses-outline',
      action: 'ask-iqra',
      keywords: ['chat', 'محادثة', 'سؤال'],
    });
    out.push({
      id: 'lesson:start-class',
      kind: 'lesson',
      label: isAr ? 'ابدأ الحصة' : 'Start class',
      hint: opts.lessonTopic,
      icon: 'tv-outline',
      action: 'start-class',
      keywords: ['present', 'عرض', 'حصة'],
    });
  }
  out.push({
    id: 'lesson:change',
    kind: 'lesson',
    label: isAr ? 'تغيير الدرس الحالي' : 'Change current lesson',
    hint: isAr ? 'الصف والمادة والدرس' : 'Grade, subject and lesson',
    icon: 'swap-horizontal',
    action: 'change-lesson',
    keywords: ['lesson', 'درس', 'صف', 'مادة'],
  });

  for (const section of opts.workflow ?? WORKFLOW) {
    for (const tool of section.tools) {
      if (!tool.route) continue; // external actions (GeoGebra) are not addressable here
      out.push({
        id: `tool:${tool.id}`,
        kind: 'tool',
        label: opts.t(tool.titleKey),
        hint: opts.t(tool.descKey),
        icon: tool.icon,
        route: tool.route,
        routeParams: { ...(opts.lessonParams ?? {}), ...(tool.routeParams ?? {}) },
        keywords: [tool.id],
      });
    }
  }

  for (const entry of opts.nav) {
    out.push({
      id: `nav:${entry.name}`,
      kind: 'navigate',
      label: entry.label,
      hint: isAr ? 'انتقال' : 'Go to',
      icon: entry.icon,
      route: `/${entry.name === 'index' ? '' : entry.name}`,
      keywords: [entry.name],
    });
  }

  return out;
}

/**
 * Matches on every word typed, in any order and anywhere in the label, hint or
 * keywords — «ورقة رياضيات» should find the worksheet tool even though its
 * description puts those words the other way round. Exact prefix matches rank
 * first so that typing the start of a tool's name does not bury it under a
 * long description that happens to contain the same letters.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const q = normalize(query);
  if (!q) return commands;
  const words = q.split(' ');

  const scored: { cmd: Command; score: number }[] = [];
  for (const cmd of commands) {
    const label = normalize(cmd.label);
    const haystack = normalize([cmd.label, cmd.hint ?? '', ...(cmd.keywords ?? [])].join(' '));
    if (!words.every(w => haystack.includes(w))) continue;
    const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
    scored.push({ cmd, score });
  }
  // Stable within a score band: the catalog's own order is the teaching
  // workflow's order, and re-sorting it would scatter it.
  return scored
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map(s => s.cmd);
}
