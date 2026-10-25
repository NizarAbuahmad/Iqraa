/**
 * Where the English corner sends a student next: every grade it covers, the
 * official book each one is taught from, and free sites for listening and reading.
 *
 * Links only. Nothing here is fetched, copied or embedded, so none of it needs
 * a licence record the way `external.ts` does; it is the same hop a student
 * makes by typing the address. A site that starts asking for money, or a path
 * that moves, is a one-line edit in `FREE_SITES`.
 *
 * Every URL below was opened or read from the site's own navigation on
 * 2026-10-24 (the British Council paths come from its sitemap). `englishLinks.test.ts`
 * pins the shape (https, a grade band, both languages), not that a site is up.
 *
 * Free of react-native, like the rest of the hub's data.
 */
import { BOOKS } from './catalog.ts';

/**
 * Grades the corner shows a tab for. Wider than `ENGLISH_HUB_GRADES` (englishHub.ts),
 * which is the grades with word lists to play: Grades 6–8 have no vocabulary
 * extracted yet, but a student in Grade 7 should still find the corner, their book
 * and somewhere to listen and read.
 */
export const ENGLISH_CORNER_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type EnglishSkill = 'listen' | 'read' | 'play' | 'grammar';

export interface FreeSite {
  /** Stable slug. */
  id: string;
  titleEn: string;
  titleAr: string;
  /** One line on what the student finds there. */
  noteEn: string;
  noteAr: string;
  url: string;
  /** Inclusive grade band the content suits. */
  grades: readonly [number, number];
  skills: readonly EnglishSkill[];
  /** True when the site is free but asks for a free account first. */
  freeSignup?: boolean;
}

const KIDS = 'https://learnenglishkids.britishcouncil.org';
const TEENS = 'https://learnenglishteens.britishcouncil.org';

export const FREE_SITES: readonly FreeSite[] = [
  {
    id: 'bc-kids-listen-watch',
    titleEn: 'British Council Kids — Listen and watch',
    titleAr: 'المجلس الثقافي البريطاني للأطفال — استمع وشاهد',
    noteEn: 'Songs, short stories, poems and videos, with the words on screen.',
    noteAr: 'أغانٍ وقصص قصيرة وقصائد وفيديوهات، والكلمات ظاهرة على الشاشة.',
    url: `${KIDS}/listen-watch`,
    grades: [1, 6],
    skills: ['listen'],
  },
  {
    id: 'bc-kids-read-write',
    titleEn: 'British Council Kids — Read and write',
    titleAr: 'المجلس الثقافي البريطاني للأطفال — اقرأ واكتب',
    noteEn: 'Reading and writing practice at three levels, with a magazine.',
    noteAr: 'تمارين قراءة وكتابة بثلاثة مستويات، مع مجلة للأطفال.',
    url: `${KIDS}/read-write`,
    grades: [2, 6],
    skills: ['read'],
  },
  {
    id: 'bc-kids-games',
    titleEn: 'British Council Kids — Games',
    titleAr: 'المجلس الثقافي البريطاني للأطفال — ألعاب',
    noteEn: 'Free word and grammar games.',
    noteAr: 'ألعاب مجانية للكلمات والقواعد.',
    url: `${KIDS}/fun-games/games`,
    grades: [1, 6],
    skills: ['play', 'grammar'],
  },
  {
    id: 'bc-teens-listening',
    titleEn: 'British Council Teens — Listening',
    titleAr: 'المجلس الثقافي البريطاني للمراهقين — الاستماع',
    noteEn: 'Recordings from A1 to C1, each with a transcript and exercises.',
    noteAr: 'تسجيلات من المستوى A1 إلى C1، لكل منها نص مكتوب وتمارين.',
    url: `${TEENS}/skills/listening`,
    grades: [6, 10],
    skills: ['listen'],
  },
  {
    id: 'bc-teens-reading',
    titleEn: 'British Council Teens — Reading',
    titleAr: 'المجلس الثقافي البريطاني للمراهقين — القراءة',
    noteEn: 'Texts for each level, with tasks before and after reading.',
    noteAr: 'نصوص لكل مستوى، مع أنشطة قبل القراءة وبعدها.',
    url: `${TEENS}/skills/reading`,
    grades: [6, 10],
    skills: ['read'],
  },
  {
    id: 'bc-teens-grammar',
    titleEn: 'British Council Teens — Grammar',
    titleAr: 'المجلس الثقافي البريطاني للمراهقين — القواعد',
    noteEn: 'Short grammar lessons with exercises.',
    noteAr: 'دروس قواعد قصيرة مع تمارين.',
    url: `${TEENS}/grammar`,
    grades: [7, 10],
    skills: ['grammar'],
  },
  {
    id: 'bbc-6-minute',
    titleEn: 'BBC Learning English — 6 Minute English',
    titleAr: 'بي بي سي لتعلّم الإنجليزية — ست دقائق إنجليزي',
    noteEn: 'A short talk on one topic, with new words explained and a transcript.',
    noteAr: 'حوار قصير عن موضوع واحد، مع شرح للكلمات الجديدة ونص مكتوب.',
    url: 'https://www.bbc.co.uk/learningenglish/english/features/6-minute-english',
    grades: [8, 10],
    skills: ['listen', 'read'],
  },
  {
    id: 'bbc-course',
    titleEn: 'BBC Learning English — Lower intermediate course',
    titleAr: 'بي بي سي لتعلّم الإنجليزية — مقرر المستوى المتوسط الأدنى',
    noteEn: 'A free course of videos, audio and exercises.',
    noteAr: 'مقرر مجاني من فيديوهات وتسجيلات صوتية وتمارين.',
    url: 'https://www.bbc.co.uk/learningenglish/english/course/lower-intermediate',
    grades: [7, 10],
    skills: ['listen', 'read', 'grammar'],
  },
  {
    id: 'voa',
    titleEn: 'VOA Learning English',
    titleAr: 'صوت أمريكا — تعلّم الإنجليزية',
    noteEn: 'News read slowly in simple English, with the text beside the audio.',
    noteAr: 'أخبار بإنجليزية بسيطة وبطيئة، والنص بجانب التسجيل.',
    url: 'https://learningenglish.voanews.com/',
    grades: [7, 10],
    skills: ['listen', 'read'],
  },
  {
    id: 'starfall',
    titleEn: 'Starfall',
    titleAr: 'ستارفول',
    noteEn: 'Letters, sounds and first reading, with games.',
    noteAr: 'الحروف والأصوات وأولى خطوات القراءة، مع ألعاب.',
    url: 'https://www.starfall.com/h/',
    grades: [1, 2],
    skills: ['read', 'listen', 'play'],
  },
  {
    id: 'storyline-online',
    titleEn: 'Storyline Online',
    titleAr: 'ستوري لاين أونلاين',
    noteEn: 'Picture books read aloud on video.',
    noteAr: 'قصص مصوّرة يقرؤها ممثلون بصوت عالٍ على فيديو.',
    url: 'https://storylineonline.net/',
    grades: [1, 5],
    skills: ['listen', 'read'],
  },
  {
    id: 'oxford-owl',
    titleEn: 'Oxford Owl — free ebook library',
    titleAr: 'أوكسفورد أول — مكتبة كتب إلكترونية مجانية',
    noteEn: 'Graded stories to read on screen. Needs a free account.',
    noteAr: 'قصص مدرّجة بحسب المستوى للقراءة على الشاشة. تتطلب حسابًا مجانيًا.',
    url: 'https://www.oxfordowl.co.uk/for-home/find-a-book/library-page/',
    grades: [1, 6],
    skills: ['read'],
    freeSignup: true,
  },
  {
    id: 'natgeo-kids',
    titleEn: 'National Geographic Kids',
    titleAr: 'ناشونال جيوغرافيك للأطفال',
    noteEn: 'Short, illustrated articles about animals, places and science.',
    noteAr: 'مقالات قصيرة مصوّرة عن الحيوانات والأماكن والعلوم.',
    url: 'https://kids.nationalgeographic.com/',
    grades: [4, 8],
    skills: ['read'],
  },
];

export function freeSitesForGrade(grade: number): FreeSite[] {
  return FREE_SITES.filter(s => grade >= s.grades[0] && grade <= s.grades[1]);
}

export type EnglishBookKind = 'student' | 'activity';

export interface EnglishBook {
  bookId: string;
  grade: number;
  semester: 1 | 2;
  kind: EnglishBookKind;
  title: string;
  titleAr: string;
  /** The Ministry's own PDF on nccd.gov.jo — opened there, never copied. */
  url: string;
}

/**
 * The official English books of a grade: the student book of each semester (the reading
 * the lessons are built on) and the activity book where the Ministry publishes one.
 * Read from the catalog's own `pdfUrl` / `activityPdfUrl`, so a re-issued book is fixed
 * in one place. The teacher's guide is left out: it is not for the student.
 */
export function englishBooksForGrade(grade: number): EnglishBook[] {
  const out: EnglishBook[] = [];
  for (const b of BOOKS) {
    if (b.subjectId !== 'english' || b.gradeId !== `grade-${grade}`) continue;
    if (b.semester !== 1 && b.semester !== 2) continue;
    // Grade 10's vocational strands (commerce, agriculture…) print no student PDF.
    if (b.pdfUrl) out.push({ bookId: b.id, grade, semester: b.semester, kind: 'student', title: b.title, titleAr: b.titleAr, url: b.pdfUrl });
    if (b.activityPdfUrl) out.push({ bookId: b.id, grade, semester: b.semester, kind: 'activity', title: b.title, titleAr: b.titleAr, url: b.activityPdfUrl });
  }
  return out.sort((a, b) => a.semester - b.semester || (a.kind === 'student' ? -1 : 1) - (b.kind === 'student' ? -1 : 1));
}
