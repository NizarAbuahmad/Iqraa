/**
 * The decisions behind push — which Android channels exist, and when to ask
 * for permission — split out of pushTokens.ts so they can be unit-tested:
 * that file imports expo-notifications at module scope, which node:test
 * cannot load (see CLAUDE.md).
 */

export type PushChannelId = 'messages' | 'results' | 'reminders' | 'admin' | 'homework' | 'exams' | 'quiet';

export interface PushChannel {
  id: PushChannelId;
  /** 'high' shows a heads-up banner; 'default' only lands in the shade; 'low' lands in the shade with no sound or vibration. */
  importance: 'high' | 'default' | 'low';
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Only created for system admins — nobody else is ever sent to it. */
  adminOnly?: boolean;
}

/**
 * One channel per kind of push, so a parent can silence the daily practice
 * reminder without also losing their child's teacher. Before these, every
 * push went to Android's single catch-all channel, where muting one kind
 * muted all of them. Ids must match PUSH_CHANNEL on the server — the test
 * reads that file to check.
 */
export const PUSH_CHANNELS: readonly PushChannel[] = [
  {
    id: 'messages',
    importance: 'high',
    nameAr: 'الرسائل',
    nameEn: 'Messages',
    descriptionAr: 'رسائل المعلّمين وأولياء الأمور والطلبة ومجموعات الصفوف',
    descriptionEn: 'Messages from teachers, parents, students and class groups',
  },
  {
    id: 'results',
    importance: 'high',
    nameAr: 'نتائج الاختبارات',
    nameEn: 'Exam results',
    descriptionAr: 'عندما يعلن المعلّم نتائج اختبار',
    descriptionEn: 'When a teacher releases exam results',
  },
  {
    id: 'reminders',
    importance: 'default',
    nameAr: 'تذكير التدريب اليومي',
    nameEn: 'Daily practice reminder',
    descriptionAr: 'تذكير مساءً إن لم يكتمل تدريب اليوم',
    descriptionEn: "An evening reminder if today's practice isn't done",
  },
  {
    id: 'homework',
    importance: 'default',
    nameAr: 'الواجبات',
    nameEn: 'Homework',
    descriptionAr: 'واجب جديد من المعلّم، وتذكير قبل موعده بيوم',
    descriptionEn: 'New homework from a teacher, and a reminder the day before it is due',
  },
  {
    id: 'exams',
    importance: 'high',
    nameAr: 'مواعيد الامتحانات',
    nameEn: 'Exam dates',
    descriptionAr: 'عند تحديد موعد امتحان أو تغييره',
    descriptionEn: 'When an exam is scheduled or its date changes',
  },
  {
    // The server sends every family push here between 22:00 and 07:00 Amman
    // (quietHours.ts on the API): Android takes sound from the channel, so a
    // silent night needs a silent channel.
    id: 'quiet',
    importance: 'low',
    nameAr: 'ليلًا (بلا صوت)',
    nameEn: 'At night (silent)',
    descriptionAr: 'ما يصل من المدرسة بين العاشرة مساءً والسابعة صباحًا، بلا صوت',
    descriptionEn: 'School notifications that arrive between 10 pm and 7 am, without sound',
  },
  {
    id: 'admin',
    importance: 'default',
    nameAr: 'بلاغات المحتوى',
    nameEn: 'Content reports',
    descriptionAr: 'بلاغات المعلّمين عن مواد مشتركة',
    descriptionEn: 'Teacher reports about shared materials',
    adminOnly: true,
  },
];

export function channelsFor(isAdmin: boolean): PushChannel[] {
  return PUSH_CHANNELS.filter(c => isAdmin || !c.adminOnly);
}

export type PushPromptDecision = 'register' | 'explain' | 'open-settings' | 'skip';

/**
 * What to do at a moment where push would help. Android 13+ lets an app show
 * the OS permission prompt only a couple of times before the answer sticks,
 * so it is never spent cold: the app explains why first, asks on its own
 * only once (after the user sends a message or joins a class), and after
 * that asks only when the user taps the settings row.
 *
 * - `explicit` — the user asked (the settings row), not a moment we picked.
 * - `askedBefore` — our explanation has already been shown on this device.
 */
export function pushPromptDecision(args: {
  web: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  askedBefore: boolean;
  explicit: boolean;
}): PushPromptDecision {
  if (args.web) return 'skip';
  if (args.status === 'granted') return 'register';
  // The OS will not show its prompt again; only system settings can turn it on.
  if (!args.canAskAgain) return args.explicit ? 'open-settings' : 'skip';
  if (args.askedBefore && !args.explicit) return 'skip';
  return 'explain';
}
