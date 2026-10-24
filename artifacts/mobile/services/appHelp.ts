/**
 * "Where do I find X?" — answered from the app's own map, not the model.
 *
 * Those questions used to enter the teaching pipeline and come back as a
 * curriculum answer about whatever lesson was on the card. They are answered
 * here, locally: no AI cost, works in demo mode, and it cannot name a screen
 * that does not exist, because every place below is a real route.
 *
 * Tools come from the shared catalog, so a tool added there is findable here
 * without an edit. The screens that live under Profile are listed by hand —
 * nothing else enumerates them.
 *
 * Pure TypeScript (the catalog's only runtime import is data), so `node --test`
 * can run it.
 */
import { WORKFLOW } from './toolCatalog.ts';
import { normalize } from './commandPalette.ts';

export type AppPlace = {
  id: string;
  route: string;
  /** i18n key of the place's own name. */
  labelKey: string;
  /** i18n keys of where it sits, outermost first: tab, then section. */
  pathKeys: string[];
  /** True for generators — opening one should carry the current lesson. */
  isTool: boolean;
  /** Normalised words that point at this place. */
  keywords: string[];
  routeParams?: Record<string, string>;
  /** i18n key of the steps to give when the question is "how do I…", not "where is…". */
  howKey?: string;
};

/**
 * A tool id that is also an everyday word is not a keyword: «how do i create a
 * positive classroom» opened the interactive-class tool (found 2026-10-18).
 */
const ID_IS_A_WORD = new Set(['classroom']);

/** Extra words per catalog tool id; the tool's id is a keyword too, unless it is in `ID_IS_A_WORD`. */
const TOOL_KEYWORDS: Record<string, string[]> = {
  slides: ['عرض', 'شرائح', 'بوربوينت', 'باوربوينت', 'بريزنتيشن', 'slides', 'presentation', 'deck'],
  'lesson-plan': ['خطه درس', 'تحضير', 'تحضير درس', 'lesson plan'],
  worksheet: ['ورقه عمل', 'اوراق عمل', 'worksheet'],
  classroom: ['تحدي', 'تحديات', 'غرفه الهروب', 'بنغو', 'الحصه التفاعليه', 'escape', 'bingo', 'interactive class'],
  game: ['لعبه', 'مسابقه', 'مسابقات', 'game', 'quiz game'],
  activity: ['نشاط', 'انشطه', 'activity'],
  games: ['العاب', 'ألعاب', 'games', 'play'],
  // Bare «اختبار» too: «كيف أسوي اختبار» found no place. The plural stays the exams'.
  quiz: ['اختبار قصير', 'اختبار', 'كويز', 'quiz'],
  evaluations: ['اختبارات', 'امتحان', 'امتحانات', 'تقييم', 'تقييمات', 'علامات', 'نتائج', 'exam', 'exams', 'test', 'tests', 'grades', 'results'],
  'parent-msg': ['رساله ولي امر', 'رساله للاهل', 'parent message'],
};

/** Steps for "how do I make one" — the generators the chat can also make itself. */
const TOOL_HOW: Record<string, string> = {
  'lesson-plan': 'howMakeLessonPlan',
  worksheet: 'howMakeWorksheet',
  quiz: 'howMakeQuiz',
  activity: 'howMakeActivity',
  game: 'howMakeGame',
};

/** Screens reached from Profile or a tab, which no catalog lists. */
const SCREENS: AppPlace[] = [
  {
    id: 'classes', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    // «clases» is the typo that actually got typed.
    keywords: ['شعب', 'شعبه', 'شعبي', 'شعبتي', 'طلابي', 'طلبتي', 'classes', 'clases', 'my class', 'add class', 'add a class', 'new class', 'another class', 'extra class', 'students'],
    howKey: 'howAddClass',
  },
  {
    // Students are added inside a class that already exists, not by making one,
    // so this has its own steps. No keywords: «add a student» is reached only
    // through `ADD_STUDENT`, which is anchored (see there).
    id: 'add-student', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: [],
    howKey: 'howAddStudent',
  },
  // The four below are reached through `RULE_PLACES` (anchored, see there), or
  // through their keywords. Each has its own steps because the screen alone
  // does not say how: archiving is a bin icon on the list, the link code a
  // button on the class page, sign-out the last row of Profile, and there is
  // no change-password screen at all.
  {
    id: 'archive-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: [],
    howKey: 'howArchiveClass',
  },
  {
    id: 'link-code', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['رمز الربط', 'رمز الانضمام', 'link code', 'join code'],
    howKey: 'howShareLinkCode',
  },
  {
    id: 'sign-out', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    keywords: ['تسجيل الخروج', 'sign out', 'log out'],
    howKey: 'howSignOut',
  },
  {
    id: 'password', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    keywords: [],
    howKey: 'howChangePassword',
  },
  // Reached through `RULE_PLACES` (2026-10-17's second live pass); steps taken
  // from the screens they name. Three say plainly that something is not in the
  // app: a dark-mode switch (the scheme follows the device, read at start-up),
  // a name editor (only sign-up sets it), and a report button on a result that
  // was not shared (`GeneratorResultActions` shows it only with a variant id).
  { id: 'homework', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howAddHomework' },
  { id: 'exam-date', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamDate' },
  { id: 'class-scan', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howClassScan' },
  { id: 'class-chat', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howClassChat' },
  { id: 'block', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howBlock' },
  { id: 'change-name', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howChangeName' },
  { id: 'delete-account', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howDeleteAccount' },
  { id: 'suggest-feature', route: '/suggest-feature', labelKey: 'suggestFeature', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howSuggestFeature' },
  { id: 'report-problem', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howReportProblem' },
  { id: 'regenerate', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howRegenerate' },
  { id: 'save-material', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howSaveMaterial' },
  {
    id: 'dark-mode', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['الوضع الليلي', 'الوضع الداكن', 'الوضع المظلم', 'dark mode', 'dark theme', 'night mode'],
    howKey: 'howDarkMode',
  },
  // Reached through `RULE_PLACES` (2026-10-18's live pass). Six answer that the
  // app does not do it, from the code: document upload is switched off
  // (`DOCUMENT_UPLOAD_ENABLED`), nothing exports marks or copies an exam (an
  // evaluation holds one class), there is no teacher invite, no support channel
  // but «اقترح ميزة», and no store listing yet.
  { id: 'share-exam', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howShareExam' },
  { id: 'exam-submissions', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamSubmissions' },
  { id: 'copy-exam', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howCopyExam' },
  { id: 'export-marks', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExportMarks' },
  { id: 'send-worksheet', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: true, keywords: [], howKey: 'howSendWorksheet' },
  { id: 'question-image', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: true, keywords: [], howKey: 'howQuestionImage' },
  { id: 'notification-settings', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howNotifications' },
  { id: 'contact-support', route: '/suggest-feature', labelKey: 'suggestFeature', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howContactSupport' },
  { id: 'upload-file', route: '/curriculum/browse', labelKey: 'tabCurriculum', pathKeys: [], isTool: false, keywords: [], howKey: 'howUploadFile' },
  { id: 'invite-teacher', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howInviteTeacher' },
  { id: 'install-app', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howInstallApp' },
  { id: 'pricing', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howPricing' },
  // The fifth pass (2026-10-18). An exam's questions change only while it is a
  // draft, and an exam in «التقييمات» has no export at all: printing one points
  // at the short quiz, whose export does print.
  { id: 'edit-exam-questions', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howEditExamQuestions' },
  { id: 'close-exam', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howCloseExam' },
  { id: 'edit-mark', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howEditMark' },
  { id: 'release-results', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howReleaseResults' },
  // Not the quiz tool as the button: a tool place answers a print question with
  // the generic export steps (see `answerAppHelp`).
  { id: 'print-exam', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howPrintExam' },
  { id: 'print-student-copy', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howPrintStudentCopy' },
  { id: 'homework-due-date', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howHomeworkDueDate' },
  { id: 'homework-done', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howHomeworkDone' },
  { id: 'message-one', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howMessageOne' },
  // The sixth pass (2026-10-18). Support groups are found by name too.
  { id: 'rename-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howRenameClass' },
  { id: 'remove-student', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howRemoveStudent' },
  { id: 'move-student', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howMoveStudent' },
  { id: 'link-parent', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howLinkParent' },
  { id: 'reissue-login', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howReissueLoginCode' },
  { id: 'student-sign-in', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howStudentSignIn' },
  {
    id: 'support-groups', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['مجموعات الدعم', 'مجموعه دعم', 'مجموعه الدعم', 'support groups', 'support group'],
    howKey: 'howSupportGroups',
  },
  { id: 'broadcast', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howBroadcast' },
  { id: 'read-messages', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howReadMessages' },
  { id: 'create-exam', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howCreateExam' },
  { id: 'delete-saved', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howDeleteSaved' },
  { id: 'edit-worksheet', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howEditWorksheet' },
  { id: 'ministry-plan', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howMinistryPlan' },
  // The seventh pass (2026-10-18).
  { id: 'plan-lessons', route: '/teaching-plans', labelKey: 'myTeachingPlans', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howPlanLessons' },
  { id: 'timetable', route: '/schedule', labelKey: 'myWeeklySchedule', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howTimetable' },
  { id: 'student-record', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howStudentRecord' },
  { id: 'student-note', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howStudentNote' },
  { id: 'share-material', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howShareMaterial' },
  { id: 'save-slides', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howSaveSlides' },
  { id: 'present', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howPresent' },
  { id: 'share-game', route: '/play', labelKey: 'toolGamesTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howShareGame' },
  { id: 'chat-history', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howChatHistory' },
  { id: 'library-to-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howLibraryToClass' },
  // The eighth live pass (2026-10-19). Each was a feature (or a feature the app
  // lacks) that went to the model, which invented a menu or refused.
  { id: 'parent-message', route: '/ai-tools/parent-message', labelKey: 'toolParentMsgTitle', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howParentMessage' },
  { id: 'join-class', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howJoinClass' },
  { id: 'import-students', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howImportStudents' },
  { id: 'attendance', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howAttendance' },
  { id: 'offline', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howOffline' },
  { id: 'question-bank', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howQuestionBank' },
  { id: 'exam-reminder', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamReminder' },
  // The tenth live pass (2026-10-20). The lab, the math corner and the Quran corner
  // are tiles on the Library tab, found by anchored rules only: «chemistry lab» alone
  // is also a lab report, and «القرآن» a lesson.
  { id: 'lab', route: '/curriculum/lab', labelKey: 'labEntryTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [] },
  { id: 'math-corner', route: '/curriculum/math', labelKey: 'mathEntryTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [] },
  { id: 'quran-corner', route: '/curriculum/quran', labelKey: 'quranTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [] },
  { id: 'whiteboard', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howWhiteboard' },
  { id: 'parent-group', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howParentGroup' },
  { id: 'open-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howOpenClass' },
  { id: 'school-tab', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howSchoolTab' },
  { id: 'backup', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howBackup' },
  { id: 'privacy', route: '/legal/privacy', labelKey: 'privacyPolicy', pathKeys: ['tabProfile', 'settings'], isTool: false, keywords: ['سياسه الخصوصيه', 'privacy policy'], howKey: 'howPrivacy' },
  { id: 'update-app', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howUpdateApp' },
  { id: 'lesson-progress', route: '/teaching-plans', labelKey: 'myTeachingPlans', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howLessonProgress' },
  { id: 'library-videos', route: '/curriculum', labelKey: 'resourcesTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLibraryVideos' },
  { id: 'search-lesson', route: '/curriculum', labelKey: 'resourcesTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howSearchLesson' },
  // The eleventh live pass (2026-10-20): exams and classes. Where the app has no such
  // thing the answer says so, with what it does have.
  { id: 'exam-ranking', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamRanking' },
  { id: 'exam-analysis', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamAnalysis' },
  { id: 'exam-time', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamTime' },
  { id: 'exam-shuffle', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamShuffle' },
  { id: 'question-marks', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howQuestionMarks' },
  { id: 'archived-classes', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howArchivedClasses' },
  { id: 'class-grade', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howClassGrade' },
  // The twelfth live pass (2026-10-21): slides, worksheets, verification, the books.
  { id: 'slide-edit', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howSlideEdit' },
  { id: 'slide-add-reorder', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howSlideAddReorder' },
  { id: 'slide-notes', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howSlideNotes' },
  { id: 'edit-plan', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'faqA5' },
  { id: 'worksheet-answers', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howWorksheetAnswers' },
  { id: 'worksheet-header', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howWorksheetHeader' },
  { id: 'difficulty', route: '/ai-tools/quiz', labelKey: 'toolQuizTitle', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howDifficulty' },
  { id: 'verified-meaning', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howVerified' },
  { id: 'remedial-worksheet', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howRemedial' },
  { id: 'book-download', route: '/curriculum', labelKey: 'resourcesTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howBookDownload' },
  // The thirteenth live pass (2026-10-21). Each was answered by the model: a refusal
  // («خارج مجال عملي») or generic advice, for something the app does or plainly lacks.
  { id: 'change-photo', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howChangePhoto' },
  { id: 'change-phone', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howChangePhone' },
  { id: 'homework-grade', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howHomeworkGrade' },
  { id: 'exam-qr', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamQr' },
  { id: 'exam-parents', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamParents' },
  { id: 'quiz-vs-evaluation', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howQuizVsEvaluation' },
  { id: 'duplicate-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howDuplicateClass' },
  { id: 'games-list', route: '/play', labelKey: 'toolGamesTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howGamesList' },
  { id: 'english-corner', route: '/curriculum/english', labelKey: 'hubTitle', pathKeys: ['tabTools', 'toolsDuringClass', 'toolGamesTitle'], isTool: false, keywords: [], howKey: 'howEnglishCorner' },
  // The fourteenth live pass (2026-10-22).
  { id: 'login-code-lost', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howLoginCodeLost' },
  { id: 'family-view', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howFamilyView' },
  { id: 'parent-link', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howParentLink' },
  { id: 'plan-options', route: '/ai-tools/lesson-plan', labelKey: 'toolLessonPlanTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howPlanOptions' },
  { id: 'plan-language', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howPlanLanguage' },
  { id: 'email-material', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howEmailMaterial' },
  { id: 'timetable-remove', route: '/schedule', labelKey: 'myWeeklySchedule', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howTimetableRemove' },
  { id: 'change-email', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howChangeEmail' },
  { id: 'verify-email', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howVerifyEmail' },
  // The fifteenth live pass (2026-10-22).
  { id: 'chat-voice', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howChatVoice' },
  { id: 'font-size', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howFontSize' },
  { id: 'ai-usage', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howAiUsage' },
  { id: 'homework-edit', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howHomeworkEdit' },
  { id: 'homework-one', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howHomeworkOne' },
  { id: 'class-average', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howClassAverage' },
  { id: 'exam-retake', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamRetake' },
  { id: 'open-grading', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howOpenGrading' },
  { id: 'plan-edit', route: '/teaching-plans', labelKey: 'myTeachingPlans', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howEditTeachingPlan' },
  { id: 'google-sign-in', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howGoogleSignIn' },
  { id: 'languages', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howLanguages' },
  // The sixteenth live pass (2026-10-22).
  { id: 'today-screen', route: '/(tabs)', labelKey: 'tabToday', pathKeys: [], isTool: false, keywords: [], howKey: 'howTodayScreen' },
  { id: 'lesson-prep', route: '/(tabs)', labelKey: 'tabToday', pathKeys: [], isTool: false, keywords: [], howKey: 'howLessonPrep' },
  { id: 'lesson-games', route: '/curriculum', labelKey: 'resourcesTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLessonGames' },
  { id: 'pin-lesson', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'faqA2' },
  { id: 'unpin-lesson', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howUnpinLesson' },
  { id: 'files-find', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howFilesFind' },
  { id: 'files-restore', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howFilesRestore' },
  { id: 'files-to-class', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howFilesToClass' },
  { id: 'student-work', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howStudentWork' },
  { id: 'mastery-gate', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howMasteryGate' },
  { id: 'exam-date-who', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamDateWho' },
  { id: 'school-add', route: '/schedule', labelKey: 'myWeeklySchedule', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howAddSchool' },
  // The seventeenth live pass (2026-10-22).
  { id: 'switch-account', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howSwitchAccount' },
  { id: 'logout-all', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLogoutAll' },
  { id: 'intro-replay', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howIntroReplay' },
  { id: 'mark-all-read', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howMarkAllRead' },
  { id: 'mute-chat', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howMuteChat' },
  { id: 'read-receipts', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howReadReceipts' },
  { id: 'search-messages', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howSearchMessages' },
  { id: 'send-file-message', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howSendFileMessage' },
  { id: 'eval-setup', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howEvalSetup' },
  { id: 'eval-pass-mark', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howEvalPassMark' },
  { id: 'eval-figures', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howEvalFigures' },
  { id: 'lab-about', route: '/curriculum/lab', labelKey: 'labEntryTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [], howKey: 'howLabAbout' },
  { id: 'quran-about', route: '/curriculum/quran', labelKey: 'quranTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [], howKey: 'howQuranAbout' },
  { id: 'math-tools', route: '/curriculum/math', labelKey: 'mathEntryTitle', pathKeys: ['resourcesTitle'], isTool: false, keywords: [], howKey: 'howMathTools' },
  { id: 'subject-average', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howSubjectAverage' },
  { id: 'live-game-start', route: '/ai-tools/classroom', labelKey: 'toolClassroomTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howLiveGameStart' },
  { id: 'live-game-join', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLiveGameJoin' },
  { id: 'live-game-limit', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLiveGameLimit' },
  { id: 'live-game-results', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howLiveGameResults' },
  { id: 'classroom-about', route: '/ai-tools/classroom', labelKey: 'toolClassroomTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howClassroomAbout' },
  { id: 'interactive-deck', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howInteractiveDeck' },
  { id: 'slides-own-text', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howSlidesOwnText' },
  { id: 'slide-theme', route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', pathKeys: ['tabTools', 'toolsBeforeClass'], isTool: false, keywords: [], howKey: 'howSlideTheme' },
  { id: 'activity-types', route: '/ai-tools/activity', labelKey: 'toolActivityTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howActivityTypes' },
  { id: 'activity-group-size', route: '/ai-tools/activity', labelKey: 'toolActivityTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howActivityGroupSize' },
  { id: 'quiz-types', route: '/ai-tools/quiz', labelKey: 'toolQuizTitle', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howQuizTypes' },
  { id: 'worksheet-levels', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howWorksheetLevels' },
  { id: 'worksheet-example', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howWorksheetExample' },
  { id: 'worksheet-count', route: '/ai-tools/worksheet', labelKey: 'toolWorksheetTitle', pathKeys: ['tabTools', 'toolsDuringClass'], isTool: false, keywords: [], howKey: 'howWorksheetCount' },
  {
    // The bottom tab: its route file is still «curriculum» (see `app/(tabs)/_layout.tsx`).
    id: 'library', route: '/curriculum', labelKey: 'resourcesTitle', pathKeys: [], isTool: false,
    keywords: ['المكتبه', 'مكتبه', 'مكتبتي', 'library', 'resource library'],
  },
  { id: 'language', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'faqA16' },
  {
    id: 'subjects', route: '/setup-subjects', routeParams: { mode: 'edit' }, labelKey: 'mySubjects', pathKeys: ['tabProfile'], isTool: false,
    // No bare «grade» / «صف»: they sit inside every «grade 10 quiz» and «للصف العاشر».
    keywords: ['الصفوف', 'صفوفي', 'مواد ادرسها', 'المواد التي ادرسها', 'اضافه صف', 'اضيف صف', 'صف جديد', 'add grade', 'add a grade', 'new grade', 'another grade', 'add subject', 'add a subject', 'another subject', 'subjects i teach', 'اضافه ماده', 'اضيف ماده'],
    howKey: 'howAddGrade',
  },
  // The FAQ's own answers, reachable from the chat. They have no screen of
  // their own, so the button opens the FAQ.
  {
    id: 'start-class', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['ابدا الحصه', 'بدء الحصه', 'شاشه العرض', 'start class', 'start the class', 'projector'],
    howKey: 'faqA7',
  },
  {
    id: 'change-lesson', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['تغيير الدرس', 'تغير الدرس', 'اغير الدرس', 'change lesson', 'change the lesson', 'switch lesson'],
    howKey: 'faqA2',
  },
  {
    id: 'export', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['تصدير', 'اصدر', 'pdf', 'export'],
    howKey: 'faqA4',
  },
  {
    id: 'teaching-plans', route: '/teaching-plans', labelKey: 'myTeachingPlans', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['خطط التدريس', 'خطه فصليه', 'الخطه الفصليه', 'خطه تدريس', 'teaching plan', 'term plan', 'pacing'],
    howKey: 'howTeachingPlan',
  },
  {
    id: 'schedule', route: '/schedule', labelKey: 'myWeeklySchedule', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['جدول', 'الجدول', 'جدول الحصص', 'schedule', 'timetable'],
    howKey: 'howTimetable',
  },
  {
    id: 'calendar', route: '/calendar', labelKey: 'myCalendar', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['تقويم', 'التقويم', 'calendar'],
    howKey: 'howCalendar',
  },
  {
    id: 'workspace', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['محفوظ', 'المحفوظه', 'المحفوظات', 'موادي', 'ملفاتي', 'مساحه العمل', 'saved', 'workspace', 'my materials', 'saved materials', 'saved material', 'مواد محفوظه', 'ملفات محفوظه'],
  },
  {
    id: 'settings', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['اعدادات', 'الاعدادات', 'اللغه', 'settings', 'language'],
  },
  {
    id: 'faq', route: '/faq', labelKey: 'faqTitle', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['مساعده', 'الاسئله الشائعه', 'اسئله شائعه', 'help', 'faq'],
  },
  {
    id: 'profile', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    // No bare «الحساب»: it is also arithmetic («كيف أحذف الحساب من المعادلة»).
    keywords: ['حسابي', 'الملف الشخصي', 'account', 'profile'],
  },
  {
    id: 'curriculum', route: '/curriculum/browse', labelKey: 'tabCurriculum', pathKeys: ['resourcesTitle'], isTool: false,
    keywords: ['المنهاج', 'المنهج', 'الكتب', 'الكتاب المدرسي', 'الدروس', 'curriculum', 'textbook', 'books'],
  },
  {
    id: 'notifications', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false,
    keywords: ['رسائل', 'الرسائل', 'تنبيهات', 'اشعارات', 'الاشعارات', 'اولياء الامور', 'messages', 'notifications', 'inbox'],
  },
  {
    id: 'tools', route: '/ai-tools', labelKey: 'tabTools', pathKeys: [], isTool: false,
    keywords: ['الادوات', 'ادوات', 'tools'],
  },
];

function toolPlaces(): AppPlace[] {
  const out: AppPlace[] = [];
  for (const section of WORKFLOW) {
    for (const tool of section.tools) {
      if (!tool.route) continue;
      out.push({
        id: `tool:${tool.id}`,
        route: tool.route,
        routeParams: tool.routeParams,
        labelKey: tool.titleKey,
        pathKeys: ['tabTools', section.titleKey],
        isTool: true,
        keywords: [...(ID_IS_A_WORD.has(tool.id) ? [] : [tool.id]), ...(TOOL_KEYWORDS[tool.id] ?? [])],
        howKey: TOOL_HOW[tool.id],
      });
    }
  }
  return out;
}

/**
 * Normalised, punctuation-free, and with «ال» dropped from every word, on both
 * sides of the match — so «ورقة العمل» finds «ورقه عمل» and «الاختبار القصير»
 * finds «اختبار قصير» without listing each article-bearing spelling.
 */
function matchForm(s: string): string {
  return normalize(foldAccusative(s.replace(/[؟?!.,،]/g, ' '))).replace(/(^|\s)ال(?=\S{2,})/g, '$1');
}

/**
 * «كيف أضيف صفاً جديداً؟» is «كيف أضيف صف جديد» in its correct written form, and
 * came back as «أيّ مادة تقصد؟» (found on app.iqrra.com, 2026-10-16): `normalize`
 * drops the tanween but not the alif it sits on, so «صفا جديدا» matched nothing.
 * The marked ending (اً or ًا) is dropped from any word. Typed without the mark it
 * is only dropped from the words a grade is added with — «صفا», «جديدا» and the
 * ordinals — since an alif ending is otherwise part of the word.
 */
function foldAccusative(s: string): string {
  return s
    .replace(/(\S)(?:اً|ًا)(?=\s|$)/g, '$1')
    .replace(/(^|\s)((?:ال)?(?:صف|جديد|اضافي|إضافي|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر))ا(?=\s|$)/g, '$1$2');
}

export const APP_PLACES: AppPlace[] = [
  ...toolPlaces(),
  ...SCREENS,
].map(p => ({ ...p, keywords: p.keywords.map(matchForm) }));

const WHERE_PATTERN =
  /(^|\s)(وين|وينه|وينها|اين|فين|من وين)(\s|$)|كيف\s*(ا|ن)?(لاقي|لقي|جد|وصل|فتح|روح)|where\s+(?:is|are|can|do|to|(?:i|we)\s+(?:can|could|should|do|would)|should\s+(?:i|we))\b|how\s+(do|can)\s+i\s+(find|open|get\s+to|reach|access)/i;

/**
 * "How do I add / export / start…" — written against `normalize()` output (hamza
 * folded, ة → ه), so «أضيف» is «اضيف». Like WHERE_PATTERN it claims nothing alone:
 * «كيف أجمع الكسور» and «how to add fractions» name no place and stay teaching.
 *
 * «can I add …», «is there a way to add …» and «ممكن اضيف …» are the yes/no
 * forms of the same question, so only the first person and only the verbs that
 * act on the account («create» and «make» are left out, and so is «انشئ», which
 * reads the same as the imperative: «can we create a quiz on fractions» and
 * «ممكن انشئ اختبار» ask the assistant to make one).
 */
const HOW_ACCOUNT =
  /(كيفيه|كيف|اشلون|شلون|ازاي|طريقه|خطوات)\s*(يمكنني\s*|ممكن\s*)?((ا|ن)?(ضيف|ضف|ضافه|نشي|نشئ|نشاء|عمل|غير|عدل|حذف|صدر|طبع|حفظ|بدا|شارك|ربط|دعو|ستخدم|فعل|شغل)|تغيير|تعديل|تصدير|طباعه|تفعيل|تشغيل|بدء)|\bhow\s+(?:(?:do|can|should)\s+(?:i|we)\s+)?(?:to\s+)?(?:add|create|make|change|edit|delete|remove|export|print|save|share|start|use|link|invite|enable|turn\s+on|switch\s+to)\b|\bcan\s+i\s+(?:add|change|edit|delete|remove|export|print|save|share|link|invite)\b|\b(?:is\s+there\s+(?:a|any|some)\s+way|is\s+it\s+possible|any\s+way)\s+to\s+(?:add|change|edit|delete|remove|export|save|share|link|invite)\b|(?:^|\s)(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?(?:اضيف|اضافه|اغير|اعدل|احذف|اصدر|احفظ|اشارك|اربط|ادعو)(?:\s|$)/i;

/**
 * «how to generate worksheet», «كيف أجهّز ورقة عمل» — how a material is made.
 * These verbs said nothing to the pattern above, so the question fell through
 * to the generator: it made a worksheet titled «how» (found on app.iqrra.com,
 * 2026-10-17). They count only right before a material's name, because «how
 * do I prepare students for the exam» and «كيف أحضّر طلابي» are teaching
 * questions that happen to name a place.
 */
const HOW_MAKE =
  /\bhow\s+(?:(?:do|can|could|should)\s+(?:i|we)\s+)?(?:to\s+)?(?:generate|prepare|build|write|design|produce|get)\s+(?:(?:a|an|the|my|some|new)\s+)?(?:worksheets?|quiz(?:zes)?|(?:lesson\s+)?plans?|activit(?:y|ies)|homework|exams?|tests?|slides|presentations?)\b|(كيفيه|كيف|اشلون|شلون|ازاي|طريقه|خطوات)\s*(يمكنني\s*|ممكن\s*)?(ا|ن)?(جهز|حضر|سوي|ولد|كتب)\s+(ال)?(ورقه|اوراق|خطه|اختبار|امتحان|نشاط|واجب|عرض)/i;

const HOW_PATTERN = new RegExp(`${HOW_ACCOUNT.source}|${HOW_MAKE.source}`, 'i');

/**
 * A plain statement that adds to the account's own lists: «add more classes to
 * my account», «i want to add another class», «بدي اضيف شعبة». It names no
 * where/how word, so unlike the patterns above it is trusted alone, which is why
 * it is this narrow: classes, and grades or subjects, only with a determiner
 * that makes the object a new one («add a grade» alone could be a mark), and
 * only when the object ends the message (bar «to my account» and «please»).
 * «add a class of compounds to the table» and «add a class activity on
 * fractions» fail the anchor and stay teaching. Written against `normalize()`
 * output, as the patterns above are.
 */
const EN_INTENT = String.raw`(?:(?:please|pls|plz)\s+)?(?:(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+`;
const EN_LEAD = String.raw`^(?:(?:please|pls|plz)\s+)?(?:(?:(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+)?`;
/** What may follow the object: a grade, a name or a count for the new class, then «to my account», then «please». */
const EN_QUAL = String.raw`(?:\s+(?:for|in)\s+(?:my\s+)?(?:grade|class|section|year)\s+\d{1,2}[a-z]?|\s+(?:called|named)\s+[a-z0-9]+(?:\s+[a-z0-9]+)?|\s+with\s+\d{1,3}\s+students)?`;
const EN_TAIL = EN_QUAL + String.raw`(?:\s+(?:to|in|into|on)\s+(?:my|the)\s+(?:account|profile|app|list))?(?:\s+(?:please|pls|plz|too|now|here|as\s+well))*$`;
const EN_ADD_TO_ACCOUNT = new RegExp(
  `${EN_LEAD}(?:add|register|set\\s*up)\\s+(?:` +
    String.raw`(?:(?:an?|another|one\s+more|more|new|extra|my|some)\s+)*class(?:es)?(?:\s+\d{1,2}[a-z]?)?` +
    String.raw`|(?:another|more|new|extra|one\s+more)\s+(?:grades?|subjects?)` +
    String.raw`|grades?\s+\d{1,2}` +
  `)${EN_TAIL}`,
);
/**
 * A bare «grade» or «subject» is ambiguous («add a grade» may be a mark), so it
 * needs first-person intent, or «to my account / profile», to be an account add.
 */
const EN_ADD_BARE_GRADE = new RegExp(
  `^${EN_INTENT}(?:add|register|set\\s*up)\\s+(?:(?:an?|another|more|new)\\s+)?(?:grades?|subjects?)${EN_TAIL}`,
);
const EN_ADD_GRADE_TO_MY = new RegExp(
  String.raw`^(?:(?:please|pls|plz)\s+)?add\s+(?:(?:an?|another|more|new)\s+)?(?:grades?|subjects?)\s+(?:to|in|into)\s+my\s+(?:account|profile|list|teaching|grades|subjects|classes)(?:\s+(?:please|pls|plz|too|now))*$`,
);
const AR_INTENT = String.raw`(?:ا?ريد|بدي|ابغي|ابي|ودي|احتاج|محتاج|لازم|عاوز|عايز|حابب|حابه)\s+(?:ان\s+)?`;
const AR_QUAL = String.raw`(?:جديده|جديد|اخري|اخر|اضافيه|اضافي|ثاني|ثانيه|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|\d{1,2})`;
const AR_TAIL =
  String.raw`(?:\s+(?:للصف|لصف|في\s+الصف)\s+\S+)?(?:\s+(?:باسم|اسمها|اسمه)\s+\S+(?:\s+\S+)?)?` +
  String.raw`(?:\s+(?:لي|من\s+فضلك|لو\s+سمحت|الي\s+حسابي|الي\s+التطبيق|في\s+حسابي|في\s+التطبيق))*$`;
const AR_ADD_VERB = String.raw`(?:اضيف|اضافه|اضف|اسجل|تسجيل|سجل)\s+`;
const AR_ADD_TO_ACCOUNT = new RegExp(
  `^(?:${AR_INTENT})?${AR_ADD_VERB}` +
    String.raw`(?:(?:شعبه|شعب)(?:\s+${AR_QUAL})*|(?:صف|صفوف)(?:\s+${AR_QUAL})+)` +
    AR_TAIL,
);
/** «صف» and «مادة» bare are ambiguous too («اضف صفا» is a row): first-person intent required. */
const AR_ADD_BARE_GRADE = new RegExp(
  `^${AR_INTENT}${AR_ADD_VERB}(?:صف|صفوف|ماده|مواد)(?:\\s+${AR_QUAL})*${AR_TAIL}`,
);
/**
 * «i want to change the grade», «اريد ان اغير الصف» and «i need to add lesson»
 * say what the teacher wants without naming the screen that does it: the grades
 * they teach live under «المواد التي أُدرّسها», and a lesson is picked from the bar
 * above the chat, not added. Each maps to the place that answers it. As with the
 * bare «add a grade» they need first-person intent and must end the message —
 * «change the grade of the quiz», «i want to add a lesson plan» and «اريد اضافة
 * درس عن الكسور» stay teaching — and «grade» here can still mean a mark, a guess
 * kept for the same reason as the bare add.
 */
const STATEMENT_PLACES: { re: RegExp; id: string }[] = [
  {
    id: 'subjects',
    re: new RegExp(
      `^${EN_INTENT}(?:change|switch|edit|update|swap)\\s+(?:(?:my|the)\\s+)?(?:grades?|year)(?:\\s+(?:please|pls|plz|now|here))*$`,
    ),
  },
  {
    id: 'subjects',
    re: new RegExp(
      `^${AR_INTENT}(?:اغير|تغيير|اعدل|تعديل|ابدل|تبديل)\\s+(?:ال)?(?:صف|صفي|صفوف|صفوفي)(?:\\s+(?:لي|من\\s+فضلك|لو\\s+سمحت|هنا|الان))*$`,
    ),
  },
  {
    id: 'change-lesson',
    re: new RegExp(
      `^${EN_INTENT}(?:add|pick|choose|select)\\s+(?:(?:an?|another|one\\s+more|new|a\\s+new|the)\\s+)?lessons?(?:\\s+(?:please|pls|plz|now|here))*$`,
    ),
  },
  {
    id: 'change-lesson',
    re: new RegExp(
      `^${AR_INTENT}(?:اضيف|اضافه|اضف|اختار|اختيار|اخير)\\s+(?:ال)?درس(?:\\s+(?:جديد|اخر|ثاني))?(?:\\s+(?:لي|من\\s+فضلك|لو\\s+سمحت|هنا|الان))*$`,
    ),
  },
];
/**
 * «كيف أضيف طالباً جديداً؟», «how do i add a student», «بدي اضيف طلاب للشعبة».
 * Found on app.iqrra.com (2026-10-17): with live AI on, the first went to the
 * model, which said it was a question about the app and gave no steps — no
 * keyword names a student being added, and the bare «students» keyword alone
 * claims nothing. The how-word or intent is optional, but the student must end
 * the message, bar a new / another, and «to my class / الى الشعبة»: «كيف أضيف
 * طالباً إلى مجموعة النقاش» and «add a student to the group work» stay teaching.
 * Written against `plain()` output (hamza and ة folded, accusative dropped).
 */
/** The optional opening of an anchored rule: a how / where / can-I word, or first-person intent. */
const EN_RULE_LEAD = String.raw`^(?:(?:please|pls|plz)\s+)?(?:(?:how\s+(?:do|can|should)\s+(?:i|we)|where\s+(?:do|can|should)\s+(?:i|we)|how\s+to|can\s+(?:i|we)|(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+)?`;
const AR_RULE_LEAD = String.raw`^(?:(?:كيفيه|كيف|اشلون|شلون|ازاي|طريقه|خطوات|وين|اين|من\s+وين|من\s+اين)\s+(?:يمكنني\s+|ممكن\s+|بقدر\s+)?|(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?|${AR_INTENT})?`;
/**
 * The same opening with the how / where / can-I word required. For asks that,
 * said as intent, are a request to the assistant: «اريد اضافة سؤال الى الاختبار»
 * wants a question written, «كيف أضيف سؤالاً إلى الامتحان» wants the button.
 */
const EN_HOW_LEAD = String.raw`^(?:(?:please|pls|plz)\s+)?(?:how\s+(?:do|can|should)\s+(?:i|we)|where\s+(?:do|can|should)\s+(?:i|we)|how\s+to|can\s+(?:i|we))\s+`;
const AR_HOW_LEAD = String.raw`^(?:(?:كيفيه|كيف|اشلون|شلون|ازاي|طريقه|خطوات|وين|اين|من\s+وين|من\s+اين)\s+(?:يمكنني\s+|ممكن\s+|بقدر\s+)?|(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?)`;
const EN_RULE_TAIL = String.raw`(?:\s+(?:please|pls|plz|now|here))*$`;
const AR_RULE_TAIL = String.raw`(?:\s+(?:لي|من\s+فضلك|لو\s+سمحت|هنا|الان))*$`;

const ADD_STUDENT: RegExp[] = [
  new RegExp(
    EN_RULE_LEAD +
      String.raw`add\s+(?:(?:a|an|another|one\s+more|more|new|some|my|the)\s+)*students?(?:\s+names?)?` +
      String.raw`(?:\s+(?:to|in|into)\s+(?:my|the|a|this)\s+(?:class(?:es)?|section|roster|class\s+list))?` + EN_RULE_TAIL,
  ),
  new RegExp(
    AR_RULE_LEAD +
      String.raw`(?:اضيف|اضافه|اضف|نضيف|اسجل|تسجيل|ادخل|ادخال)\s+(?:اسم\s+|اسماء\s+)?(?:ال)?(?:طالب|طالبا|طالبه|طلاب|طلابا|طلبه|طالبات)` +
      String.raw`(?:\s+(?:جديد|جدد|جديده|اخر|اخري|اخرين))?` +
      String.raw`(?:\s+(?:الي|في|ل|لل)\s*(?:ال)?(?:شعبه|شعبتي|صف|صفي|قائمه))?` + AR_RULE_TAIL,
  ),
];

/**
 * Found on app.iqrra.com (2026-10-17), each with live AI on: «كيف أحذف شعبة؟» got
 * the add-a-class steps (a how-word plus «شعبة» was all the matcher saw), and
 * «كيف أسجل الخروج؟», «كيف أغير كلمة المرور؟» and «كيف أشوف نتائج الطلاب؟» went to
 * the model, which guessed or asked which app was meant. Anchored as `ADD_STUDENT`
 * is: the thing asked about ends the message, so «how do i change a password in
 * excel», «كيف أعرف نتائج التجربة» and «how do i delete a class of compounds from
 * the table» stay teaching. Results get the path to the evaluations, where marks
 * are read; the rest have steps.
 */
const AR_PASSWORD = String.raw`(?:ال)?(?:كلمه\s+(?:ال)?(?:مرور|سر)|رقم\s+(?:ال)?سري|باسورد|باسوورد)`;
/** «where is X» / «how do I open X» / «open X» — the lead is required, so a bare noun is not a request. */
const locateEn = (noun: string) =>
  new RegExp(
    String.raw`^(?:please\s+)?(?:where\s+(?:is|are|can\s+i\s+find|do\s+i\s+find)|how\s+(?:do|can)\s+(?:i|we)\s+(?:open|find|get\s+to|access|use|go\s+to|reach)|open|show\s+me)\s+(?:the\s+|my\s+)?` +
      noun + String.raw`(?:\s+in\s+the\s+app)?` + EN_RULE_TAIL,
  );
const locateAr = (noun: string) =>
  new RegExp(
    String.raw`^(?:(?:كيفيه|كيف|اشلون|شلون|ازاي)\s+(?:ا|ن)?(?:فتح|دخل|وصل\s+(?:الي|ل)|جد|لاقي|لقي|شوف|استخدم)\s+|(?:وين|اين|فين)\s+(?:يوجد\s+|هو\s+|هي\s+)?|(?:افتح|فتح)\s+)` +
      noun + String.raw`(?:\s+في\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL,
  );
const RULE_PLACES: { id: string; res: RegExp[] }[] = [
  { id: 'add-student', res: ADD_STUDENT },
  {
    id: 'archive-class',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`delete\s+(?:a\s+|the\s+|my\s+)?class\s+(?:whose|that\s+(?:has\s+)?(?:ended|finished))\s+\w+(?:\s+\w+)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احذف|حذف|ازيل)\s+(?:ال)?شعبه\s+(?:انتهي|انتهت)\s+\S+(?:\s+\S+)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:delete|remove|archive)\s+(?:(?:a|an|the|my|this|that|old)\s+)*class(?:es)?(?:\s+from\s+(?:my|the)\s+(?:list|account|app))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|مسح|ازيل|ازاله|ارشف|ارشفه|الغي|الغاء)\s+(?:ال)?(?:شعبه|شعب|شعبتي)(?:\s+(?:القديمه|قديمه|هذه|من\s+(?:ال)?(?:قائمه|قائمتي|حسابي|تطبيق)))*` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'sign-out',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:sign|log)\s*out(?:\s+of\s+(?:my\s+account|the\s+app))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اسجل|تسجيل|اعمل)\s+(?:ال)?خروج(?:\s+من\s+(?:ال)?(?:حساب|حسابي|تطبيق))?|اخرج\s+من\s+(?:ال)?(?:حساب|حسابي|تطبيق))` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'password',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|reset|update|recover)\s+(?:(?:my|the|a)\s+)?password` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:i\s+)?forgot\s+(?:my\s+)?password(?:\s+what\s+(?:do|should)\s+i\s+do)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|اعدل|تعديل|استرجع|استرجاع|استعيد|استعاده|اعيد\s+تعيين|اعاده\s+تعيين)\s+` + AR_PASSWORD +
          String.raw`(?:\s+(?:تبعي|حقي|حسابي|لحسابي|الخاصه\s+بي))?` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:لقد\s+)?نسيت\s+` + AR_PASSWORD + String.raw`(?:\s+(?:شو|ايش|وش|ماذا|شنو)\s+(?:اعمل|افعل|اسوي))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'tool:evaluations',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|view|check|find)\s+(?:(?:my|the)\s+)?(?:(?:students?'?|class|exam|test)\s+)?(?:results|marks|grades|scores)` +
          String.raw`(?:\s+(?:of|for|from)\s+(?:my|the|this)\s+(?:students|class|exam|test|quiz))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اعرف|اتابع|اطلع\s+علي|اعرض|عرض|متابعه)\s+(?:ال)?(?:نتائج|علامات|درجات)\s+` +
          String.raw`(?:ال)?(?:طلاب|طلبه|طلابي|طلبتي|شعبه|شعبتي|امتحان|امتحانات|اختبار|اختبارات|تقييم|تقييمات)` + AR_RULE_TAIL,
      ),
    ],
  },
  // The second live pass (2026-10-17): each of these went to the model, which
  // invented a menu. Same anchoring: what is asked about ends the message, so
  // «أريد واجباً عن الكسور», «كيف أكتب رسالة للطلاب عن القراءة» and «كيف أحفظ جدول
  // الضرب» stay teaching. Verbs that also mean "make me one" («أنشئ», «اكتب»,
  // «أعطني») are left out on purpose: those are asks for the generator.
  {
    id: 'homework',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|give|post)\s+(?:a\s+)?homework\s+to\s+(?:only\s+)?(?:one|a\s+single)\s+class(?:\s+only)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|انشر|اعطي)\s+واجبا?\s+(?:ل|لل)\s*شعبه\s+واحده(?:\s+فقط)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|add|choose|pick)\s+(?:the\s+|a\s+)?(?:homework\s+)?due\s+date\s+(?:for|of)\s+(?:the\s+|a\s+)?homework` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدد|حدد|اضبط|اضع|اختار)\s+موعد\s+(?:ال)?تسليم\s+(?:ال)?واجب` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|give|set|assign|post|send)\s+(?:(?:a|the|some|new)\s+)*homework(?:\s+(?:to|for)\s+(?:my|the)\s+(?:students|class))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|اضيف|اضافه|اضف|اكلف|انشر|ابعث|ابعت)\s+(?:ال)?(?:واجب|واجبات)(?:\s+(?:منزلي|بيتي|جديد))?` +
          String.raw`(?:\s+(?:ل|الي|لل)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي|شعبه|شعبتي|صف|صفي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-date',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|add|schedule|put)\s+(?:a\s+|the\s+)?date\s+(?:for|of)\s+(?:an?\s+)?(?:upcoming|next|coming)\s+(?:exam|test|quiz)(?:\s+(?:in|on)\s+(?:the\s+)?(?:schedule|timetable))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدد|حدد|اضيف|اضافه|اضبط)\s+موعدا?\s+(?:ل)?(?:ال)?(?:اختبار|امتحان|تقييم)\s+(?:قادم|جديد)(?:\s+في\s+(?:ال)?جدول)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:set|add|choose|pick)\s+(?:(?:an|a|the)\s+)?(?:exam|test)\s+date|schedule\s+(?:(?:an|a|the|my)\s+)?(?:exam|test))(?:\s+(?:to|in|on)\s+(?:the|my)\s+calendar)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضع|احدد|اضيف|تحديد|وضع|اختار)\s+(?:ال)?(?:موعد|تاريخ)\s+(?:لل|ل|ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:لل|الي|في|علي)\s*(?:ال)?تقويم)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-scan',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`scan\s+(?:a\s+)?(?:handwritten|hand-?written)\s+(?:exam\s+)?(?:paper|sheet)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:امسح|مسح|اصور|تصوير)\s+ورقه\s+(?:امتحان|اختبار)\s+مكتوبه\s+ب(?:خط\s+(?:ال)?يد|ال(?:يد))` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:grade|mark|correct)\s+(?:the\s+)?(?:students['’]?\s+)?papers\s+(?:with|using|by)\s+(?:the\s+|my\s+)?(?:phone\s+)?camera` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اصحح|تصحيح)\s+(?:ال)?(?:اوراق|ورق)\s+(?:ال)?(?:طلبه|طلاب)\s+(?:ب|بال)?كاميرا(?:\s+(?:ال)?(?:هاتف|جوال|موبايل))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:scan|photograph)\s+(?:(?:the|my)\s+)?(?:answer\s+sheets?|exam\s+papers?|class\s+papers?|students'?\s+papers?|papers)(?:\s+with\s+(?:the|my)\s+(?:camera|phone))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:امسح|مسح|اصور|تصوير)\s+(?:ال)?(?:اوراق|ورقه)\s+(?:ال)?(?:اجابه|اجابات|امتحان|اختبار|طلاب|طلبه|صف|شعبه)` +
          String.raw`(?:\s+(?:ب|عبر)\s*(?:ال)?(?:كاميرا|جوال|هاتف))?` + AR_RULE_TAIL,
      ),
      // «كيف أصحح أوراق الامتحان بالكاميرا؟» got an invented menu path (found 2026-10-19).
      // The camera has to be named: marking papers in general stays a teaching question.
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:grade|mark|correct|check|scan)\s+(?:(?:the|my)\s+)?(?:(?:exam|test|class|student)\s+)?(?:exams?|papers?|tests?|answer\s+sheets?)\s+(?:with|using|by|via)\s+(?:the\s+|my\s+|a\s+)?(?:camera|phone|scanning|scanner|photos?|pictures?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اصحح|تصحيح)\s+(?:ال)?(?:اوراق|ورقه|امتحانات|امتحان|اختبارات|اختبار)(?:\s+(?:ال)?(?:امتحان|اختبار|طلاب|طلبه|صف|شعبه))?\s+(?:ب|عن\s+طريق|عبر|باستخدام|بواسطه)\s*(?:ال)?(?:كاميرا|تصوير|مسح|جوال|هاتف|موبايل|سكانر)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-chat',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|write)\s+(?:a\s+)?message\s+to\s+(?:a\s+|the\s+|my\s+)?(?:whole\s+|entire\s+)?class` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اكتب)\s+رساله\s+(?:ل|لل)\s*(?:ال)?(?:شعبه|صف)(?:\s+(?:كامله|كاملا|كامل|كلها))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:send|post)\s+(?:an?\s+)?(?:message|announcement)\s+to\s+(?:all\s+(?:of\s+)?)?(?:my\s+|the\s+)?(?:whole\s+)?(?:class|students)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+(?:رساله|رسائل|اعلان|تعميم)\s+(?:ل|الي|لل)\s*(?:كل\s+)?(?:ال)?(?:شعبه|شعبتي|صف|طلاب|طلابي|طلبه|طلبتي)` +
          String.raw`(?:\s+(?:كلها|كلهم|جميعا))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'block',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`block\s+(?:a\s+)?(?:user|person|account)\s+in\s+(?:the\s+)?messages` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احجب|حجب|احظر|حظر)\s+(?:مستخدم|شخص|حساب)\S*\s+(?:في|من)\s+(?:ال)?رسائل` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:block|unblock)\s+(?:(?:a|this|that|the)\s+)?(?:parent|person|user|student|someone|contact)(?:\s+(?:in|from)\s+(?:the\s+)?(?:messages|chat|app))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احظر|حظر|الغي\s+حظر|افك\s+حظر)\s+(?:ولي\s+(?:ال)?امر|شخصا?|مستخدما?|طالبا?|احدا?|حدا)(?:\s+(?:من\s+مراسلتي|في\s+(?:ال)?(?:رسائل|محادثات|تطبيق)))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-name',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|edit|update|fix)\s+my\s+(?:display\s+|account\s+)?name` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اعدل|تعديل|ابدل|اصحح)\s+(?:اسمي|(?:ال)?اسم\s+(?:ال)?(?:ظاهر|حساب))(?:\s+في\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'delete-account',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:delete|remove|close)\s+my\s+account(?:\s+(?:permanently|for\s+good|forever))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احذف|حذف|الغي|الغاء|ازيل)\s+حسابي(?:\s+(?:نهائي\S*|للابد|تماما))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:delete|remove|close|deactivate)\s+(?:my\s+|the\s+)?account(?:\s+permanently)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احذف|حذف|الغي|الغاء|اغلق|اغلاق|امسح|مسح)\s+(?:ال)?(?:حساب|حسابي)(?:\s+نهائيا)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'suggest-feature',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|give|leave|submit)\s+(?:some\s+)?(?:feedback|suggestions?)(?:\s+(?:or|and)\s+(?:feedback|suggestions?))?(?:\s+(?:on|about|for|to)\s+(?:the\s+)?(?:app|iqrra|iqraa))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|اقدم|اكتب|ابعث)\s+(?:ال)?(?:ملاحظات|ملاحظه|اقتراحات|اقتراح)(?:\s+(?:او|و)\s+(?:ال)?(?:ملاحظات|ملاحظه|اقتراحات|اقتراح))?(?:\s+(?:ل|لل|في|علي|عن)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:suggest|request)\s+(?:an?\s+)?(?:new\s+)?(?:feature|idea)(?:\s+for\s+the\s+app)?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|give|leave)\s+(?:some\s+)?feedback(?:\s+(?:on|about)\s+(?:the\s+)?app)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اقترح|اقتراح|اطلب|طلب)\s+(?:ميزه|خاصيه|ميزات|خصائص|فكره)(?:\s+(?:جديده|جديد))?|(?:ارسل|اقدم)\s+(?:اقتراح|ملاحظه|ملاحظات))` +
          String.raw`(?:\s+(?:ل|في|علي|عن)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'report-problem',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`report\s+(?:a\s+)?(?:problem|issue|mistake|error)\s+(?:in|with)\s+(?:a\s+)?(?:generated\s+)?question` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابلغ|تبليغ|اعمل\s+بلاغ)\s+عن\s+(?:مشكله|خطا)\s+في\s+(?:ال)?سؤال(?:\s+(?:ال)?مولد\S*)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`report\s+(?:an?\s+)?(?:problem|error|mistake|issue)(?:\s+(?:in|with|on)\s+(?:the|a|this)\s+(?:worksheet|quiz|lesson\s+plan|activity|slides|answer|result))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ابلغ|ابلاغ|بلغ|تبليغ)\s+(?:عن\s+)?(?:خطا|مشكله|غلط)` +
          String.raw`(?:\s+في\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|امتحان|خطه\s+(?:ال)?درس|نشاط|عرض|اجابه|نتيجه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'regenerate',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:regenerate|redo|re-?make)\s+(?:the\s+|a\s+|my\s+)?(?:worksheet|lesson\s+plan|activity)(?:\s+with\s+(?:different|new)\s+questions)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+(?:توليد|تجهيز|انشاء)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|نشاط)(?:\s+ب(?:اسئله|محتوي)\s+(?:مختلفه|جديده))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:regenerate|redo|remake)\s+(?:(?:the|a|my|this)\s+)?(?:worksheet|quiz|lesson\s+plan|activity|slides|exam)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+(?:توليد|تجهيز|انشاء|صنع)(?:\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|امتحان|خطه\s+(?:ال)?درس|نشاط|عرض|شرائح|واجب|اسئله))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'save-material',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:save|keep)\s+(?:(?:the|a|my|this)\s+)?(?:lesson\s+plan|worksheet|quiz|activity|exam)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احفظ|حفظ|نحفظ)\s+(?:ال)?(?:خطه\s+(?:ال)?درس|ورقه\s+(?:ال)?عمل|اختبار|امتحان|نشاط|واجب)(?:\s+(?:هذه|هذا|في\s+(?:ال)?ملفاتي|عندي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-lesson',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:choose|pick|select|change|switch)\s+(?:to\s+)?(?:(?:a|another|the|a\s+different)\s+)?lesson` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اختار|اختيار|اغير|تغيير|ابدل|تبديل|انتقل\s+(?:الي|ل))\s+(?:ال)?درس(?:\s+(?:اخر|ثاني|جديد|غيره))?` + AR_RULE_TAIL,
      ),
    ],
  },
  // The fourth live pass (2026-10-18). Same anchoring as above: «كيف أنشر الوعي
  // بين الطلاب», «كيف أرفع مستوى الطلاب» and «كيف أدعو الطلاب للمشاركة» stay
  // teaching. The exam is the shareable one (an evaluation); the generator's
  // quiz can only be exported, so «quiz» is left out.
  {
    id: 'share-exam',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:share|send|give)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|evaluation|quiz)\s+(?:link|code)(?:\s+(?:via|on|through|by|using|over)\s+(?:whatsapp|email|sms|telegram))?(?:\s+(?:to|with)\s+(?:my\s+|the\s+)?(?:students|class|section))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشارك|شارك|مشاركه|ارسل|ابعث|ابعت|انسخ)\s+(?:ال)?(?:رابط|كود|رمز)\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:عبر|علي|في|ب|من\s+خلال)\s*(?:ال)?(?:واتساب|واتس\s*اب|whatsapp|ايميل|بريد|تلغرام|رسائل))?(?:\s+(?:مع|ل|لل|الي)\s*(?:ال)?(?:طلبه|طلاب|طلبتي|طلابي|شعبه|شعبتي))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:share|send|give|publish|post|assign)\s+(?:(?:an?|the|my|this)\s+)?(?:exam|test|evaluation)(?:\s+(?:link|code))?` +
          String.raw`(?:\s+(?:to|with)\s+(?:my\s+|the\s+)?(?:students|class|section))?(?:\s+(?:online|on\s+the\s+app|on\s+their\s+phones))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^how\s+(?:do|can|will|should)\s+(?:my\s+|the\s+)?students?\s+(?:open|take|access|find|get\s+to|join|start|enter|sit)\s+(?:(?:the|an?|my|this)\s+)?(?:exam|test|evaluation)` +
          String.raw`(?:\s+(?:online|on\s+(?:the\s+app|their\s+phones)))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انشر|نشر|اشارك|شارك|مشاركه|ارسل|ابعث|ابعت)\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:ال)?الكتروني)?` +
          String.raw`(?:\s+(?:ل|الي|لل|مع|علي)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي|شعبه|شعبتي|صف|صفي))?(?:\s+(?:علي|في|عبر)\s+(?:ال)?(?:تطبيق|جوال|هاتف|موقع|انترنت))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:كيف|وين|من\s+وين|من\s+اين)\s+(?:يدخل|يفتح|يقدم|يلاقي|يصل|يوصل)\s+(?:ال)?(?:طالب|طلاب|طلبه)\s+(?:(?:علي|الي|ل)\s*)?(?:ال)?(?:امتحان|اختبار|تقييم)` +
          String.raw`(?:\s+(?:من|علي|في)\s+(?:ال)?(?:تطبيق|جوال|هاتف|موقع))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-submissions',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|know|check|tell)\s+who\s+(?:has\s+|have\s+)?(?:submitted|handed\s+in|finished|taken)\s+(?:the\s+)?(?:exam|test|quiz|evaluation)(?:\s+and\s+who\s+(?:has\s+not|hasn['’]?t|have\s+not|haven['’]?t|didn['’]?t)\s+\w+(?:\s+in)?)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اعرف|اشوف|اتابع)\s+(?:من|مين)\s+(?:سلم|قدم|انهي|حل)\s+(?:ال)?(?:اختبار|امتحان|تقييم)(?:\s+ومن\s+لم\s+(?:يسلم|يقدم|ينهي|يحل))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|know|check|find\s+out)\s+which\s+(?:of\s+my\s+)?students\s+(?:have\s+)?(?:opened|started|taken|done|submitted|finished)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|evaluation)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اتابع|اتاكد)\s+(?:مين|من|منو)(?:\s+(?:من|بين)\s+(?:ال)?(?:طلبه|طلاب))?\s+(?:فتح|دخل|بدا|حل|سلم|قدم|فتحوا|دخلوا)\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:من|بين)\s+(?:ال)?(?:طلبه|طلاب))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:see|check|know|find\s+out|view|tell)\s+who\s+(?:has\s+|have\s+)?(?:submitted|handed\s+in|turned\s+in|took|sat|finished|completed|did\s+not\s+submit|didn['’]?t\s+submit|hasn['’]?t\s+submitted)` +
          String.raw`|(?:see|check|view)\s+(?:the\s+)?(?:students'?\s+)?submissions)(?:\s+(?:of\s+|for\s+)?(?:the|my|this|an?)\s+(?:exam|test|evaluation))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اتابع|اتاكد)\s+(?:مين|من|منو|اسماء\s+(?:ال)?(?:طلاب|طلبه)\s+(?:الذين|اللي|يلي))\s+(?:سلم|سلموا|قدم|قدموا|حل|حلوا|انهي|انهوا|لم\s+يسلم|ما\s+سلم|ما\s+سلموا)\s+(?:ال)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'send-worksheet',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:let|have|make)\s+(?:my\s+)?students\s+(?:solve|do|take|answer|complete)\s+(?:the\s+|a\s+|my\s+)?worksheet\s+(?:on|from|using|with)\s+(?:their\s+)?(?:phones?|mobiles?|devices|the\s+app)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اجعل|خلي|اخلي)\s+(?:ال)?(?:طلبه|طلاب)\s+(?:يحلون|يحلو|يجاوبون)\s+(?:ال)?ورقه\s+(?:ال)?عمل\s+(?:علي|ع|في|من|ب)\s*(?:هواتفهم|جوالاتهم|موبايلاتهم|ال?جوال|ال?هاتف|ال?تطبيق)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:send|share|assign|give|post)\s+(?:(?:a|the|my|this)\s+)?worksheets?(?:\s+(?:to|with)\s+(?:my\s+|the\s+)?(?:students|class|section))?` +
          String.raw`(?:\s+to\s+(?:solve|do|answer)(?:\s+it)?)?(?:\s+(?:on\s+the\s+app|online|digitally|on\s+their\s+phones))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اشارك|شارك|انشر)\s+(?:ال)?(?:ورقه|اوراق)\s+(?:ال)?عمل(?:\s+(?:ل|الي|لل|مع)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي|شعبه|شعبتي|صف|صفي))?` +
          String.raw`(?:\s+(?:(?:ل|كي|حتي)\s*)?(?:يحلوها|يحلونها|يحلوا|يحلها|يجيبوا|يجيبون))?(?:\s+(?:علي|في|عبر|من\s+خلال)\s+(?:ال)?(?:تطبيق|جوال|هاتف|موقع|انترنت))?` +
          String.raw`(?:\s+كواجب(?:\s+رقمي)?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'notification-settings',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:turn\s+on|enable|activate|turn\s+off|disable)\s+(?:the\s+)?notifications(?:\s+on\s+(?:my\s+)?(?:phone|device))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افعل|فعل|اشغل|اوقف|اطفي)\s+(?:ال)?(?:اشعارات|تنبيهات)(?:\s+(?:علي|في)\s+(?:هاتفي|جوالي|موبايلي|ال(?:هاتف|جوال)))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:turn\s+off|turn\s+on|disable|enable|stop|mute|silence|unmute|manage|change)\s+(?:(?:the|all|my|push|app)\s+)*notifications?` +
          String.raw`(?:\s+(?:from|for|on)\s+(?:the\s+app|iqrra|iqraa|my\s+phone))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اوقف|ايقاف|وقف|اطفي|اطفئ|الغي|الغاء|اكتم|كتم|افعل|تفعيل|اشغل|تشغيل|اغير|تغيير|اضبط|ضبط|اعدل|تعديل)\s+(?:ال)?(?:اشعارات|تنبيهات|اشعار|تنبيه)` +
          String.raw`(?:\s+(?:ال)?(?:تطبيق|هاتف|جوال))?(?:\s+(?:من|في|علي)\s+(?:ال)?(?:تطبيق|هاتف|جوال))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'contact-support',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:contact|reach|email|message|talk\s+to|get\s+in\s+touch\s+with|call)\s+(?:the\s+)?(?:support(?:\s+team)?|help\s+desk|iqrra(?:\s+team)?|iqraa(?:\s+team)?|team|customer\s+service|technical\s+support|tech\s+support)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اتواصل|تواصل|التواصل|اتصل|اكلم|اراسل)\s+(?:(?:مع|ب|علي|الي)\s*)?(?:ال)?(?:دعم(?:\s+(?:ال)?فني)?|فريق\s+(?:ال)?(?:دعم|تطبيق)|فريق\s+اقرا|اداره\s+(?:ال)?تطبيق|اداره\s+اقرا|خدمه\s+(?:ال)?عملاء)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'upload-file',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:upload|attach|send)\s+(?:a\s+)?(?:pdf|word)(?:\s+file)?\s+(?:to|so\s+(?:i\s+can|that\s+i\s+can)|and)\s+ask(?:\s+\w+)?(?:\s+about\s+it)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احمل|ارفع|ارسل|ارفق)\s+(?:ملف\s+)?(?:pdf|وورد|word)\s+(?:ل|كي\s+)?اسال\s+عنه(?:\s+اقرا)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|upload|attach|share)\s+(?:an?\s+|the\s+|my\s+)?(?:image|picture|photo|screenshot)s?\s+(?:in|to|into)\s+(?:the\s+)?(?:chat|conversation)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ارسال|ارفع|ابعث|ابعت|ارفاق|رفع)\s+(?:ال)?(?:صوره|صور)\s+(?:في|ل|الي|لل)\s*(?:ال)?محادثه` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:upload|import)\s+(?:(?:a|an|the|my|this|some)\s+)*(?:pdfs?|files?|documents?|books?|textbooks?|word\s+files?|pdf\s+files?)(?:\s+(?:of|from)\s+(?:the|my)\s+(?:book|textbook))?` + EN_RULE_TAIL,
      ),
      // «أرفق ملفًا» is left out: a class page attaches a file from My files under that very label.
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارفع|رفع)\s+(?:(?:ال)?(?:ملف|ملفات|مستند|مستندات)(?:\s+(?:pdf|بي\s+دي\s+اف|وورد|word))?(?:\s+(?:من|عن)\s+(?:ال)?(?:كتاب|منهاج))?|(?:ال)?كتاب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'export-marks',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:export|download|get)\s+(?:the\s+)?class\s+(?:marks|grades)\s+(?:to|as|in)\s+(?:an?\s+)?(?:excel|spreadsheet|csv)(?:\s+file)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اصدر|تصدير|احمل|انزل|انقل)\s+(?:ال)?(?:علامات|درجات|نتائج)\s+(?:ال)?(?:صف|شعبه|طلبه)\s+(?:الي|ل|في)\s+(?:ملف\s+)?(?:ال)?(?:اكسل|excel)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`print\s+(?:the\s+|my\s+)?(?:class\s+|students?['’]?\s+)?(?:mark\s+sheet|marks|grades|gradebook|results)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اطبع|طباعه)\s+(?:ال)?(?:كشف\s+(?:ال)?علامات|علامات|درجات|نتائج)(?:\s+(?:ال)?(?:شعبه|طلاب|طلبه|امتحان|اختبار))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:export|download|transfer)\s+(?:(?:the|my|all|all\s+the)\s+)?(?:(?:students?'?|class|exam|test)\s+)?(?:marks|grades|results|scores|mark\s+sheet|gradebook)` +
          String.raw`(?:\s+(?:to|as|in|into)\s+(?:an?\s+)?(?:excel(?:\s+(?:file|sheet))?|spreadsheet|csv|google\s+sheets))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اصدر|تصدير|انقل|نقل|احمل|تحميل|انزل|تنزيل)\s+(?:ال)?(?:علامات|درجات|نتائج|كشف\s+(?:ال)?علامات)(?:\s+(?:ال)?(?:طلاب|طلبه|شعبه|امتحان|اختبار))?` +
          String.raw`(?:\s+(?:(?:الي|ل|علي|ب|في|ك)\s*)?(?:ال)?(?:اكسل|excel|ملف\s+(?:ال)?(?:اكسل|excel)))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'copy-exam',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`reuse\s+(?:a\s+|an\s+|the\s+)?(?:previous|old|earlier)\s+(?:exam|test)\s+(?:for|with)\s+(?:a\s+)?new\s+class` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+استخدام\s+(?:امتحان|اختبار)ا?\s+(?:سابق|قديم)ا?\s+(?:ل|لل)\s*شعبه\s+جديده` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:copy|duplicate|reuse|clone)\s+(?:(?:an?|the|my|this)\s+)?(?:exam|test|evaluation)|(?:give|use|send|share)\s+the\s+same\s+(?:exam|test|evaluation))` +
          String.raw`(?:\s+(?:to|for|with)\s+(?:another|a\s+different|a\s+second|my\s+other|the\s+other|other)\s+(?:class|section))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انسخ|نسخ|اكرر|تكرار|كرر|اعيد\s+استخدام)\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:نفسه|ذاته))?` +
          String.raw`(?:\s+(?:ل|الي|لل|في|مع)\s*(?:ال)?(?:شعبه|صف)(?:\s+(?:ثانيه|ثاني|اخري|اخر|ثالثه|جديده))?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'invite-teacher',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:invite|add)\s+(?:(?:a|an|another|other|more|my|some)\s+)*(?:teachers?|colleagues?|co-?teachers?)(?:\s+(?:to|into)\s+(?:the\s+app|iqrra|iqraa|my\s+(?:class|school|account)))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ادعو|دعوه|اضيف|اضافه|اضف)\s+(?:ال)?(?:معلم|معلمه|معلمين|معلمات|زميل|زميله|زملاء|زملائي|زملاي|استاذ)(?:\s+(?:اخر|اخري|اخرين|جديد))?` +
          String.raw`(?:\s+(?:الي|ل)\s*(?:ال)?(?:تطبيق|اقرا|شعبه|شعبتي|مدرسه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    // Bringing the class in is the link code. «to participate» and «للمشاركة» fail the anchor.
    id: 'link-code',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|share|give)\s+(?:the\s+)?(?:link|join)\s+code\s+to\s+(?:the\s+)?parents` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|شارك|اشارك)\s+رمز\s+(?:ال)?(?:انضمام|ربط)\s+(?:ل|لل)\s*(?:ال)?(?:اولياء\s+(?:ال)?امور|اهل|اهالي)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:share|send|give|hand\s+out|find|get|see)\s+(?:the\s+|my\s+|a\s+)?(?:(?:class|classroom)\s+code|link\s+code|join\s+code)(?:\s+(?:of|for)\s+(?:the\s+|my\s+)?(?:class|section))?(?:\s+(?:with|to)\s+(?:my\s+|the\s+)?(?:students|parents|class|pupils|families))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشارك|شارك|مشاركه|ارسل|ابعث|ابعت|اعطي|اوزع|اعرف|اشوف|اري|اجد|الاقي|احصل\s+علي)\s+(?:ال)?(?:كود|رمز)\s+(?:ال)?(?:شعبه|صف)(?:\s+(?:مع|ل|لل|الي)\s*(?:ال)?(?:طلبه|طلاب|طلبتي|طلابي|اولياء\s+(?:ال)?امور|اهل|اهالي))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`invite\s+(?:(?:the|my)\s+)?(?:parents|students|families)(?:\s+(?:to|into)\s+(?:the\s+app|iqrra|iqraa|my\s+class))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ادعو|دعوه)\s+(?:ال)?(?:اولياء\s+(?:ال)?امور|ولي\s+(?:ال)?امر|اهالي|اهل|طلاب|طلابي|طلبه|طلبتي)(?:\s+(?:الي|ل)\s*(?:ال)?(?:تطبيق|اقرا|شعبه|شعبتي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'install-app',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:download|install|get)\s+(?:(?:the|this)\s+)?(?:app|iqrra|iqraa|iqrra\s+app|mobile\s+app|android\s+app|iphone\s+app)(?:\s+(?:on|to|for)\s+(?:my\s+|a\s+)?(?:phone|mobile|android|iphone|ipad|tablet))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احمل|تحميل|انزل|تنزيل|نزل|اثبت|تثبيت|انصب|تنصيب)\s+(?:ال)?(?:تطبيق|برنامج|اقرا)(?:\s+(?:ال)?تطبيق)?` +
          String.raw`(?:\s+(?:علي|في)\s+(?:ال)?(?:جوال|جوالي|موبايل|هاتف|هاتفي|تلفون|تلفوني|ايفون|اندرويد|ايباد|تابلت))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'pricing',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:know|see|find\s+out|check)\s+(?:the\s+)?(?:subscription\s+)?(?:price|cost)(?:\s+of\s+(?:the\s+)?(?:subscription|app))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|ارى|اري|اسال\s+عن)\s+سعر\s+(?:ال)?(?:اشتراك|تطبيق)` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:is|are)\s+(?:(?:the|this)\s+)?(?:app|iqrra|iqraa|platform|website|site|service)\s+(?:(?:really|totally|completely)\s+)?free(?:\s+(?:to\s+use|for\s+teachers))?` + EN_RULE_TAIL),
      new RegExp(String.raw`^how\s+much\s+(?:does|is)\s+(?:(?:the|this)\s+)?(?:app|iqrra|iqraa|subscription)(?:\s+cost)?` + EN_RULE_TAIL),
      new RegExp(String.raw`^do\s+(?:i|we)\s+(?:have|need)\s+to\s+pay(?:\s+for\s+(?:the\s+app|iqrra|iqraa|it))?` + EN_RULE_TAIL),
      new RegExp(
        String.raw`^(?:هل\s+)?(?:ال)?(?:تطبيق|برنامج|موقع|منصه|اقرا)(?:\s+اقرا)?\s+(?:مجاني|مجانيه|مجانا|مجان|ببلاش|بلاش|مدفوع)` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:كم|بكم)\s+(?:(?:سعر|ثمن|تكلفه|اشتراك)\s+)?(?:ال)?(?:تطبيق|اقرا|اشتراك)` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:هل\s+)?(?:يجب|لازم|علي)\s+(?:ان\s+)?(?:ادفع|دفع)(?:\s+(?:مقابل|علي|ل)\s*(?:ال)?(?:تطبيق|اقرا))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'question-image',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|attach|insert|put)\s+(?:a\s+)?(?:picture|image|figure|diagram)\s+(?:to|in|on)\s+(?:the\s+|a\s+|my\s+)?worksheet` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|ارفق|ادرج|اضع)\s+(?:ال)?(?:صوره|شكلا?|رسما?)\s+(?:الي|في|ل)\s*(?:ال)?ورقه\s+(?:ال)?عمل` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|insert|attach|put|upload)\s+(?:(?:an?|the|my)\s+)?(?:image|picture|photo|figure|diagram|drawing)\s+(?:to|in|into|on|for)\s+(?:(?:a|the|my|this|each)\s+)?(?:exam\s+|worksheet\s+)?questions?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضف|ارفق|ادرج|احط|اضع)\s+(?:ال)?(?:صوره|صور|شكل|رسمه|رسم)\s+(?:ل|لل|الي|في|مع|علي)\s*(?:ال)?(?:سؤال|اسئله)` + AR_RULE_TAIL,
      ),
    ],
  },
  // The fifth live pass (2026-10-18). The exam is named as the object's place,
  // so «كيف أكتب سؤالاً جيداً؟», «كيف أغلق الحصة بنشاط ممتع؟» and «كيف أعلن النتائج
  // للطلاب بطريقة لطيفة؟» stay teaching.
  {
    id: 'edit-exam-questions',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`add\s+(?:a\s+)?(?:question\s+)?manually\s+to\s+(?:an?\s+|the\s+)?(?:exam|test|evaluation)` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`add\s+(?:my\s+own|a\s+custom)\s+question\s+to\s+(?:an?\s+|the\s+)?(?:exam|test|evaluation)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضف)\s+سؤالا?\s+يدويا?\s+(?:الي|ل|لل)\s*(?:امتحان|(?:ال)?(?:امتحان|اختبار|تقييم))` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:regenerate|re-?generate|redo|re-?roll)\s+(?:the\s+|my\s+)?(?:evaluation|exam|test)\s+questions` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+(?:توليد|تكوين|انشاء)\s+(?:ال)?(?:اسئله)\s+(?:ال)?(?:تقييم|امتحان|اختبار)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|edit|set|update)\s+(?:the\s+)?(?:marks?|points?|score)\s+(?:of|for)\s+(?:a\s+|the\s+)?question(?:\s+in\s+(?:the\s+|an?\s+)?(?:evaluation|exam|test))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اعدل|تعديل|اضبط|ضبط)\s+(?:ال)?(?:علامه|درجه)\s+(?:ال)?سؤال(?:\s+(?:في|ب)\s+(?:ال)?(?:تقييم|امتحان|اختبار))?` + AR_RULE_TAIL),
      new RegExp(
        EN_HOW_LEAD + String.raw`(?:(?:delete|remove|edit|change|add|write)\s+(?:(?:a|an|the|my|one|this|some)\s+)*(?:own\s+)?questions?\s+(?:from|in|to|into|on|of)\s+(?:(?:the|my|an?|this)\s+)?(?:exam|test|evaluation)` +
          String.raw`|write\s+(?:(?:the|my)\s+)?(?:exam|test)\s+questions\s+(?:myself|by\s+myself|on\s+my\s+own))` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_HOW_LEAD + String.raw`(?:(?:احذف|حذف|امسح|مسح|اعدل|تعديل|اغير|تغيير|اضيف|اضافه|اضف|اكتب|كتابه)\s+(?:ال)?(?:سؤال|اسئله)(?:\s+(?:من\s+(?:عندي|اعدادي)|بنفسي))?\s+(?:من|في|الي|لل|ل)\s*(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+بنفسي)?` +
          String.raw`|(?:اكتب|كتابه|اضع|اضيف)\s+(?:ال)?اسئله\s+(?:ال)?(?:امتحان|اختبار|تقييم)\s+بنفسي)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'close-exam',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:close|stop|end)\s+(?:the\s+)?(?:exam|test|quiz|evaluation)\s+(?:early|before\s+(?:time|it\s+ends|the\s+time\s+is\s+up))` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغلق|اوقف|انهي|ايقاف|اغلاق|انهاء)\s+(?:ال)?(?:اختبار|امتحان|تقييم)\s+قبل\s+(?:انتهاء|نهايه)\s+(?:وقته|الوقت|موعده)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:close|end|stop|lock)\s+(?:(?:the|an?|my|this)\s+)?(?:exam|test|evaluation)(?:\s+link)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغلق|اغلاق|اقفل|اقفال|اوقف|ايقاف|انهي|انهاء)\s+(?:(?:ال)?(?:امتحان|اختبار|تقييم)|رابط\s+(?:ال)?(?:امتحان|اختبار))` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'edit-mark',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`enter\s+(?:the\s+)?(?:marks|grades)\s+of\s+(?:a\s+)?paper\s+(?:exam|test)\s+(?:manually|by\s+hand)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ادخل|ادخال|اسجل|تسجيل)\s+علامات\s+(?:امتحان|اختبار)\s+ورقي\s+(?:يدويا|يدوي|باليد)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|edit|fix|correct|update|override)\s+(?:(?:a|the|my|one)\s+)?(?:students?['’]?s?\s+(?:marks?|grades?|scores?)|(?:marks?|scores?)(?:\s+(?:for|of)\s+(?:a|one|the|this)\s+student)?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير|اصحح|تصحيح)\s+(?:ال)?(?:علامه|علامات|درجه|درجات)\s+(?:ال)?(?:طالب|طالبه|طلاب|طلبه)(?:\s+(?:واحد|معين))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'release-results',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:hide|unpublish|take\s+down)\s+(?:the\s+)?(?:exam|test|quiz)\s+results\s+from\s+(?:the\s+)?students(?:\s+after\s+\w+(?:\s+\w+)?)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اخفي|اخفاء|اخفى)\s+(?:ال)?نتائج\s+(?:ال)?(?:امتحان|اختبار|تقييم)\s+عن\s+(?:ال)?(?:طلبه|طلاب)(?:\s+بعد\s+\S+(?:\s+\S+)?)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:release|publish|announce|send)\s+(?:the\s+)?(?:results|marks|grades|scores)(?:\s+(?:to|with)\s+(?:my\s+|the\s+)?(?:students|class|parents))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعلن|اعلان|انشر|نشر|ارسل|اظهر|اظهار)\s+(?:ال)?(?:نتائج|علامات|درجات)(?:\s+(?:ال)?(?:امتحان|اختبار))?` +
          String.raw`(?:\s+(?:ل|الي|لل)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي|اهالي|اولياء\s+(?:ال)?امور))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'print-student-copy',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`print\s+(?:(?:(?:the|a|my|this)\s+)?(?:worksheet|quiz|exam|test|paper)\s+(?:without|with\s+no)\s+(?:the\s+)?(?:answers|answer\s+key|key)|(?:a\s+|the\s+)?student\s+copy)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اطبع|طباعه|نطبع)\s+(?:(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|امتحان|ورقه)\s+(?:بدون|بلا|من\s+غير|دون)\s+(?:ال)?(?:اجابات|اجابه|حلول|حل|مفتاح(?:\s+(?:ال)?اجابات)?)|نسخه\s+(?:ال)?طالب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'print-exam',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`print\s+(?:the\s+)?student(?:['’]?s)?\s+copy\s+of\s+(?:the\s+)?(?:exam|test)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اطبع|طباعه)\s+نسخه\s+(?:ال)?طالب\s+من\s+(?:ال)?(?:امتحان|اختبار)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`print\s+(?:(?:the|an?|my|this)\s+)?(?:exam|test|evaluation)(?:\s+papers?)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اطبع|طباعه|نطبع)\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:ورقيا|ورقي))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'start-class',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:show|present|display|project|put)\s+(?:(?:the|my|a|this)\s+)?lesson\s+(?:on|onto)\s+(?:(?:the|a)\s+)?(?:smart\s*board|board|projector|screen|big\s+screen|tv|whiteboard|interactive\s+board)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرض|عرض|اشغل|تشغيل)\s+(?:ال)?درس\s+(?:علي|في|ع)\s+(?:ال)?(?:سبوره(?:\s+(?:ال)?(?:ذكيه|تفاعليه))?|شاشه(?:\s+(?:ال)?(?:عرض|صف|كبيره))?|بروجكتر|بروجيكتور|داتا\s+شو|تلفاز|تلفزيون)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'homework-due-date',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|edit|move|extend|update|postpone)\s+(?:(?:the|a|my)\s+)?(?:homework\s+)?(?:due\s+date|deadline)(?:\s+(?:of|for)\s+(?:the|a|my)\s+homework)?` + EN_RULE_TAIL,
      ),
      new RegExp(EN_RULE_LEAD + String.raw`edit\s+(?:(?:the|a|my)\s+)?homework` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اغير|تغيير|اعدل|تعديل|امدد|تمديد|اؤجل|اوجل|تاجيل)\s+(?:ال)?(?:موعد|تاريخ)\s+(?:ال)?تسليم(?:\s+(?:ال)?(?:واجب|واجبات))?|(?:اعدل|تعديل)\s+(?:ال)?واجب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'homework-done',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|know|find|check)\s+(?:which\s+)?students\s+(?:who\s+)?(?:have\s+not|haven['’]?t|did\s+not|didn['’]?t)\s+(?:submitted|handed\s+in|turned\s+in|done)\s+(?:the\s+)?homework` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|ارى|اري|اشوف)\s+(?:ال)?(?:طلاب|طلبه)\s+(?:ال)?ذين\s+لم\s+(?:يسلمو|يسلم|ينجزو|ينجز)\S*\s+(?:ال)?واجب` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|check|know|find\s+out|track|view)\s+(?:(?:who|which\s+students)\s+(?:(?:has|have)\s+not\s+|hasn['’]?t\s+|haven['’]?t\s+|didn['’]?t\s+|did\s+not\s+|(?:has|have)\s+)?(?:done|did|finished|completed|submitted|handed\s+in)\s+(?:(?:the|their)\s+)?homework` +
          String.raw`|(?:(?:my|the)\s+)?(?:students['’]?\s+)?homework(?:\s+(?:completion|progress|status))?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اتابع|متابعه)\s+(?:(?:مين|من|منو)\s+(?:انجز|حل|سلم|عمل|ما\s+حل|لم\s+يحل|ما\s+سلم|ما\s+انجز|لم\s+يسلم|لم\s+ينجز)\s+(?:ال)?واجب|(?:ال)?واجبات\s+(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي)|انجاز\s+(?:ال)?(?:طلاب|طلبه)\s+(?:لل)?واجب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    // «كيف أرسل رسالة لولي أمر؟» went to the model, which drafted a letter in the
    // chat (found 2026-10-19). The tool that writes it has steps; one parent, never
    // «all parents» (that is `broadcast`), and ahead of `message-one` so a letter
    // is not answered with the Messages tab alone.
    id: 'parent-message',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:write|send|draft|compose|prepare|make|create|text|email)\s+(?:an?\s+|the\s+)?(?:(?:short\s+|formal\s+|warm\s+)?(?:message|letter|note|email)\s+(?:to|for)\s+)?(?:a|the|my|one|each|this|that)\s+(?:student['’]?s?\s+)?(?:parent|guardian)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اكتب|اجهز|احضر|اعمل|اصيغ|اراسل)\s+رساله\s+(?:رسميه\s+|مكتوبه\s+)?(?:ل|الي|لل)\s*(?:ال)?ولي\s+(?:ال)?امر(?:\s+(?:ال)?طالب\S*)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    // One person, never the class (that is `class-chat`).
    id: 'message-one',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:message|send\s+(?:an?\s+)?(?:private\s+|direct\s+)?message\s+to)\s+(?:(?:a|one|the|this|that)\s+)?(?:single\s+|specific\s+|particular\s+|individual\s+)?(?:student|parent)(?:['’]s\s+parent)?(?:\s+(?:directly|privately|alone|only))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اراسل|مراسله)\s+(?:ال)?(?:طالب|ولي\s+(?:ال)?امر)(?:\s+(?:طالب|واحد|معين|بعينه))*` +
          String.raw`|(?:ارسل|ابعث|ابعت)\s+رساله(?:\s+خاصه)?\s+(?:ل|الي|لل)\s*(?:ال)?طالب\s+(?:واحد|معين|بعينه))` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'language',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|switch|set)\s+(?:(?:the|my)\s+)?(?:app\s+)?language(?:\s+(?:of\s+the\s+app))?(?:\s+to\s+(?:english|arabic))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|احول|تحويل)\s+(?:ال)?لغه(?:\s+(?:ال)?(?:تطبيق|برنامج|واجهه))?(?:\s+(?:الي|لل|ل)\s*(?:ال)?(?:انجليزيه|انجليزي|انكليزي|انكليزيه|عربيه|عربي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  // The sixth live pass (2026-10-18). Labels from the screens; three of these
  // say the app cannot: no move between classes (a re-added name is a new
  // record), no hand-made support group, no event added on the calendar.
  {
    id: 'rename-class',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`rename\s+(?:the\s+|a\s+|my\s+)?class` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعيد\s+تسميه|اغير\s+اسم|تغيير\s+اسم)\s+(?:ال)?شعبه` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:rename\s+(?:(?:a|the|my|this)\s+)?class|(?:change|edit)\s+(?:(?:the|my|a)\s+)?(?:class(?:'s)?\s+name|name\s+of\s+(?:(?:a|the|my|this)\s+)?class)|edit\s+(?:(?:a|the|my|this)\s+)?class)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:(?:اغير|تغيير|اعدل|تعديل|ابدل|تبديل)\s+(?:ال)?اسم\s+(?:ال)?(?:شعبه|شعبتي|صف)|(?:اعدل|تعديل)\s+(?:ال)?(?:شعبه|شعبتي))` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'remove-student',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:delete|remove|take\s+out)\s+(?:(?:a|an|the|one|this|that)\s+)?students?(?:\s+from\s+(?:(?:my|the|a|this)\s+)?(?:class|section|roster|class\s+list))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|مسح|ازيل|ازاله|اشيل|اخرج|اخراج)\s+(?:ال)?(?:طالب|طالبه|طلاب|اسم\s+(?:ال)?طالب)(?:\s+(?:من\s+(?:ال)?(?:شعبه|شعبتي|صف|قائمه)))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'move-student',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:move|transfer|switch)\s+(?:a\s+|the\s+|one\s+|this\s+)?student\s+from\s+(?:one|a|the|my)\s+(?:class|section)\s+(?:to|into)\s+(?:another|a\s+different|a\s+new|the\s+other)(?:\s+(?:one|class|section))?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:move|transfer|switch)\s+(?:(?:a|the|one|this|that)\s+)?student(?:\s+from\s+(?:one|a|the|my)\s+(?:class|section))?\s+(?:to|into)\s+(?:another|a\s+different|a\s+new|the\s+other|my\s+other)\s+(?:class|section)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انقل|نقل|احول|تحويل)\s+(?:ال)?(?:طالبا?|طالبه)(?:\s+من\s+(?:ال)?(?:شعبه|صف)(?:\s+\S+)?)?\s+(?:الي|ل|لل)\s*(?:ال)?(?:شعبه|صف|اخري|اخر|ثانيه|ثاني|جديده)(?:\s+(?:ثانيه|ثاني|اخري|اخر|جديده))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'link-parent',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:find|get|see|know)\s+(?:a\s+|the\s+)?student['’]?s\s+(?:link|join)\s+code` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|احصل\s+علي|اجيب|اشوف|ارى|اري)\s+رمز\s+(?:ال)?ربط\s+(?:ال)?خاص\s+ب(?:ال)?طالب` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:link|connect)\s+(?:a\s+|the\s+)?parent(?:['’]?s)?\s+account\s+(?:to|with)\s+(?:a\s+|the\s+|their\s+)?(?:student|child)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اربط|ربط)\s+حساب\s+(?:ولي\s+(?:ال)?امر|اهل|والد)\s+ب(?:حساب\s+)?(?:ال)?(?:طالب|ابنه|ابنها)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:link|connect)\s+(?:(?:a|the)\s+)?parent\s+(?:to|with)\s+(?:(?:a|the|their|his|her)\s+)?(?:student|child)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اربط|ربط)\s+(?:ال)?ولي\s+(?:ال)?امر\s+(?:ب|مع)\s*(?:ال)?(?:طالب|ابنه|ابنته)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'reissue-login',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:reissue|reset|regenerate|get)\s+(?:a\s+)?(?:new\s+)?login\s+code\s+for\s+(?:a\s+)?student(?:\s+who\s+(?:forgot|lost)\s+\w+(?:\s+\w+)?)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعيد\s+اصدار|اصدر|اعطي|اولد)\s+رمز\s+دخول\s+(?:جديد\s+)?(?:ل)?\s*(?:ال)?طالب(?:\s+(?:نسي|ضيع|فقد)\s+\S+)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:reset|resend|reissue|get|make)\s+(?:(?:a|the)\s+)?(?:new\s+)?login\s+code(?:\s+for\s+(?:(?:a|the|my)\s+)?(?:student|parent))?` + EN_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:(?:a|the|my)\s+)?student\s+(?:forgot|lost)\s+(?:(?:his|her|their|the)\s+)?login\s+code` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعيد|اعاده|انشئ|انشاء|اصدر|اصدار|اعطي|اعمل)\s+(?:ال)?رمز\s+(?:ال)?دخول(?:\s+(?:جديد))?(?:\s+(?:ل|الي|لل)\s*(?:ال)?(?:طالب|طالبه|ولي\s+(?:ال)?امر))?` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:ال)?(?:طالب|طالبه)\s+(?:نسي|نسيت|ضيع|ضيعت|اضاع)\s+(?:ال)?رمز\s+(?:ال)?دخول` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'student-sign-in',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:log|sign)\s*in\s+(?:as|with|to)\s+(?:an?\s+)?(?:student|parent)(?:\s+account)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ادخل|دخول|اسجل\s+(?:ال)?دخول|اسجل\s+دخول|اسجل)\s+(?:ك|ب)\s*(?:حساب\s+)?(?:طالب|طالبه|ولي\s+(?:ال)?امر)` + AR_RULE_TAIL),
      new RegExp(String.raw`^how\s+(?:do|can|will|should)\s+(?:my\s+|the\s+)?(?:students?|parents?)\s+(?:sign\s+in|log\s*in|sign\s+up|join(?:\s+(?:my|the)\s+class)?|get\s+(?:in|an\s+account))` + EN_RULE_TAIL),
      new RegExp(
        String.raw`^(?:كيف|وين|من\s+وين)\s+(?:يسجل|يعمل|ينشئ|ينضم|يدخل)\s+(?:ال)?(?:طالب|طلاب|طلبه|ولي\s+(?:ال)?امر)\s*(?:(?:ال)?دخول|حساب|حسابه|(?:الي|لل|ل)\s*(?:ال)?(?:شعبه|تطبيق)|علي\s+(?:ال)?تطبيق|علي\s+حسابه)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    // Not a screen of its own, so a where-question gets the explanation too.
    id: 'support-groups',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:find|see|identify)\s+(?:the\s+)?struggling\s+students\s+after\s+(?:an?\s+|the\s+)?(?:exam|test)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|ارى|اري|احدد)\s+(?:ال)?(?:طلاب|طلبه)\s+(?:ال)?متعثرين(?:\s+بعد\s+(?:ال)?(?:امتحان|اختبار))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:find|see|know|identify|spot)\s+(?:the\s+)?(?:weak|struggling)\s+students(?:\s+in\s+(?:a\s+|one\s+)?(?:specific\s+)?(?:lesson|topic))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|اعرفه|ارى|اري|اشوف|احدد|اكتشف)\s+(?:ال)?طلبه\s+(?:ال)?ضعاف|(?:اعرف|ارى|اري|احدد)\s+(?:ال)?(?:طلبه|طلاب)\s+(?:ال)?ضعفاء(?:\s+في\s+(?:درس|هدف)\s+(?:معين|محدد))?` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:(?:how\s+do\s+i\s+(?:create|make|use|find|see)\s+(?:a\s+|the\s+)?)|(?:where\s+(?:are|is|do\s+i\s+find)\s+(?:the\s+|my\s+)?))?support\s+groups?` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:(?:كيف|وين|اين|من\s+وين)\s+)?(?:(?:انشئ|اعمل|اسوي|الاقي|اجد|القي|اشوف|استخدم)\s+)?(?:ال)?(?:مجموعات|مجموعه)\s+(?:ال)?دعم` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'broadcast',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|write)\s+(?:a\s+)?(?:group|bulk|mass)\s+message\s+to\s+(?:the\s+|all\s+|my\s+)?parents(?:\s+about\s+(?:the\s+)?homework)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+رساله\s+جماعيه\s+(?:ل|لل)\s*(?:ال)?(?:اولياء\s+(?:ال)?امور|اهالي)(?:\s+عن\s+(?:ال)?واجب(?:ات)?)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|post)\s+(?:an?\s+)?(?:message|announcement|notice)\s+to\s+(?:all\s+(?:of\s+)?(?:my\s+|the\s+)?|every\s+)parents?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+(?:اعلان|تعميم|رساله)(?:\s+جماعيه)?\s+(?:ل|الي|لل)\s*(?:كل|جميع)\s+(?:ال)?(?:اولياء\s+(?:ال)?امور|اهالي|اهل)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'read-messages',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|read|check|find|view)\s+(?:(?:the|my)\s+)?(?:messages\s+from\s+(?:(?:the|my)\s+)?parents|parents['’]?\s+messages)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اقرا|اري|اتابع|القي|الاقي)\s+(?:ال)?رسائل\s+(?:ال)?(?:اولياء\s+(?:ال)?امور|اهالي|اهل|طلاب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    // A how-word is required: «انشئ امتحان» on its own asks the assistant to make
    // one. «اختبار» and "test" are left to the short-quiz steps (`howMakeQuiz`).
    id: 'create-exam',
    res: [
      new RegExp(String.raw`^(?:(?:please|pls|plz)\s+)?(?:how\s+(?:do|can|should)\s+(?:i|we)|how\s+to)\s+(?:create|make|set\s+up|build|add)\s+(?:(?:an?|the|my|new)\s+)*(?:exam|evaluation)` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:كيفيه|كيف|اشلون|شلون|ازاي|طريقه|خطوات)\s+(?:يمكنني\s+|ممكن\s+|بقدر\s+)?(?:انشئ|انشاء|اعمل|اسوي|اجهز|اضيف|اضافه)\s+(?:ال)?(?:امتحان|تقييم)(?:\s+(?:جديد|ورقي|الكتروني))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'delete-saved',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:delete|remove)\s+(?:(?:a|the|my|this)\s+)?(?:saved\s+(?:worksheet|lesson\s+plan|quiz|file|material|activity)s?|(?:worksheet|lesson\s+plan|quiz|file|material)s?\s+from\s+my\s+files)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|مسح)\s+(?:ال)?(?:ملف|ملفات|ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|اختبار|ماده|مواد)\s+(?:(?:ال)?(?:محفوظه|محفوظ|محفوظات)|من\s+(?:ال)?ملفاتي)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'edit-worksheet',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:edit|change|modify)\s+(?:(?:the|a|my|this)\s+)?worksheet(?:\s+(?:before|for)\s+printing)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اسئله\s+(?:ال)?ورقه)(?:\s+قبل\s+(?:ال)?(?:طباعه|تصدير|طبع))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'ministry-plan',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:export|print|get|make|download)\s+(?:(?:the|a|my)\s+)?lesson\s+plan\s+(?:in|on|as|using)\s+(?:the\s+)?ministry\s+(?:template|form|format)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اطبع|طباعه|اصدر|تصدير|احفظ|حفظ|اعمل|احضر|اجهز|انزل|احمل)\s+(?:ال)?خطه\s+(?:ال)?درس\s+(?:ب|علي|حسب|في)\s*(?:ال)?نموذج\s+(?:ال)?وزاره` + AR_RULE_TAIL,
      ),
    ],
  },
  // The seventh live pass (2026-10-18). The chat keeps no history: that answer
  // says so. «مشاركة» shares text, so the share answer names the PDF / Word export.
  {
    id: 'plan-lessons',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|schedule|date|plan)\s+(?:(?:a|the|my)\s+)?lessons?\s+(?:to|in|into|on)\s+(?:(?:the|my|a)\s+)?(?:term|teaching|semester)\s+plan` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|ارتب|ترتيب|اوزع|توزيع|احدد|تحديد)\s+(?:ال)?(?:دروس|درس|مواعيد\s+(?:ال)?دروس)\s+(?:لل|الي|في|علي|ل)\s*(?:ال)?خطه\s+(?:ال)?(?:فصليه|تدريس|سنويه)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'timetable',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:create|make|set\s+up|fill\s+in|build)\s+(?:(?:my|the|a)\s+)?(?:weekly\s+)?(?:timetable|schedule)` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`add\s+(?:a\s+)?(?:period|lesson|class)\s+to\s+(?:(?:my|the)\s+)?(?:timetable|schedule)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:انشئ|اعمل|اسوي|اعبي|اجهز|ارتب|اعدل)\s+(?:ال)?جدول\s+(?:ال)?(?:حصص|اسبوعي)|(?:اضيف|اضافه|اضع)\s+(?:ال)?حصه\s+(?:لل|الي|في|علي)\s*(?:ال)?جدول)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'student-record',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|track|view|follow)\s+(?:a\s+|the\s+)?student['’]?s\s+progress\s+(?:across|over|through)\s+(?:the\s+)?(?:exams|tests)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|اتابع|اعرف)\s+تقدم\s+(?:ال)?طالب\s+(?:عبر|خلال|في)\s+(?:ال)?(?:امتحانات|اختبارات)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|view|open|check|track|find)\s+(?:(?:a|my|the|each|one)\s+)?(?:student(?:['’]s|s['’]?)?|pupil['’]?s?)\s+(?:record|file|profile|progress)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|افتح|اطلع\s+علي|اتابع|متابعه)\s+(?:ال)?(?:سجل|ملف|تقدم)\s+(?:ال)?(?:طالب|طالبه|طلاب)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'student-note',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:write|add|leave|save|keep)\s+(?:a\s+)?notes?\s+(?:about|on|for)\s+(?:(?:a|the|one|each)\s+)?student` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اكتب|اضيف|اضع|احفظ|اسجل)\s+(?:ال)?ملاحظه\s+(?:عن|علي|ل|لل)\s*(?:ال)?(?:طالب|طالبه)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'share-material',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:share|send)\s+(?:the\s+|a\s+|my\s+)?(?:lesson|slides|deck|presentation)\s+(?:with|to)\s+(?:a\s+|another\s+|my\s+)?(?:teacher|colleague|coworker)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشارك|شارك|مشاركه|ارسل|ابعث|ابعت)\s+(?:ال)?(?:درس|دروس|ماده|شرائح|عرض)\s+مع\s+(?:ال)?(?:معلم|معلمه|زميل|زميله|زملاء|مدرس)(?:\s+(?:اخر|اخري|ثاني|ثانيه))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:share|send)\s+(?:(?:the|a|my|this)\s+)?(?:worksheet|lesson\s+plan|quiz|activity|file)\s+(?:on|via|by|through|over|in)\s+(?:whatsapp|email|telegram)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشارك|شارك|مشاركه|ارسل|ابعث|ابعت)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|اختبار|نشاط|ملف)\s+(?:علي|عبر|ب|في|ع)\s*(?:ال)?(?:واتساب|واتس\s+اب|واتس|ايميل|بريد|تلغرام|تيليجرام)` + AR_RULE_TAIL,
      ),
      // «كيف أشارك خطة الدرس مع معلم آخر؟» was answered with where the plan tool is
      // (found 2026-10-20): a colleague gets it the way anyone does.
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:share|send)\s+(?:(?:the|a|my|this)\s+)?(?:worksheet|lesson\s+plan|quiz|activity|file|material)\s+(?:with|to)\s+(?:another\s+|a\s+|my\s+|other\s+)?(?:teachers?|colleagues?|coworkers?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشارك|شارك|مشاركه|ارسل|ابعث|ابعت)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|اختبار|نشاط|ملف)\s+مع\s+(?:ال)?(?:معلم|معلمه|زميل|زميله|زملاء|مدرس|معلمين)(?:\s+(?:اخر|اخري|ثاني|ثانيه|اخرين))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'save-slides',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:print|save|export|download)\s+(?:the\s+)?slides\s+(?:as|to|in)\s+(?:a\s+)?pdf(?:\s+file)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اطبع|طباعه|احفظ|احمل|انزل|اصدر|تصدير)\s+(?:ال)?شرائح\s+(?:ك|ب|علي\s+شكل\s+)?(?:ملف\s+)?(?:pdf|بي\s*دي\s*اف)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:export|save|download|convert)\s+(?:the\s+|my\s+)?(?:slides|deck|presentation)\s+(?:as|to|in|into)\s+(?:a\s+)?(?:powerpoint|pptx|ppt|pdf)(?:\s+file)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اصدر|تصدير|احول|تحويل|احفظ|حفظ|انزل|تنزيل|احمل|تحميل)\s+(?:ال)?(?:شرائح|عرض(?:\s+(?:ال)?تقديمي)?)\s+(?:ب|بصيغه|الي|ك|علي\s+شكل)\s*(?:صيغه\s+)?(?:ال)?(?:بوربوينت|باوربوينت|pptx|powerpoint|pdf|بي\s*دي\s*اف)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:save|keep|print|export|download)\s+(?:(?:the|my|a|this)\s+)?(?:slides|slideshow|presentation|deck)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احفظ|حفظ|اطبع|طباعه|اصدر|تصدير|احمل|تحميل|انزل)\s+(?:ال)?(?:شرائح|عرض\s+(?:ال)?تقديمي|عرض|بوربوينت|باوربوينت)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'present',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:present|show|play|project)\s+(?:(?:the|my)\s+)?(?:slides|slideshow|presentation|deck)\s+(?:in\s+|on\s+)?(?:full\s*screen|the\s+(?:projector|board|big\s+screen))` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرض|عرض|اشغل|تشغيل)\s+(?:ال)?(?:شرائح|عرض\s+(?:ال)?تقديمي)\s+(?:ب|علي|في)?\s*(?:ال)?(?:شاشه\s+(?:ال)?كامله|ملء\s+(?:ال)?شاشه|شاشه\s+(?:ال)?عرض|بروجكتر|شاشه)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'share-game',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`share\s+(?:a\s+|the\s+)?game\s+from\s+(?:the\s+)?english\s+corner\s+with\s+(?:the\s+|my\s+)?students` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشارك|شارك|ارسل)\s+(?:ال)?لعبه\s+(?:من\s+)?(?:زاويه|ركن)\s+(?:ال)?(?:لغه\s+(?:ال)?انجليزيه|انجليزيه)\s+(?:مع|ل)\s*(?:ال)?(?:طلبه|طلاب)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:share|send)\s+(?:(?:a|the|my|this)\s+)?(?:game|challenge)s?\s+(?:with|to)\s+(?:(?:my|the)\s+)?students` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشارك|شارك|ارسل|ابعث|ابعت)\s+(?:ال)?(?:لعبه|العاب|تحدي)\s+(?:مع|ل|لل|الي)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'chat-history',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:clear|delete|erase)\s+(?:the\s+|my\s+)?(?:chat|conversation)\s+history` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:امسح|مسح|احذف|حذف)\s+سجل\s+(?:ال)?محادثات` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:clear|delete|reset|start)\s+(?:a\s+|the\s+|this\s+|my\s+)?(?:new\s+)?(?:chat|conversation)(?:\s+(?:with|in)\s+(?:the\s+)?(?:assistant|iqrra|iqraa|app))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:امسح|مسح|احذف|حذف|انظف|ابدا|ابدء|بدء)\s+(?:ال)?محادثه(?:\s+جديده)?(?:\s+(?:مع|عند|في)\s+(?:ال)?(?:مساعد|اقرا|تطبيق))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:go\s+back|return)\s+to\s+(?:(?:a|the|my)\s+)?(?:previous|old|earlier|last)\s+(?:chat|conversation)|(?:see|find|open)\s+(?:(?:my|the)\s+)?(?:chat\s+history|previous\s+chats?|old\s+chats?)|(?:clear|delete|reset)\s+(?:(?:the|this|my)\s+)?(?:chat|conversation)|start\s+(?:a\s+)?new\s+(?:chat|conversation))` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:ارجع|اعود|رجوع|عوده)\s+(?:لل|الي|ل)\s*(?:ال)?محادثه\s+(?:ال)?(?:سابقه|قديمه)|(?:اشوف|افتح|الاقي)\s+(?:ال)?(?:محادثات\s+(?:ال)?(?:سابقه|قديمه)|سجل\s+(?:ال)?محادثه)|(?:امسح|مسح|احذف|حذف|انظف)\s+(?:ال)?محادثه|(?:ابدا|ابدء|بدء)\s+محادثه\s+جديده)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'library-to-class',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|attach|share)\s+(?:(?:a|an|the)\s+)?(?:library\s+)?(?:resource|item|file)s?(?:\s+from\s+the\s+library)?\s+to\s+(?:(?:my|a|the)\s+)?(?:class|homework)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|ارفق|اضع|انقل)\s+(?:ال)?(?:مورد|موارد|ملف|ماده)(?:\s+من\s+(?:ال)?مكتبه)?\s+(?:لل|الي|في|ل)\s*(?:ال)?(?:شعبه|شعبتي|صف|واجب)` + AR_RULE_TAIL,
      ),
    ],
  },
  // The eighth live pass (2026-10-19).
  {
    id: 'join-class',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:join|enter|use|redeem)\s+(?:(?:a|an|another|the|my)\s+)?(?:(?:new\s+)?class(?:room)?|section)(?:\s+(?:with|using|by|via|through)\s+(?:a\s+|the\s+|my\s+)?(?:link\s+|class\s+|join\s+)?code)?` + EN_RULE_TAIL,
      ),
      new RegExp(EN_RULE_LEAD + String.raw`(?:enter|use|redeem|type)\s+(?:a\s+|the\s+|my\s+)?(?:link|class|join)\s+code` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انضم|انضمام|التحق|التحاق)\s+(?:الي|ل|لل)?\s*(?:ال)?(?:شعبه|صف|فصل)(?:\s+(?:اخري|جديده|ثانيه))?(?:\s+(?:ب|عن\s+طريق|باستخدام|بواسطه)\s*(?:ال)?(?:رمز|كود)(?:\s+(?:ال)?ربط)?)?` + AR_RULE_TAIL,
      ),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ادخل|اكتب|استخدم)\s+(?:ال)?(?:رمز|كود)\s+(?:ال)?(?:ربط|انضمام|شعبه)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'calendar',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|open|find|view|check)\s+(?:the\s+)?school\s+calendar` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اري|اشوف|افتح|الاقي|اجد)\s+تقويم\s+(?:ال)?مدرسه` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:open|view|see|show|check|use)\s+(?:(?:my|the)\s+)?calendar` + EN_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`add\s+(?:an?\s+)?(?:event|reminder|appointment|task|note)\s+(?:to|in|on)\s+(?:the\s+|my\s+)?calendar` + EN_RULE_TAIL,
      ),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرض|عرض|افتح|فتح|اشوف|اري|استخدم|استخدام)\s+(?:ال)?تقويم(?:\s+(?:تبعي|حقي|الخاص\s+بي))?` + AR_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضع|وضع|اسجل|تسجيل|انشئ)\s+(?:حدثا?|موعدا?|تذكيرا?|مناسبه|فعاليه|ملاحظه)\s+(?:في|الي|ل|لل|علي)\s*(?:ال)?تقويم` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'import-students',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:import|upload|load|bring|copy|paste|add)\s+(?:(?:my|the|all|a)\s+)?(?:students?|names|student\s+(?:list|names)|class\s+list|roster)(?:\s+(?:in|into|to)\s+(?:a|the|my)\s+class)?\s+(?:from|with|using|via|through|by)\s+(?:an?\s+|the\s+|my\s+)?(?:excel|xlsx?|csv|spreadsheet|google\s+sheets?)(?:\s+(?:file|sheet|document))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استورد|استيراد|ارفع|رفع|ادخل|ادخال|اضيف|اضافه|انقل|نقل)\s+(?:ال)?(?:طلاب|طلبه|اسماء(?:\s+(?:ال)?طلاب)?|قائمه(?:\s+(?:ال)?طلاب)?)(?:\s+(?:الي|في|ل)\s*(?:ال)?شعبه)?\s+(?:من|ب|عن\s+طريق|بواسطه|عبر)\s*(?:ملف\s+|جدول\s+)?(?:ال)?(?:اكسل|اكسيل|excel|csv)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'attendance',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:take|record|mark|log)\s+(?:the\s+)?(?:attendance|absences?)(?:\s+(?:today|for\s+(?:the\s+)?(?:class|students)))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اسجل|تسجيل|ارصد|رصد|اخذ)\s+(?:ال)?(?:غياب|حضور)(?:\s+و(?:ال)?(?:غياب|حضور))?(?:\s+(?:ال)?(?:طلبه|طلاب))?(?:\s+(?:اليوم|يوميا))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:take|record|track|see|check|know|calculate|mark|get|find|view)\s+(?:(?:the|my|student|students['’]?|class)\s+)*(?:attendance|absences?)(?:\s+(?:percentage|rate|record|sheet))?(?:\s+(?:of|for)\s+(?:my\s+|the\s+)?(?:students|class))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اسجل|تسجيل|احسب|حساب|اعرف|اتابع|متابعه|اشوف|اري|اخذ)\s+(?:(?:ال)?(?:نسبه|سجل|كشف)\s+)?(?:ال)?(?:حضور|غياب)(?:\s+و(?:ال)?(?:غياب|حضور))?(?:\s+(?:ال)?(?:طلاب|طلبه|طلابي|طلبتي|شعبه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'offline',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:save|download)\s+(?:the\s+)?(?:content|lessons|materials)\s+(?:to|so\s+i\s+can)\s+(?:use|open)\s+(?:it|them)?\s*(?:offline|without\s+(?:internet|a\s+connection))` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احفظ|احمل|انزل)\s+(?:ال)?(?:محتوي|دروس|ملفات|مواد)\s+(?:ل|كي\s+)?(?:استخدمه|استخدمها|افتحه|افتحها)\s+(?:بدون|دون)\s+(?:ال)?(?:انترنت|اتصال|نت)` + AR_RULE_TAIL),
      new RegExp(
        String.raw`^(?:هل\s+)?(?:يعمل|يشتغل|يفتح|اقدر\s+(?:استخدم|افتح|اشتغل)|يمكن(?:ني)?\s+(?:استخدام|فتح))\s+(?:ال)?(?:تطبيق|برنامج|موقع|منصه|اقر\S*)(?:\s+\S+)?\s+(?:من\s+)?(?:بدون|دون|بلا|من\s+غير)\s+(?:ال)?(?:انترنت|نت|اتصال|شبكه)` + AR_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:(?:does|will)\s+)?(?:the\s+)?(?:app|iqra\w*|website|site)\s+(?:work|run|open)s?\s+(?:offline|without\s+(?:the\s+)?(?:internet|wifi|wi-fi|connection|network))` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:use|open|run)\s+(?:the\s+)?(?:app|iqra\w*)\s+(?:offline|without\s+(?:the\s+)?(?:internet|wifi|wi-fi|connection|network))` + EN_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'question-bank',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:build|create|make)\s+(?:an?\s+)?(?:exam|test|quiz)\s+from\s+(?:the\s+|a\s+)?question\s+bank` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابني|انشئ|اعمل|اجهز|اصنع)\s+(?:امتحان|اختبار)ا?\s+من\s+(?:ال)?بنك\s+(?:ال)?اسئله` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:make|create|build|start|set\s+up|have|keep|use)\s+(?:an?\s+|my\s+|the\s+)?(?:question|questions|exam)\s+bank` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعمل|اسوي|انشئ|ابني|اكون|اضيف|اخزن|احفظ|استخدم)\s+(?:ال)?بنك\s+(?:ال)?اسئله(?:\s+(?:خاص|الخاص)\s+\S+)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-reminder',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:set|add|create|get|make|schedule)\s+(?:an?\s+|the\s+|my\s+)?(?:reminder|alert|notification)\s+(?:for|about|of)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|quiz)(?:\s+date)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضبط|اضع|اضيف|اعمل|انشئ|اجعل|فعل|افعل)\s+(?:ال)?تذكيرا?\s+(?:ب|ل|عن)\s*(?:ال)?(?:موعد\s+(?:ال)?)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
    ],
  },  // The tenth live pass (2026-10-20).
  {
    id: 'lab',
    res: [locateEn(String.raw`(?:(?:science|chemistry|virtual)\s+)?lab(?:oratory)?`), locateAr(String.raw`(?:ال)?مختبر(?:\s+(?:ال)?(?:كيمياء|علوم|افتراضي))?`)],
  },
  {
    id: 'math-corner',
    res: [locateEn(String.raw`math(?:s|ematics)?\s+corner`), locateAr(String.raw`(?:ال)?(?:ركن|زاويه)\s+(?:ال)?رياضيات`)],
  },
  {
    id: 'quran-corner',
    res: [locateEn(String.raw`quran(?:\s+corner)?`), locateAr(String.raw`(?:(?:ال)?ركن\s+)?(?:ال)?قران(?:\s+(?:ال)?كريم)?`)],
  },
  {
    id: 'tool:games',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:play|open|start)\s+(?:the\s+)?(?:memory|colou?rs?|flags?|capitals?|elements?|times\s+tables?|multiplication|division|addition|subtraction)\s+(?:game|challenge)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:العب|لعب|اشغل|شغل|افتح|فتح)\s+(?:ال)?(?:لعبه|العاب)\s+(?:ال)?(?:ذاكره|الوان|اعلام|عواصم|رموز\s+(?:ال)?عناصر|جدول\s+(?:ال)?ضرب|جمع|طرح|ضرب|قسمه)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'whiteboard',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?(?:white\s*board)\s+(?:in|during)\s+(?:the\s+|my\s+)?(?:class|lesson)` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:save|keep|store)\s+(?:what\s+i\s+(?:wrote|drew)\s+(?:on|in)\s+)?(?:the\s+)?(?:white\s*board)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|استعمل)\s+(?:ال)?سبوره(?:\s+(?:ال)?(?:تفاعليه|ذكيه))?\s+(?:في|اثناء)\s+(?:ال)?(?:حصه|درس|صف)` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احفظ|حفظ|اخزن)\s+(?:ما\s+)?(?:(?:كتبته|كتبت|رسمته)\s+(?:علي|في)\s+)?(?:ال)?سبوره` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:use|open|start|find|get)\s+(?:the\s+|a\s+|my\s+)?(?:interactive\s+)?(?:white\s*board|smart\s*board)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استخدم|افتح|فتح|ابدا|بدء|اشغل|شغل|استخدام)\s+(?:ال)?سبوره(?:\s+(?:ال)?(?:تفاعليه|ذكيه|الكترونيه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'parent-group',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:create|make|start|set\s+up|open|add)\s+(?:an?\s+)?(?:new\s+)?(?:(?:whatsapp|chat|message)\s+)?group(?:\s+chat)?\s+(?:for|with|of)\s+(?:the\s+|my\s+)?(?:parents|guardians|students|class)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انشئ|انشاء|اعمل|عمل|اسوي|فتح|افتح|اكون|تكوين)\s+(?:ال)?(?:مجموعه|جروب|قروب)(?:\s+(?:محادثه|واتساب))?\s+(?:ل|لل|مع)\s*(?:ال)?(?:اهالي|اولياء\s+(?:ال)?امور|امور|طلاب|طلبه|شعبه)(?:\s+(?:شعبتي|صفي|الشعبه|الصف|شعبه\s+\S+))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'export',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`copy\s+(?:the\s+)?(?:assistant['’]?s?|iqrra['’]?s?|iqraa['’]?s?|bot['’]?s?|chat)\s+(?:answer|reply|response|message|text)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:انسخ|نسخ)\s+(?:ال)?(?:اجابه|رد|رساله|كلام|نص)\s+(?:ال)?(?:مساعد|اقرا|بوت)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:download|save|export|convert|get)\s+(?:(?:the|my|a|this)\s+)?(?:lesson\s+plan|plan|worksheet|quiz|activity|result|material|slides|file|it)?\s*(?:as|to|in|into)\s+(?:an?\s+)?(?:word|docx|pdf)(?:\s+(?:file|document|format))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`copy\s+(?:the\s+|my\s+|a\s+|this\s+)?(?:lesson\s+plan|plan|worksheet|quiz|activity|result)(?:\s+text)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احمل|حمل|تحميل|انزل|نزل|تنزيل|احفظ|حفظ|اصدر|تصدير|احول|تحويل)\s+(?:ال)?(?:خطه\s+(?:ال)?درس|ورقه\s+(?:ال)?عمل|خطه|ورقه|اختبار|نشاط|نتيجه|ماده|شرائح|ملف)?\s*(?:ب|ك|الي|ل)\s*(?:صيغه|شكل|ملف)?\s*(?:ال)?(?:وورد|word|pdf|بي\s*دي\s*اف)` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انسخ|نسخ)\s+(?:ال)?(?:نص|محتوي)\s+(?:ال)?(?:خطه(?:\s+(?:ال)?درس)?|ورقه(?:\s+(?:ال)?عمل)?|اختبار|نشاط|نتيجه|ماده)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'open-class',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:switch|move|go|navigate)\s+(?:between|to)\s+(?:(?:my|the|another|other|a\s+different)\s+)?(?:other\s+)?(?:classes|class|sections?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انتقل|اتنقل|بدل|ابدل|تنقل)\s+(?:بين|الي)\s+(?:ال)?(?:شعب|شعبه|صفوف)(?:\s+(?:اخري|ثانيه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'school-tab',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:open|find|see|use|get\s+to)\s+(?:the\s+|my\s+)?school\s+(?:page|tab|section)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|فتح|اشوف|اري|اجد|الاقي|استخدم)\s+(?:ال)?(?:صفحه|تبويب|قسم)\s+(?:ال)?مدرسه` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'backup',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:back\s*up|backup)\s+(?:(?:my|the)\s+)?(?:files|work|materials|data|account|everything)` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:make|create|take)\s+(?:a\s+)?backup(?:\s+of\s+(?:my\s+)?(?:files|work|materials|data))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعمل|عمل|اسوي|اخذ|انشئ|احفظ)\s+نسخه\s+(?:احتياطيه|اضافيه)(?:\s+(?:ل|من))?\s*(?:ال)?(?:ملفاتي|ملفات|مواد|بياناتي|حسابي|شغلي)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'privacy',
    res: [
      new RegExp(
        String.raw`^(?:هل\s+)?(?:بياناتي|معلوماتي|بيانات\s+(?:ال)?طلاب|بيانات\s+طلابي)\s+(?:امنه|محميه|بامان|في\s+امان|سريه)` + AR_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:is|are)\s+(?:my|the|students['’]?)\s*(?:data|information|account|files)\s+(?:safe|secure|private|protected)` + EN_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'update-app',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`update\s+(?:the\s+)?app\s+to\s+(?:the\s+)?(?:latest|newest)\s+(?:version|release)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدث|تحديث)\s+(?:ال)?تطبيق(?:\s+الي\s+(?:اخر|احدث)\s+نسخه)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:update|upgrade)\s+(?:the\s+|my\s+)?(?:app|iqra\w*)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدث|حدث|تحديث)\s+(?:ال)?(?:تطبيق|برنامج|اقر\S*)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'lesson-progress',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|know|track|check|find\s+out)\s+(?:which|what)\s+(?:lessons|objectives|units|topics)\s+(?:i(?:['’]ve|\s+have)?|we(?:['’]ve|\s+have)?)\s+(?:covered|finished|taught|done|completed|passed)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اتابع|احسب)\s+(?:ال)?(?:دروس|اهداف|وحدات)\s+(?:التي|الي|اللي)\s+(?:انهيت|انتهيت|درست|غطيت|اخذت|خلصت|اكملت)\S*` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'library-videos',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:open|watch|find|play)\s+(?:a\s+|the\s+)?lesson\s+video\s+(?:from|in)\s+(?:the\s+)?library` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|اشاهد|اشوف|ارى|اري|اشغل)\s+(?:ال)?فيديو\S*\s+(?:ال)?درس\s+(?:من|في)\s+(?:ال)?مكتبه` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:watch|find|see|open|get)\s+(?:the\s+|some\s+)?(?:educational\s+|teaching\s+|lesson\s+)?videos?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشاهد|اشوف|اجد|الاقي|افتح|اعرض|ابحث\s+عن)\s+(?:ال)?(?:فيديوهات|فيديو|مقاطع(?:\s+(?:ال)?فيديو)?)(?:\s+(?:ال)?تعليميه)?(?:\s+شرح)?(?:\s+(?:ال)?(?:درس|دروس))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'search-lesson',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`open\s+(?:a\s+)?lesson\s+from\s+(?:the\s+)?\w+\s+(?:book|textbook)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|فتح)\s+درسا?\s+من\s+كتاب\s+(?:ال)?\S+` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|find|view|browse|open)\s+(?:the\s+)?grade\s+\d+\s+[a-z]+\s+(?:units|lessons|chapters)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشوف|اري|اجد|الاقي|افتح|اتصفح)\s+(?:ال)?(?:وحدات|دروس|فصول)\s+(?:ماده\s+)?(?:ال)?[ء-ي]+\s+(?:ل)?(?:ل)?(?:ال)?صف\s+(?:ال)?[ء-ي]+` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:(?:search|look)\s+for|find)\s+(?:a|the)\s+(?:specific\s+)?lesson(?:\s+(?:in|on|within)\s+(?:the\s+)?(?:curriculum|library|app))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابحث|ادور|دور|الاقي|اجد)\s+(?:عن|علي)?\s*(?:ال)?درس(?:\s+(?:معين|محدد|بعينه))?(?:\s+(?:في|ب|داخل)\s*(?:ال)?(?:منهاج|منهج|مكتبه|تطبيق))?` + AR_RULE_TAIL),
    ],
  },  // The eleventh live pass (2026-10-20).
  {
    id: 'close-exam',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:re-?open|open\s+again|unclose)\s+(?:(?:a|an|the|my)\s+)?(?:closed\s+)?(?:exam|test|quiz|evaluation)(?:\s+again)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+فتح\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:ال)?مغلق)?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:افتح|فتح)\s+(?:ال)?(?:امتحان|اختبار|تقييم)\s+(?:ال)?مغلق(?:\s+مره\s+(?:ثانيه|اخري))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'reissue-login',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|find|know|check|view|get)\s+(?:a\s+|the\s+|my\s+)?(?:student|child|parent)(?:['’]s)?\s+(?:login|sign[\s-]?in)\s+code` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اجد|الاقي|اطلع\s+علي)\s+(?:ال)?رمز\s+(?:ال)?دخول\s+(?:ل|ال)?\S*(?:\s+\S+)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'link-code',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|find|know|check|view|get)\s+(?:the\s+|my\s+|a\s+)?(?:class\s+|classroom\s+)?(?:link|join)\s+code(?:\s+(?:of|for)\s+(?:the\s+|my\s+|a\s+)?(?:class|section))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اجد|الاقي|اطلع\s+علي|احصل\s+علي)\s+(?:ال)?رمز\s+(?:ال)?ربط(?:\s+(?:لل|ل|ب)\s*(?:ال)?(?:شعبه|صف))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-ranking',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|view|get|find|show)\s+(?:the\s+|a\s+)?(?:ranking|rank|leaderboard|class\s+ranking)(?:\s+of\s+(?:the\s+|my\s+)?(?:students|class))?(?:\s+(?:in|for|of)\s+(?:the\s+|an?\s+)?(?:exam|test|quiz))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اعرف|اعرض|اطلع)\s+(?:ال)?ترتيب\s+(?:ال)?(?:طلاب|طلبه|طلابي|طلبتي|شعبه)(?:\s+(?:في|ب|حسب)\s*(?:ال)?(?:امتحان|اختبار|تقييم|علامات|نتائج))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-analysis',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|find)\s+(?:the\s+)?class(?:es)?['’]?\s*performance\s+(?:in|on)\s+(?:a\s+|one\s+)?(?:specific\s+)?objective` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|اعرف)\s+اداء\s+(?:ال)?شعبه\s+في\s+هدف\s+(?:معين|محدد)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|know|find|check|tell)\s+(?:out\s+)?(?:which|what)\s+(?:(?:exam|test|quiz)\s+)?(?:questions|objectives|topics)\s+(?:were|are|was)\s+(?:the\s+)?(?:hardest|most\s+difficult|weakest|missed|wrong)(?:\s+(?:for|by)\s+(?:the\s+)?(?:students|class))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|view|get)\s+(?:the\s+)?(?:question|item|exam|test)\s+analysis` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اعرض)\s+(?:اي|ايش|ما|ماهي)\s+(?:ال)?(?:اسئله|اهداف|مواضيع)\s+(?:كانت\s+|هي\s+)?(?:ال)?(?:اصعب|اضعف|الاكثر\s+(?:خطا|صعوبه))(?:\s+(?:علي|عند|لدي)\s+(?:ال)?(?:طلاب|طلبه|شعبه))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اعرض|احلل|تحليل)\s+(?:ال)?تحليل?\s*(?:ال)?(?:اسئله|امتحان|اختبار|نتائج)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-time',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:renew|refresh|extend)\s+(?:the\s+)?(?:expired\s+)?(?:exam|test|quiz)\s+link` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اجدد|تجديد|جدد)\s+رابط\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+(?:ال)?منتهي)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:give|add|grant)\s+(?:a\s+|one\s+)?(?:student|pupil)\s+(?:some\s+)?(?:extra|more|additional)\s+time(?:\s+(?:in|on|for)\s+(?:the\s+|an?\s+)?(?:exam|test|quiz))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعطي|امنح|اضيف)\s+(?:ال)?(?:طالب|طالبا|طالبه)\s+وقتا?\s+اضافيا?(?:\s+في\s+(?:ال)?(?:اختبار|امتحان|تقييم))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:set|add|change|extend|increase|put|give)\s+(?:a\s+|the\s+)?(?:time\s+limit|timer|duration)(?:\s+(?:for|of|on|to)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|quiz|evaluation))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:extend|increase|add|give)\s+(?:more\s+)?time\s+(?:for|to|on)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|quiz)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضبط|امدد|مدد|ازيد|زيد|اضع|اضيف|اغير)\s+(?:ال)?(?:وقت|مده|زمن|مؤقت|حد\s+زمني)\s*(?:ال)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-shuffle',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:shuffle|randomi[sz]e|mix\s+up|scramble)\s+(?:the\s+)?(?:order\s+of\s+)?(?:the\s+)?(?:exam\s+|test\s+|quiz\s+)?questions` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اخلط|خلط|ابدل|تبديل|اعشوائي|رتب\s+عشوائي)\s+(?:ترتيب\s+)?(?:ال)?اسئله` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'question-marks',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:set|change|edit|assign|give|choose)\s+(?:the\s+)?(?:marks|points|grades?|scores?)\s+(?:for|of|per|to)\s+(?:each|every|a|the)\s+question` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احدد|حدد|اغير|غير|اعدل|عدل|اضبط|اضع|اعطي)\s+(?:ال)?(?:علامه|علامات|درجه|درجات)\s+(?:كل\s+|ال)?سؤال` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'archived-classes',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:restore|unarchive|recover|bring\s+back|see|view|find|open)\s+(?:an?\s+|the\s+|my\s+)?(?:archived|deleted)\s+(?:classes|class|sections?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استعيد|استعاده|ارجع|اسجع|الغي\s+ارشفه|اشوف|اري|اعرض|افتح|اجد|الاقي)\s+(?:ال)?(?:شعبه|شعب|صفوف)\s+(?:ال)?(?:مو?ءرشف|مورشف|مؤرشف|محذوف)\S*` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-grade',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|edit|switch|update|set)\s+(?:the\s+)?(?:grade|year)\s+(?:of|for)\s+(?:a\s+|the\s+|my\s+)?(?:class|section)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اعدل|تعديل|ابدل|تبديل)\s+(?:ال)?صف\s+(?:ال)?(?:دراسي\s+)?(?:لل|ل)\s*(?:ال)?شعبه` + AR_RULE_TAIL,
      ),
    ],
  },  // The twelfth live pass (2026-10-21).
  {
    id: 'slide-edit',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|replace|add|set)\s+(?:the\s+)?cover\s+(?:image|picture|photo)\s+(?:of|in|for|on)\s+(?:my\s+|the\s+)?(?:slides|deck|presentation)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|ابدل|تبديل|تغيير|اضيف|اضافه|اعدل|تعديل)\s+صوره\s+(?:ال)?غلاف\s+(?:في|ل|لل)\s*(?:ال)?(?:عرض|شرائح)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:edit|change|modify|update|delete|remove)\s+(?:a\s+|the\s+|my\s+)?(?:slide|slides|slide\s+text|slide\s+title)` + EN_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`add\s+(?:a\s+|an\s+|the\s+)?(?:picture|image|photo|video)\s+(?:to|on|in)\s+(?:a\s+|the\s+|my\s+)?(?:slide|slides|deck)` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|choose|pick|set|switch)\s+(?:the\s+)?(?:theme|look|style|design)\s+(?:of|for)\s+(?:my\s+|the\s+)?(?:slides|deck|presentation)` + EN_RULE_TAIL,
      ),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير|احذف|حذف|امسح)\s+(?:ال)?(?:شريحه|شرائح)(?:\s+(?:ال)?(?:اولي|ثانيه|واحده))?` + AR_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضع|ارفع)\s+(?:ال)?(?:صوره|صور|فيديو)\s+(?:ل|لل|الي|في|علي)\s*(?:ال)?(?:شريحه|شرائح|عرض)` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اختار|اختيار)\s+(?:ال)?(?:مظهر|شكل|تصميم|ثيم)\s+(?:ال)?(?:عرض|شرائح)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'slide-add-reorder',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|insert|create)\s+(?:a\s+)?(?:new\s+)?slide(?:\s+(?:to|in)\s+(?:my\s+|the\s+)?(?:deck|presentation|slides))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:reorder|rearrange|move|change\s+the\s+order\s+of)\s+(?:the\s+|my\s+)?slides?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|انشئ)\s+شريحه(?:\s+جديده)?(?:\s+(?:لل|ل|الي|في)\s*(?:ال)?(?:عرض|شرائح))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ارتب|ترتيب|اعيد\s+ترتيب|ابدل\s+ترتيب|انقل)\s+(?:ترتيب\s+)?(?:ال)?شرائح` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'slide-notes',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`add\s+(?:the\s+)?(?:speaker|presenter|teacher)(?:['’]?s)?\s+notes\s+to\s+(?:the\s+)?slides` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضف|اكتب)\s+ملاحظات\s+(?:ال)?(?:متحدث|معلم|مقدم)\s+(?:ل|لل|علي|الي)\s*(?:ال)?شرائح` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|write|see|view|edit)\s+(?:speaker\s+|teacher\s+|presenter\s+)?notes\s+(?:to|on|for|in)\s+(?:a\s+|the\s+|my\s+)?(?:slide|slides|deck|presentation)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اكتب|اضع|اشوف)\s+ملاحظات\s+(?:(?:لل|ل)\s*(?:ال)?معلم\s+)?(?:علي|في|ل|لل)\s*(?:ال)?(?:شريحه|شرائح|عرض)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'edit-plan',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:edit|change|modify|update|delete|remove)\s+(?:a\s+|the\s+|my\s+)?(?:section|item|part|step)\s+(?:of|in|from)\s+(?:a\s+|the\s+|my\s+)?(?:lesson\s+plan|plan)` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:edit|change|modify|update)\s+(?:a\s+|the\s+|my\s+)?lesson\s+plan(?:\s+after\s+(?:it\s+is\s+|it['’]s\s+)?(?:generated|created))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير)\s+(?:ال)?خطه\s+(?:ال)?درس(?:\s+بعد\s+(?:ال)?(?:توليد|توليدها|انشائها|انشاء))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|ازيل)\s+(?:قسما|قسم|بندا|بند|جزءا|جزء|فقره)\s+(?:من|في)\s+(?:ال)?خطه(?:\s+(?:ال)?درس)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'worksheet-answers',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:hide|show|remove)\s+(?:the\s+)?answers?(?:\s+(?:on|in|from|of)\s+(?:a\s+|the\s+|my\s+)?(?:worksheet|quiz|paper|sheet))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:make|create|get|add|generate)\s+(?:an?\s+|the\s+)?answer\s+key(?:\s+(?:for|of|to)\s+(?:a\s+|the\s+|my\s+)?(?:worksheet|quiz|paper|sheet))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اخفي|اخفاء|اظهر|اظهار|احذف|ازيل)\s+(?:ال)?اجابات(?:\s+(?:من|في|عن)\s+(?:ال)?(?:ورقه|اختبار)(?:\s+(?:ال)?عمل)?)?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعمل|اجهز|احصل\s+علي|اطبع|اضيف)\s+(?:ال)?مفتاح\s+(?:ال)?(?:اجابه|اجابات)(?:\s+(?:ل|لل)\s*(?:ال)?(?:ورقه|اختبار)(?:\s+(?:ال)?عمل)?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'worksheet-header',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|put|insert)\s+(?:a\s+|the\s+|my\s+)?(?:school\s+)?(?:logo|letterhead|header)(?:\s+with\s+(?:my\s+)?name(?:\s+and\s+date)?)?(?:\s+(?:on|to|in)\s+(?:a\s+|the\s+|my\s+)?(?:worksheets?|papers?|quizz?es|exams?|sheets?))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضع|اكتب|ازود)\s+(?:ال)?(?:شعار(?:\s+(?:ال)?مدرسه)?|ترويسه|اسمي|اسم\s+(?:ال)?معلم)\s+(?:علي|في|ل|لل|الي)\s*(?:ال)?(?:اوراق|ورقه|ورق|اختبار|اختبارات)(?:\s+(?:ال)?عمل)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'difficulty',
    res: [
      new RegExp(String.raw`^(?:how\s+(?:do|can)\s+i\s+)?(?:ask\s+(?:iqra|iqraa|iqrra)\s+for|make|get)\s+(?:the\s+)?(?:harder|easier|more\s+difficult)\s+questions` + EN_RULE_TAIL),
      new RegExp(String.raw`^how\s+(?:do|can)\s+i\s+(?:make|get)\s+(?:the\s+)?questions\s+(?:harder|easier|more\s+difficult)` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:كيف|كيفيه)\s+(?:اطلب|اجعل|اخلي|خلي)\s+(?:من\s+اقرا\s+)?(?:ال)?اسئله(?:\s+(?:ال)?(?:اختبار|ورقه\s+(?:ال)?عمل))?\s+(?:اصعب|اسهل|اكثر\s+صعوبه|اقل\s+صعوبه)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:choose|set|change|pick|select)\s+(?:the\s+)?(?:difficulty|level)(?:\s+(?:of|for)\s+(?:a\s+|the\s+|my\s+)?(?:quiz|worksheet|test))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احدد|حدد|اختار|اغير|اضبط)\s+(?:مستوي|مستوى)\s+(?:ال)?(?:صعوبه|اختبار|ورقه)(?:\s+(?:ال)?عمل)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'verified-meaning',
    res: [
      new RegExp(String.raw`^(?:ما|ماذا)\s+(?:معني|يعني|تعني)\s+[«"“]?تم\s+(?:ال)?تحقق[»"”]?(?:\s+(?:من\s+(?:ال)?اجابه)?)?` + AR_RULE_TAIL),
      new RegExp(
        String.raw`^what\s+(?:does|do)\s+(?:the\s+)?["“]?(?:answer\s+)?(?:symbolically\s+)?verified["”]?\s+(?:badge\s+|tick\s+|label\s+)?mean` + EN_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'remedial-worksheet',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:prepare|make|create)\s+(?:a\s+)?remedial\s+worksheet\s+for\s+(?:the\s+)?(?:struggling|weak)\s+students` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اجهز|جهز|احضر|اعمل|انشئ)\s+ورقه\s+علاجيه\s+(?:ل|لل)\s*(?:ال)?(?:متعثرين|ضعاف|طلبه\s+(?:ال)?ضعاف)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:make|create|build|prepare|generate)\s+(?:an?\s+)?remedial\s+(?:worksheet|sheet|exercises?|work)(?:\s+for\s+(?:the\s+)?(?:weak|struggling|low|slow)\s+(?:students|learners|pupils))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعمل|اجهز|انشئ|احضر|اسوي)\s+ورقه\s+علاجيه(?:\s+(?:لل|ل)\s*(?:ال)?(?:طلاب|طلبه)(?:\s+(?:ال)?(?:ضعاف|ضعيفه|متعثرين))?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'send-worksheet',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:move|copy|assign|give|reuse)\s+(?:the\s+|a\s+|my\s+)?worksheet\s+(?:to|for)\s+(?:another|a\s+different|a\s+second|other|my\s+other)\s+class` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انقل|نقل|انسخ|نسخ|اعطي|اعيد\s+استخدام)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|ورقه)\s+(?:الي|ل|لل)\s*(?:ال)?شعبه(?:\s+(?:اخري|ثانيه|ثاني|اخر))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'ministry-plan',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:use|get|download|print)\s+(?:the\s+)?ministry\s+(?:forms?|templates?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استخدم|استعمل|احصل\s+علي|اجيب|احمل|اطبع)\s+(?:ال)?(?:نموذج|نماذج)\s+(?:ال)?وزاره(?:\s+(?:ال)?تربيه(?:\s+و(?:ال)?تعليم)?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'book-download',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:download|get)\s+(?:the\s+)?teacher['’]?s\s+(?:book|guide)(?:\s+for\s+(?:grade|class)\s+\w+)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احمل|تحميل|انزل|تنزيل)\s+كتاب\s+(?:ال)?معلم(?:\s+(?:لل|ل)\s*صف\s+\S+)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`open\s+(?:the\s+)?student(?:['’]?s)?\s+(?:book|textbook)(?:\s+(?:inside|in)\s+(?:the\s+)?app)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|اشاهد|اطلع\s+علي)\s+كتاب\s+(?:ال)?(?:طالب|مدرسي)(?:\s+(?:داخل|في)\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:download|get|find|open)\s+(?:the\s+)?(?:school\s+)?(?:textbook|text\s+book|book|teacher['’]?s?\s+guide|teacher\s+guide|activity\s+book)` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^where\s+(?:is|are|can\s+i\s+find)\s+(?:the\s+)?(?:teacher['’]?s?\s+guide|textbook|text\s+book|activity\s+book)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احمل|حمل|تحميل|انزل|نزل|اجيب|احصل\s+علي|اشوف|افتح)\s+(?:ال)?(?:كتاب\s+(?:ال)?مدرسي|دليل\s+(?:ال)?معلم|كتاب\s+(?:ال)?انشطه)` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:وين|اين|فين)\s+(?:يوجد\s+)?(?:ال)?(?:دليل\s+(?:ال)?معلم|كتاب\s+(?:ال)?مدرسي|كتاب\s+(?:ال)?انشطه)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'pricing',
    res: [
      new RegExp(
        String.raw`^how\s+many\s+(?:worksheets?|quizz?es|lesson\s+plans?|materials?|generations?|slides?)\s+(?:can\s+i|do\s+i\s+get)\s+(?:make|generate|create|use|have)(?:\s+(?:a|per|each|in\s+a)\s+(?:day|month|week))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^كم\s+(?:ورقه\s+عمل|ورقه|اختبار|خطه|مواد|مره)\s+(?:اقدر|استطيع|يمكنني)\s+(?:ان\s+)?\S+(?:\s+(?:في|بال|كل)\s*(?:ال)?(?:يوم|شهر|اسبوع))?` + AR_RULE_TAIL,
      ),
    ],
  },
  // The thirteenth live pass (2026-10-21).
  {
    id: 'change-photo',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|update|edit|add|set|upload|remove|delete)\s+(?:my\s+(?:profile\s+)?|(?:the\s+)?profile\s+)(?:photo|picture|pic|avatar|image)(?:\s+(?:in|on)\s+(?:the\s+)?(?:app|my\s+account))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|اعدل|تعديل|اضيف|اضافه|احط|اضع|ارفع|رفع|احذف|حذف|ازيل|ازاله)\s+(?:صورتي(?:\s+(?:ال)?شخصيه)?|(?:ال)?صوره\s+(?:ال)?(?:شخصيه|حساب|بروفايل)(?:ي)?(?:\s+(?:ال)?شخصيه)?)(?:\s+(?:في|علي)\s+(?:ال)?(?:تطبيق|حساب|حسابي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-phone',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|update|edit|add|set)\s+(?:my\s+|the\s+)?(?:phone|mobile|cell)\s+number(?:\s+(?:in|on)\s+(?:the\s+)?(?:app|my\s+account))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|اعدل|تعديل|اضيف|اضافه|احدث|تحديث)\s+رقم\s+(?:هاتفي|جوالي|موبايلي|تلفوني|(?:ال)?(?:هاتف|جوال|موبايل|تلفون)(?:\s+(?:تبعي|حقي|الخاص\s+بي))?)(?:\s+(?:في|علي)\s+(?:ال)?(?:تطبيق|حساب|حسابي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'homework-grade',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:give|put|enter|record|add|set|assign|write)\s+(?:a\s+|the\s+|some\s+)?(?:grade|mark|score|grades|marks|scores)\s+(?:to|for|on|of)|grade)\s+(?:a\s+|the\s+|my\s+)?(?:homework|assignment)s?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اعطي|اعطاء|اضع|وضع|ادخل|ادخال|اسجل|تسجيل|ارصد|رصد|اكتب|احط)\s+(?:ال)?(?:علامه|درجه|علامات|درجات)\s+(?:ل|لل|علي|ع|ب)\s*|اصحح\s+)(?:ال)?واجب(?:ات)?(?:\s+(?:ال)?(?:بيتي|منزلي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-qr',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:show|display|print|generate|make)\s+(?:a\s+|the\s+)?qr(?:\s+code)?\s+for\s+(?:the\s+)?(?:exam|test|quiz|evaluation)(?:\s+on\s+(?:the\s+)?(?:board|screen))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرض|اظهر|اطبع|اعمل|انشئ)\s+(?:ال)?(?:رمز|كود)?\s*qr\s+(?:ل|لل)\s*(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+علي\s+(?:ال)?(?:سبوره|لوح\S*|شاشه))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:print|make|create|generate|get|show|share)\s+(?:a\s+|the\s+)?qr(?:\s+code)?(?:\s+(?:for|of|to)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|evaluation|quiz|class|link))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اطبع|طباعه|انشئ|اعمل|ولد|توليد|احصل\s+علي|اظهر|اشارك|مشاركه)\s+(?:ال)?(?:رمز\s+)?(?:qr|كيو\s*ار|باركود)(?:\s+(?:ل|لل)\s*(?:ال)?(?:امتحان|اختبار|تقييم|شعبه|رابط))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-parents',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:send|give|notify|remind|tell|inform)\s+(?:the\s+|my\s+)?(?:parents|guardians|families)\s+(?:a\s+reminder\s+)?(?:about|of|for)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|quiz|evaluation)(?:\s+date)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        EN_RULE_LEAD + String.raw`send\s+(?:a\s+)?reminder\s+to\s+(?:the\s+|my\s+)?(?:parents|guardians|students)\s+(?:about|for|of)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|quiz|evaluation)(?:\s+date)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+(?:ال)?تذكيرا?\s+(?:ل|لل)\s*(?:ال)?(?:اهل|اولياء\s+(?:ال)?امور|اولياء|اهالي|ولي\s+(?:ال)?امر|طلبه|طلاب)\s+(?:ب|عن)\s*(?:ال)?(?:موعد\s+(?:ال)?)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اذكر|اخبر|ابلغ|انبه)\s+(?:ال)?(?:اهل|اولياء\s+(?:ال)?امور|اولياء|اهالي|ولي\s+(?:ال)?امر)\s+(?:ب|عن)\s*(?:ال)?(?:موعد\s+(?:ال)?)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'quiz-vs-evaluation',
    res: [
      new RegExp(
        String.raw`^(?:what(?:['’]?s|\s+is)\s+the\s+)?difference\s+between\s+(?:a\s+|the\s+)?(?:short\s+|quick\s+)?quizz?(?:es)?\s+and\s+(?:an?\s+|the\s+)?(?:evaluations?|exams?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:what(?:['’]?s|\s+is)\s+the\s+)?difference\s+between\s+(?:an?\s+|the\s+)?(?:evaluations?|exams?)\s+and\s+(?:a\s+|the\s+)?(?:short\s+|quick\s+)?quizz?(?:es)?` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:ما\s+(?:هو\s+)?|ماهو\s+)?الفرق\s+بين\s+(?:ال)?(?:اختبار\s+(?:ال)?(?:قصير|سريع)|كويز)\s+و\s*(?:ال)?(?:تقييم|تقييمات|امتحان)` + AR_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:ما\s+(?:هو\s+)?|ماهو\s+)?الفرق\s+بين\s+(?:ال)?(?:تقييم|تقييمات|امتحان)\s+و\s*(?:ال)?(?:اختبار\s+(?:ال)?(?:قصير|سريع)|كويز)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'duplicate-class',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:copy|duplicate|clone)\s+(?:an?\s+|the\s+)?(?:existing\s+)?class` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:انسخ|نسخ)\s+شعبه\s+(?:موجوده|قديمه|سابقه)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:duplicate|copy|clone)\s+(?:a\s+|the\s+|my\s+|this\s+)?(?:class|section)(?:\s+(?:to|into)\s+(?:a\s+)?(?:new|another)\s+(?:class|section|one))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:انسخ|نسخ|كرر|تكرار|استنسخ)\s+(?:ال)?(?:شعبه|شعبتي)(?:\s+(?:الي|ل|لل)\s*(?:ال)?(?:شعبه|شعب|صف)(?:\s+(?:جديده|اخري|ثانيه))?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'games-list',
    res: [
      new RegExp(
        String.raw`^(?:what|which)\s+(?:educational\s+|learning\s+)?games\s+(?:are\s+(?:there|in\s+the\s+app)(?:\s+in\s+the\s+app)?|does\s+(?:the\s+app|iqrra|iqraa)\s+have|can\s+i\s+play(?:\s+in\s+the\s+app)?)` + EN_RULE_TAIL,
      ),
      new RegExp(
        String.raw`^(?:ما\s+(?:هي\s+)?|ماهي\s+|ايش\s+|شو\s+)(?:ال)?العاب(?:\s+(?:ال)?تعليميه)?(?:\s+(?:الموجوده\s+)?(?:في|ب)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'english-corner',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:review|revise|practi[cs]e)\s+(?:the\s+)?(?:english\s+)?(?:book|textbook)\s+(?:words|vocabulary)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اراجع|مراجعه|ادرب|اتدرب\s+علي)\s+كلمات\s+كتاب\s+(?:ال)?(?:انجليزي|لغه\s+(?:ال)?انجليزيه)` + AR_RULE_TAIL),
      locateEn(String.raw`english\s+(?:corner|hub)`),
      locateAr(String.raw`(?:ال)?ركن\s+(?:ال)?(?:انجليزيه|انكليزيه|انجليزي)`),
    ],
  },
  // The fourteenth live pass (2026-10-22).
  {
    id: 'login-code-lost',
    res: [
      new RegExp(String.raw`^(?:i\s+)?(?:forgot|lost)\s+(?:my\s+)?(?:login|sign[\s-]?in|access)\s+code(?:\s+what\s+(?:do|should)\s+i\s+do)?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:recover|get\s+back|reset|find)\s+(?:my\s+)?(?:login|sign[\s-]?in|access)\s+code` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:انسي|نسيت|ضاع|ضيعت|فقدت)\s+(?:ال)?رمز\s+(?:ال)?دخول|(?:استعيد|استرجع|استرد)\s+(?:ال)?رمز\s+(?:ال)?دخول)(?:\s+و\s*(?:استعيده|استرجعه|استعيد|استرجع))?(?:\s+(?:شو|ايش|وش|ماذا)\s+(?:اعمل|افعل|اسوي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'family-view',
    res: [
      new RegExp(
        String.raw`^(?:how\s+)?(?:does|can|do)\s+(?:a\s+|the\s+)?(?:parent|guardian)s?\s+(?:see|check|view|track|follow)\s+(?:their|his|her|the)\s+(?:child(?:ren)?['’]?s?\s+|kid['’]?s?\s+)?(?:homework|grades?|marks?|results?|exams?|tests?|timetable|schedule)` + EN_RULE_TAIL,
      ),
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|view|track|follow)\s+my\s+(?:child|son|daughter|kid)['’]?s?\s+(?:homework|grades?|marks?|results?|exams?|tests?)` + EN_RULE_TAIL),
      new RegExp(
        String.raw`^(?:كيف\s+)?(?:يري|يشوف|يتابع|يعرف|يطلع\s+علي)\s+(?:ال)?(?:ولي\s+(?:ال)?امر|اهل|اب|ام|والد|والده)\s+(?:ال)?(?:علامات|نتائج|درجات|واجبات|امتحانات|اختبارات|جدول)\s*(?:ال)?(?:ابن\S*|بنت\S*|طالب\S*|طفل\S*|ولد\S*|اولاد\S*)?` + AR_RULE_TAIL,
      ),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اشوف|اري|اتابع|اعرف|اطلع\s+علي)\s+(?:ال)?(?:علامات|نتائج|درجات|واجبات|امتحانات)\s+(?:ابني|ابنتي|بنتي|اولادي|طفلي|ولدي)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'parent-link',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:link|connect)\s+(?:my\s+)?(?:account|parent\s+account)\s+(?:to|with)\s+(?:my\s+)?(?:child|son|daughter|kid)(?:['’]s)?(?:\s+account)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اربط|ربط|اوصل|وصل)\s+حسابي\s+(?:ب|مع)\s*(?:حساب\s+)?(?:ابني|ابنتي|بنتي|ولدي|طفلي|اولادي|ابن\S*|(?:ال)?طالب)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'plan-options',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`add\s+my\s+own\s+(?:learning\s+)?objectives\s+to\s+(?:the\s+)?(?:lesson\s+)?plan` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اكتب|ادخل|اضع)\s+اهداف(?:ا)?\s+(?:تعليميه\s+)?خاصه\s+بي\s+(?:الي|في|ل)\s*(?:ال)?خطه` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:choose|pick|change|set|select)\s+(?:the\s+|a\s+)?teaching\s+style(?:\s+(?:in|for|of)\s+(?:the\s+|my\s+)?(?:lesson\s+plan|plan))?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|change|choose|pick)\s+(?:the\s+)?(?:duration|length)\s+(?:of\s+)?(?:the\s+|my\s+)?(?:lesson\s+plan|plan)` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|write|set|enter|change)\s+(?:the\s+|my\s+|some\s+)?(?:learning\s+|lesson\s+)?objectives\s+(?:to|for|in|of)\s+(?:the\s+|my\s+)?(?:lesson\s+plan|plan)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اختار|اغير|احدد|اضبط|اعدل|تغيير|اختيار)\s+(?:ال)?اسلوب\s+(?:ال)?تدريس(?:\s+(?:في|ل|لل)\s*(?:ال)?خطه(?:\s+(?:ال)?درس)?)?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اكتب|احدد|اغير|اضع|ادخل)\s+(?:ال)?(?:اهداف|هدف)(?:\s+(?:ال)?(?:تعليميه|تعليمي|درس))?\s+(?:ل|لل|في|الي)\s*(?:ال)?خطه(?:\s+(?:ال)?درس)?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احدد|اغير|اختار|اضبط)\s+(?:مده|وقت|زمن)\s+(?:ال)?(?:حصه|خطه|درس)(?:\s+(?:في|ل|لل)\s*(?:ال)?خطه(?:\s+(?:ال)?درس)?)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'plan-language',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:translate|convert)\s+(?:the\s+|a\s+|my\s+)?(?:worksheet|lesson\s+plan|quiz)\s+(?:in)?to\s+(?:english|arabic)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اترجم|ترجمه|احول)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|اختبار)\s+(?:الي|ل)\s*(?:ال)?(?:انجليزيه|عربيه)` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:change|switch|set)\s+the\s+language\s+of\s+(?:the\s+|my\s+)?(?:lesson\s+plan|worksheet|quiz|slides|activity|material)s?(?:\s+to\s+(?:english|arabic))?` + EN_RULE_TAIL,
      ),
      new RegExp(EN_RULE_LEAD + String.raw`(?:make|get|generate|prepare|create)\s+(?:the\s+|a\s+|my\s+)?(?:lesson\s+plan|worksheet|quiz|slides)\s+in\s+(?:english|arabic)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اجعل|احول|تحويل)\s+لغه\s+(?:ال)?(?:خطه|ورقه|اختبار|شرائح|نشاط|مواد|ماده|محتوي)(?:\s+(?:ال)?(?:درس|عمل))?(?:\s+(?:الي|ل|لل)\s*(?:ال)?(?:انجليزيه|عربيه|انجليزي|عربي))?` + AR_RULE_TAIL,
      ),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احضر|اجهز|اعمل|انشئ)\s+(?:ال)?(?:خطه(?:\s+(?:ال)?درس)?|ورقه\s+(?:ال)?عمل|اختبار|شرائح)\s+(?:ب|باللغه)\s*(?:ال)?(?:انجليزيه|عربيه|انجليزي|عربي)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'email-material',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:email|send)\s+(?:the\s+|a\s+|my\s+)?(?:worksheet|lesson\s+plan|quiz)\s+to\s+(?:my\s+(?:own\s+)?)?(?:email|inbox)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|خطه\s+(?:ال)?درس|اختبار|نشاط)\s+(?:الي|ل)\s*(?:ال)?(?:بريد|ايميل)\S*` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:email|send|share)\s+(?:the\s+|a\s+|my\s+)?(?:worksheet|quiz|lesson\s+plan|slides|activity|homework)\s+(?:by|via|through|over|on)\s+(?:e-?mail|gmail)|email\s+(?:the\s+|a\s+|my\s+)?(?:worksheet|quiz|lesson\s+plan|slides))` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اشارك|شارك)\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|خطه(?:\s+(?:ال)?درس)?|شرائح|عرض|نشاط|واجب)\s+(?:ب|عبر|علي|من\s+خلال)\s*(?:ال)?(?:بريد|ايميل|اميل|جيميل)(?:\s+(?:ال)?الكتروني)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'timetable',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|put|set|assign)\s+(?:a\s+)?(?:class|lesson|period)\s+(?:to|in|into|on)\s+(?:the\s+|my\s+)?(?:weekly\s+)?(?:schedule|timetable)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضع|ادخل|اسجل|اعين)\s+(?:ال)?حصه\s+(?:الي|في|ل|لل)\s*(?:ال)?جدول(?:ي)?(?:\s+(?:ال)?(?:اسبوعي|حصص|دراسي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'timetable-remove',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:delete|remove|clear|cancel)\s+(?:a\s+|the\s+)?(?:class|lesson|period)\s+(?:from|in|on)\s+(?:the\s+|my\s+)?(?:weekly\s+)?(?:schedule|timetable)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|مسح|الغي|الغاء|ازيل|ازاله|افرغ)\s+(?:ال)?حصه\s+(?:من|في)\s+(?:ال)?جدول(?:ي)?(?:\s+(?:ال)?(?:اسبوعي|حصص|دراسي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-email',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|update|edit)\s+(?:my\s+|the\s+)?(?:e-?mail)(?:\s+(?:address|account))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|اعدل|تعديل|احدث|تحديث)\s+(?:ال)?(?:بريدي|ايميلي|اميلي|بريد|ايميل|اميل)(?:\s+(?:ال)?الكتروني)?(?:\s+(?:ي|تبعي|حقي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'verify-email',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:verify|confirm)\s+(?:my\s+|the\s+)?(?:e-?mail)(?:\s+(?:address|account))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اتحقق\s+من|تحقق\s+من|اتاكد\s+من|اوكد|تاكيد|اؤكد|اثبت|توثيق)\s+(?:ال)?(?:بريدي|ايميلي|اميلي|بريد|ايميل|اميل)(?:\s+(?:ال)?الكتروني)?` + AR_RULE_TAIL,
      ),
    ],
  },
  // The fifteenth live pass (2026-10-22).
  {
    id: 'chat-voice',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:iqra|iqraa|iqrra)\s+(?:by|with|using)\s+(?:my\s+)?voice(?:\s+instead\s+of\s+typing)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم)\s+اقرا\s+ب?(?:ال)?صوت(?:\s+بدل\s+(?:ال)?كتابه)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:use|enable|turn\s+on)\s+(?:the\s+)?(?:voice|speech)\s+(?:input|typing|dictation|mode)(?:\s+in\s+the\s+(?:chat|app))?` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:does|can)\s+(?:the\s+app|iqrra|iqraa|the\s+assistant)\s+read\s+(?:\S+\s+){0,3}?(?:aloud|out\s+loud)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اتحدث|اتكلم|استخدم)\s+(?:ب|مع)?\s*(?:ال)?(?:صوتي|صوت|ميكروفون)(?:\s+(?:في|مع)\s+(?:ال)?(?:محادثه|مساعد|تطبيق))?` + AR_RULE_TAIL),
      new RegExp(String.raw`^هل\s+(?:يقرا|ينطق|يقدر\s+يقرا)\s+(?:ال)?(?:تطبيق|مساعد|اقرا)\s+(?:ال)?(?:نص|ردود|اجابات|محادثه)?\s*(?:ب)?صوت\s+(?:عال|مسموع)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'font-size',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|increase|make|set|adjust)\s+(?:the\s+|my\s+)?(?:font|text)\s+size(?:\s+(?:in|of)\s+(?:the\s+)?app)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اكبر|تكبير|اصغر|تصغير|اضبط|ضبط)\s+(?:حجم|مقاس)\s+(?:ال)?(?:خط|كتابه|نص)(?:\s+(?:في|ب)\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'ai-usage',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|know)\s+(?:my\s+)?(?:usage|consumption)(?:\s+of\s+(?:the\s+)?(?:credit|balance|quota|limit))?(?:\s+or\s+(?:the\s+)?daily\s+limit)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اعرف|اشوف|اتحقق\s+من)\s+(?:استهلاكي|استخدامي)(?:\s+من\s+(?:ال)?(?:رصيد|حصه|حد))?(?:\s+او\s+(?:ال)?حد\s+(?:ال)?يومي)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|know|find\s+out|view)\s+how\s+many\s+(?:materials?|worksheets?|lesson\s+plans?|generations?|things)\s+(?:i(?:['’]?ve)?\s+)?(?:made|generated|created|used|have\s+(?:made|generated|created))(?:\s+this\s+month)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري|اتابع|اتاكد)\s+كم\s+(?:(?:ماده|مواد|ورقه|ورقه\s+عمل|خطه|خطط)\s+)?(?:ولدت|انشات|جهزت|استخدمت)(?:\s+(?:من\s+)?(?:ال)?(?:مواد|ماده|اوراق|خطط))?(?:\s+(?:هذا\s+(?:ال)?شهر|هالشهر))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'homework-edit',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:edit|change|update|delete|remove|cancel)\s+(?:a\s+|the\s+|my\s+)?(?:homework|assignment)(?:\s+(?:after|once)\s+(?:i\s+)?(?:posting|publishing|posted|published|sending|sent)(?:\s+it)?)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير|احذف|حذف|الغي|الغاء|امسح|مسح)\s+(?:ال)?واجب(?:ا|ات)?(?:\s+(?:بعد|عند)\s+(?:نشره|نشر|ارساله|ارسال|ما\s+انشره))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'homework-one',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|give|assign|post)\s+(?:a\s+|the\s+)?(?:homework|assignment)\s+(?:to|for)\s+(?:only\s+)?(?:one|a\s+single|a\s+specific|an?\s+individual)\s+student(?:\s+only)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت|اعطي|اسند|انشر)\s+(?:ال)?واجب(?:ا)?\s+(?:ل|لل)\s*(?:ال)?(?:طالب|طالبا?)\s+(?:واحد|معين|محدد)(?:\s+فقط)?|(?:ارسل|ابعث|ابعت|اعطي|اسند|انشر)\s+(?:ال)?واجب(?:ا)?\s+(?:ل|لل)\s*طالب\s+(?:واحد|معين|محدد)(?:\s+فقط)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-average',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|find|view|get|know)\s+(?:the\s+)?(?:class|section)\s+(?:average|mean)(?:\s+(?:in|on|for)\s+(?:the\s+|an?\s+|my\s+)?(?:exam|test|evaluation|quiz))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اجد|الاقي|اعرف|احسب)\s+(?:ال)?(?:معدل|متوسط)\s+(?:ال)?(?:شعبه|صف|طلاب|طلبه)(?:\s+(?:في|ب)\s+(?:ال)?(?:امتحان|اختبار|تقييم))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-retake',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:ask|let)\s+(?:the\s+)?students\s+(?:to\s+)?(?:retake|redo|resit)\s+(?:the\s+)?(?:exam|test|quiz)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اطلب\s+من|اسمح\s+ل)\s*(?:ال)?(?:طلبه|طلاب)\s+(?:ب)?اعاده\s+(?:ال)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:let|allow|give)\s+(?:a\s+|the\s+|my\s+)?student\s+(?:to\s+)?(?:retake|resit|redo|retry|repeat)\s+(?:the\s+|an?\s+)?(?:exam|test|quiz|evaluation)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اسمح|السماح|اتيح|اعطي|اعطاء)\s+(?:ل|لل)\s*(?:ال)?طالب\s+(?:ب)?(?:اعاده|اعاد[هة]?|تكرار)\s+(?:ال)?(?:امتحان|اختبار|تقييم)|(?:اعيد|اعاده|افتح)\s+(?:ال)?(?:امتحان|اختبار|تقييم)\s+(?:ل|لل)\s*(?:ال)?طالب` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'open-grading',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:mark|grade|correct)\s+(?:a\s+|the\s+|one\s+)?student['’]?s\s+(?:answer|response)\s+(?:by\s+hand|manually)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اصحح|تصحيح)\s+(?:ال)?اجابه\s+(?:ال)?(?:طالب|طالبه)\s+(?:يدويا|يدوي|بنفسي|باليد)` + AR_RULE_TAIL),
      new RegExp(
        String.raw`^how\s+(?:are|is|do)\s+(?:the\s+)?(?:open[\s-]?ended|written|essay|short[\s-]?answer)\s+(?:answers?|questions?|responses?)\s+(?:graded|marked|scored|checked|corrected)` + EN_RULE_TAIL,
      ),
      // Only "in the app" / "automatically": «كيف أصحح الأسئلة المقالية» is a teaching question.
      new RegExp(
        String.raw`^كيف\s+(?:تصحح|يصحح)\s+(?:ال)?(?:اسئله|اجابات)\s+(?:ال)?(?:مقاليه|مفتوحه|كتابيه)\s+(?:في\s+(?:ال)?(?:تطبيق|اقرا)|تلقائيا|اليا)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'plan-edit',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:edit|change|update|modify)\s+(?:the\s+|my\s+|a\s+)?(?:(?:monthly|weekly|term|semester|yearly|annual)\s+)?teaching\s+plan` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعدل|تعديل|اغير|تغيير)\s+(?:ال)?خطه\s+(?:ال)?تدريس(?:\s+(?:ال)?(?:شهريه|فصليه|سنويه|اسبوعيه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'google-sign-in',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:sign|log)\s*in\s+(?:with|using|via|through)\s+(?:my\s+)?google(?:\s+account)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اسجل\s+(?:ال)?دخول|ادخل|دخول|اسجل)\s+(?:ب|عبر|من\s+خلال|باستخدام)\s*(?:حساب\s+)?(?:جوجل|غوغل|google)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'languages',
    res: [
      new RegExp(String.raw`^(?:what|which)\s+languages\s+(?:are\s+supported|does\s+(?:the\s+app|iqrra|iqraa)\s+(?:support|have)|can\s+i\s+use)(?:\s+in\s+the\s+app)?` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هي\s+)?|ماهي\s+|اي\s+|ايش\s+|شو\s+)(?:ال)?لغات\s+(?:ال)?(?:مدعومه|متاحه|مدعومة)(?:\s+(?:في|ب)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  // The sixteenth live pass (2026-10-22).
  {
    id: 'today-screen',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|show|open|find)\s+(?:the\s+)?(?:weekly\s+)?(?:schedule|timetable)\s+on\s+(?:the\s+)?today\s+screen` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|اعرض|الاقي)\s+جدول\s+(?:ال)?(?:اسبوع|حصص)\s+(?:علي|في)\s+شاشه\s+(?:ال)?يوم` + AR_RULE_TAIL),
      locateEn(String.raw`(?:the\s+)?today\s+(?:screen|tab|page)`),
      locateAr(String.raw`(?:ال)?(?:شاشه|تبويب|صفحه)\s+(?:ال)?يوم`),
      new RegExp(String.raw`^what\s+(?:is|does)\s+(?:the\s+)?today\s+(?:screen|tab|page)(?:\s+(?:in\s+the\s+app|show))?` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هي\s+|هو\s+)?|ماهي\s+|شو\s+|ايش\s+)(?:ال)?(?:شاشه|تبويب|صفحه)\s+(?:ال)?يوم(?:\s+(?:في|ب)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'lesson-prep',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:what\s+(?:does|is)|what['’]?s)\s+(?:the\s+)?lesson\s+(?:readiness|prep(?:aration)?\s+(?:checklist|board))(?:\s+mean)?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`prepare\s+(?:tomorrow['’]?s|the\s+next)\s+lesson\s+(?:quickly|fast)(?:\s+from\s+(?:the\s+)?(?:home\s+page|today\s+screen))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ما|ماذا)\s+(?:معني|يعني|تعني)\s+جاهزيه\s+(?:ال)?درس` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اجهز|جهز|احضر|حضر)\s+درس\s+(?:ال)?غد\s+(?:بسرعه\s+)?(?:من\s+(?:ال)?(?:صفحه\s+(?:ال)?رئيسيه|شاشه\s+(?:ال)?يوم))?` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:prepare|prep|create|make|generate)\s+(?:all\s+)?(?:the\s+)?(?:lesson\s+)?materials\s+(?:for\s+(?:tomorrow['’]?s?\s+)?(?:class|lesson)\s*)?(?:at\s+once|in\s+one\s+go|all\s+together)?` + EN_RULE_TAIL,
      ),
      new RegExp(EN_RULE_LEAD + String.raw`skip\s+(?:the\s+)?(?:prep|preparation)\s+(?:of|for)\s+(?:a\s+|the\s+)?(?:specific\s+|certain\s+)?(?:class|lesson|period)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اجهز|جهز|انشئ|اعمل|احضر)\s+(?:كل\s+)?(?:ال)?مواد\s+(?:ال)?(?:حصه|درس)(?:\s+(?:ال)?(?:غد|بكره|بكرا|يوم\s+غد))?(?:\s+(?:دفعه\s+واحده|مره\s+واحده|كلها\s+معا))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اتخطي|اتجاوز|اخفي|الغي)\s+(?:تجهيز|تحضير)\s+(?:حصه|درس|مواد)(?:\s+(?:معينه|محدده))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'lesson-games',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`play\s+(?:the\s+)?memory\s+game\s+(?:with|using)\s+(?:the\s+)?lesson(?:['’]?s)?\s+terms` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:العب|لعب)\s+(?:لعبه\s+)?(?:ال)?ذاكره\s+ب?مصطلحات\s+(?:ال)?درس` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:what\s+are|what['’]?s)\s+(?:the\s+)?lesson\s+games` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هي\s+)?|ماهي\s+)(?:ال)?العاب\s+(?:ال)?درس` + AR_RULE_TAIL),
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:play|open|start|use)\s+(?:the\s+)?(?:memory|unscramble|scramble|spot[\s-]the[\s-]term)\s+game\s+(?:for|from|of|with)\s+(?:a\s+|the\s+|one\s+)?(?:specific\s+|certain\s+)?lesson` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:العب|اشغل|افتح|فتح|استخدم)\s+(?:ال)?(?:لعبه\s+)?(?:ال)?(?:ذاكره|ترتيب\s+(?:ال)?حروف|رتب\s+(?:ال)?حروف)(?:\s+(?:ل|لل|في)\s*(?:ال)?درس(?:\s+(?:معين|محدد))?)?(?:\s+مع\s+(?:ال)?(?:طلبه|طلاب))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'pin-lesson',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:pin|set|fix|know|see|find)\s+(?:the\s+|my\s+)?(?:current\s+|today['’]?s\s+)?lesson(?:\s+(?:i\s+am\s+teaching|i['’]?m\s+teaching))?(?:\s+now)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اثبت|تثبيت|اثبّت)\s+(?:ال)?درس(?:\s+(?:الذي|اللي)\s+(?:ادرسه|اعلمه|اعمل\s+عليه))?(?:\s+(?:الان|حاليا))?` + AR_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|اري)\s+(?:ال)?درس\s+(?:ال)?حالي(?:\s+(?:في|من)\s+(?:ال)?منهاج)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'unpin-lesson',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`unpin\s+(?:the\s+|my\s+)?(?:current\s+)?lesson` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:الغي|الغاء|ازيل|ازاله)\s+تثبيت\s+(?:ال)?درس(?:\s+(?:ال)?حالي)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'files-find',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|view|search|organi[sz]e|sort)\s+(?:all\s+)?(?:my\s+)?(?:saved\s+)?(?:materials|files|items|worksheets)(?:\s+(?:in|into)\s+folders)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ابحث|بحث|ادور|دور)\s+(?:في|عن)\s+ملفاتي|(?:انظم|تنظيم|رتب|ترتيب)\s+ملفاتي(?:\s+(?:في|ب)\s+(?:مجلدات|فولدرات|تصنيفات))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'files-restore',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:restore|recover|undelete|get\s+back)\s+(?:a\s+|the\s+|my\s+)?(?:deleted|removed)\s+(?:file|material|worksheet|item)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استعيد|استرجع|استرد|ارجع)\s+(?:ال)?(?:ملف(?:ا)?|ملفات|ورقه\s+(?:ال)?عمل)\s+(?:ال)?(?:ذي|الذي|اللي)?\s*(?:حذفته|حذفتها|مسحته|مسحتها)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'files-to-class',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:move|send|add)\s+(?:a\s+|the\s+|my\s+)?saved\s+(?:material|file|item)\s+to\s+(?:a\s+|the\s+)?(?:specific\s+)?class` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:انقل|نقل|ارسل|اضيف)\s+(?:ال)?(?:ماده|ملف|ملفا)\s+(?:ال)?محفوظه?\s+(?:الي|ل)\s*(?:ال)?شعبه\S*(?:\s+\S+)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|attach|move|assign)\s+(?:a\s+|my\s+|the\s+)?saved\s+(?:worksheet|file|material|lesson\s+plan|quiz)\s+to\s+(?:a\s+|my\s+|the\s+)?class` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشارك|شارك|اضيف|اضافه|ارفق|ارفاق|انقل|اربط|ربط|اضع)\s+(?:ملف(?:ا)?|ملفا)\s*(?:من\s+ملفاتي)?\s+(?:ل|لل|الي|مع|في)\s*(?:ال)?شعبه` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'student-work',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|check|view|track)\s+what\s+(?:my\s+)?students\s+(?:solved|did|completed|answered)(?:\s+in\s+(?:the\s+)?(?:practice|exercises?))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اتابع|اعرف)\s+(?:ما|ماذا|شو)\s+(?:حله|حلوا|حل|يحل)\s+(?:ال)?(?:طلبه|طلاب)(?:\s+(?:في|ب)\s+(?:ال)?(?:تدريب|ممارسه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'mastery-gate',
    res: [
      new RegExp(String.raw`^how\s+(?:does|is)\s+(?:the\s+)?next\s+lesson\s+(?:get\s+)?(?:locked|gated)\s+(?:until|before)\s+(?:the\s+)?(?:previous|last)\s+(?:one\s+)?(?:is\s+)?(?:mastered|passed|complete\w*)` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:كيف|كيفيه)\s+(?:يتم\s+|يعمل\s+)?قفل\s+(?:ال)?درس\s+(?:ال)?تالي\s+قبل\s+(?:اتقان|اتمام|انهاء)\s+(?:ال)?(?:درس\s+)?(?:ال)?سابق` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:what\s+is|what['’]?s|explain)\s+(?:the\s+)?mastery\s+(?:gate|gating|lock)` + EN_RULE_TAIL),
      new RegExp(String.raw`^how\s+(?:does|do|can)\s+(?:a\s+|the\s+)?students?\s+(?:unlock|open)\s+(?:the\s+)?next\s+lesson` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`unlock\s+(?:the\s+)?next\s+lesson\s+for\s+(?:a\s+|the\s+|my\s+)?student` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هي\s+|هو\s+)?|ماهي\s+)(?:ال)?(?:بوابه\s+(?:ال)?اتقان|قفل\s+(?:ال)?دروس)` + AR_RULE_TAIL),
      new RegExp(String.raw`^كيف\s+(?:يفتح|يفتحون)\s+(?:ال)?(?:طالب|طلبه)\s+(?:ال)?درس\s+(?:ال)?تالي` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|فتح)\s+(?:ال)?درس\s+(?:ال)?تالي\s+(?:ل|لل)\s*(?:ال)?طالب` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'exam-date-who',
    res: [
      new RegExp(String.raw`^who\s+(?:can\s+)?(?:see|sees)\s+(?:my\s+)?exam\s+dates` + EN_RULE_TAIL),
      new RegExp(String.raw`^من\s+(?:يستطيع\s+ان\s+)?(?:يري|يشوف)\s+(?:مواعيد|موعد)\s+(?:امتحاناتي|اختباراتي|ال?امتحان)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'subjects',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|set|pick|choose|update)\s+(?:the\s+|my\s+)?(?:grade|class\s+level)\s+(?:i\s+teach|that\s+i\s+teach)(?:\s+(?:and|&)\s+(?:my\s+)?subjects?)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|احدد|اعيد\s+تحديد)\s+(?:ال)?صف(?:ي)?(?:\s+(?:الذي|اللي)\s+ادرسه)?(?:\s+و?(?:مادتي|الماده))?(?:\s+من\s+جديد)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'school-add',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|register|set\s+up)\s+(?:my\s+)?school(?:\s+(?:to|in|on)\s+(?:my\s+account|the\s+app))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اسجل)\s+(?:ال)?مدرس(?:تي|ه)(?:\s+(?:الي|ل|لل|في)\s*(?:حسابي|ال?حساب|ال?تطبيق))?` + AR_RULE_TAIL,
      ),
    ],
  },
  // The seventeenth live pass (2026-10-22).
  {
    id: 'switch-account',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:switch|change|swap|toggle)\s+(?:between\s+)?(?:two\s+|my\s+|the\s+)?accounts?(?:\s+(?:in|on)\s+(?:the\s+)?app)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ابدل|تبديل|انتقل|الانتقال|اغير|تغيير|ابدل)\s+(?:بين\s+)?(?:حسابين|الحسابات|حساب\s+(?:الي|لحساب)\s+(?:اخر|ثاني)|حسابي\s+(?:الي|لحساب)\s+(?:اخر|ثاني))(?:\s+(?:في|ب)\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'logout-all',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:sign|log)\s*out\s+(?:of\s+)?(?:from\s+)?(?:all|every)\s+(?:my\s+)?devices` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اسجل\s+(?:ال)?خروج|تسجيل\s+(?:ال)?خروج|اخرج)\s+(?:من|علي)\s+(?:كل|جميع)\s+(?:ال)?(?:اجهزه|جهاز)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'intro-replay',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|watch|replay|view|open)\s+(?:the\s+)?(?:app\s+)?(?:intro|introduction|onboarding|welcome\s+(?:screens?|tour))(?:\s+again)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+(?:مشاهده|عرض)\s+(?:ال)?(?:مقدمه|شاشات\s+(?:ال)?ترحيب|جوله)(?:\s+(?:ال)?تعريفيه)?(?:\s+(?:لل|ل|في)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'mark-all-read',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:mark|read|clear)\s+all\s+(?:the\s+)?(?:notifications?|messages?)(?:\s+as\s+read)?(?:\s+at\s+once)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اقرا|اعلم|علم|اعلّم|امسح)\s+(?:كل\s+)?(?:ال)?(?:اشعارات|رسائل)(?:\s+(?:ك)?مقروءه)?(?:\s+دفعه\s+واحده)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'mute-chat',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`mute\s+(?:a\s+|the\s+|this\s+|one\s+)?(?:specific\s+)?(?:chat|conversation|thread|group)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اكتم|كتم)\s+(?:ال)?(?:محادثه|مجموعه|دردشه)(?:\s+(?:معينه|محدده))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'read-receipts',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:know|see|find\s+out|tell)\s+who\s+(?:has\s+)?read\s+my\s+message` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اعرف|اشوف|ارى|اري)\s+(?:من|مين)\s+(?:قرا|شاف|فتح)\s+رسالتي` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:can\s+i\s+|do\s+i\s+|does\s+the\s+app\s+)?(?:see|show|get|have)\s+(?:read\s+receipts?|seen\s+(?:status|marks?)|when\s+(?:a\s+)?(?:message|parent)\s+(?:is\s+)?(?:read|seen))` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:هل\s+)?(?:تظهر|يظهر|اشوف|اري)\s+(?:لي\s+)?(?:ال)?(?:اشعارات\s+(?:ال)?قراءه|ايصالات\s+(?:ال)?قراءه|علامه\s+(?:ال)?قراءه|شوهدت|ان\s+(?:ال)?رساله\s+(?:قرئت|قريت|شوهدت))(?:\s+(?:في|ب)\s+(?:ال)?رسائل)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'search-messages',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:search|find|look\s+for)\s+(?:an?\s+)?(?:old|previous|earlier)\s+(?:message|chat|conversation)s?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ابحث|بحث|ادور|دور)\s+(?:عن|في)\s+(?:رساله|رسائل)\s+(?:قديمه|سابقه)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'send-file-message',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|attach|share|upload)\s+(?:an?\s+|the\s+|my\s+)?(?:file|pdf|document|attachment)\s+(?:in|to|through)\s+(?:the\s+)?(?:messages?|chat|messaging)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ارسال|ارفق|ارفاق|ارفع|رفع)\s+(?:ملف(?:ا)?|ملفا|مستند(?:ا)?)\s+(?:في|عبر|ل|الي)\s*(?:ال)?(?:رسائل|مراسله|دردشه)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'eval-setup',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|choose|pick|change|select)\s+(?:the\s+)?(?:number\s+of\s+questions|question\s+count|how\s+many\s+questions)(?:\s+(?:in|for|of)\s+(?:the\s+|an?\s+)?(?:evaluation|exam|test))?` + EN_RULE_TAIL),
      new RegExp(String.raw`^what\s+(?:question\s+)?types?\s+(?:of\s+questions?\s+)?(?:can|does)\s+(?:an?\s+|the\s+)?(?:evaluation|exam|test)\s+(?:have|include|contain|use)` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:choose|pick|select|set)\s+(?:the\s+)?(?:lesson\s+)?objectives\s+(?:for|of|in)\s+(?:an?\s+|the\s+)?(?:evaluation|exam|test)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احدد|اضبط|اختار|اغير|تحديد|اختيار)\s+عدد\s+(?:ال)?اسئله(?:\s+(?:ال)?(?:تقييم|امتحان|اختبار))?` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:ما\s+هي\s+|ماهي\s+)?(?:ال)?انواع\s+(?:ال)?اسئله\s+(?:في\s+)?(?:ال)?(?:تقييم|امتحان|اختبار)` + AR_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اختار|اختيار|احدد|تحديد)\s+(?:ال)?(?:اهداف|دروس)\s+(?:ال)?درس\s+(?:ل|لل)\s*(?:ال)?(?:تقييم|امتحان|اختبار)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'eval-pass-mark',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|set|edit)\s+(?:the\s+)?pass(?:ing)?\s+(?:mark|grade)\s+(?:of|for|in)\s+(?:the\s+|an?\s+)?(?:exam|test|evaluation)(?:\s+after\s+(?:publishing|posting)(?:\s+it)?)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اعدل|تعديل)\s+علامه\s+(?:ال)?نجاح\s+في\s+(?:ال)?(?:امتحان|اختبار|تقييم)(?:\s+بعد\s+\S+)?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|change|choose|define)\s+(?:the\s+)?(?:pass(?:ing)?\s+(?:mark|grade|score|percentage)|pass\s+mark)(?:\s+(?:for|of|in)\s+(?:the\s+|an?\s+)?(?:evaluation|exam|test))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضبط|ضبط|احدد|تحديد|اغير|تغيير)\s+(?:ال)?علامه\s+(?:ال)?نجاح(?:\s+(?:ل|لل)\s*(?:ال)?(?:تقييم|امتحان|اختبار))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'eval-figures',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|attach|put|insert)\s+(?:a\s+)?(?:figure|diagram|shape|drawing|picture|image)\s+(?:to|in|into)\s+(?:a\s+|the\s+)?question` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|ارفق|ارفاق|اضع)\s+(?:رسما|رسم|شكلا|شكل|صوره|مخططا|مخطط)\s+(?:او\s+(?:رسما|رسم|شكلا|شكل|صوره)\s+)?(?:الي|في|ل)\s*(?:ال)?سؤال` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'lab-about',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:search|look)\s+(?:for\s+)?(?:a\s+)?(?:lab|laboratory)\s+experiment` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابحث|بحث)\s+عن\s+تجربه\s+(?:مخبريه|معمليه)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?(?:virtual\s+)?lab\s+(?:for|to\s+(?:do|run|try))\s+(?:an?\s+)?(?:experiments?|[a-z]+\s+experiments?)(?:\s+\w+)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|افتح|اجري)\s+(?:ال)?مختبر(?:\s+(?:ال)?افتراضي)?\s+(?:ل|في)\s*(?:تجربه|تجارب)\s+\S+` + AR_RULE_TAIL),
      new RegExp(String.raw`^what(?:['’]?s|\s+is)\s+(?:the\s+)?(?:virtual\s+)?(?:science\s+)?lab(?:oratory)?(?:\s+in\s+the\s+app)?` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هو\s+)?|ماهو\s+)(?:ال)?مختبر(?:\s+(?:ال)?افتراضي)?(?:\s+(?:في|ب)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'quran-about',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`open\s+(?:the\s+)?quran\s+corner(?:\s+to\s+memori[sz]e\s+(?:a\s+)?surah)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:افتح|فتح)\s+ركن\s+(?:ال)?قران(?:\s+(?:ال)?كريم)?(?:\s+لحفظ\s+(?:ال)?سوره)?` + AR_RULE_TAIL),
      new RegExp(String.raw`^what(?:['’]?s|\s+is)\s+(?:in|inside)\s+(?:the\s+)?quran\s+corner` + EN_RULE_TAIL),
      new RegExp(String.raw`^what\s+is\s+the\s+quran\s+corner` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ماذا|شو|ايش)\s+(?:يوجد\s+)?(?:في|داخل)\s+(?:ال)?ركن\s+(?:ال)?قران(?:\s+(?:ال)?كريم)?` + AR_RULE_TAIL),
      new RegExp(String.raw`^(?:ما\s+(?:هو\s+)?|ماهو\s+)(?:ال)?ركن\s+(?:ال)?قران(?:\s+(?:ال)?كريم)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'math-tools',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?(?:formulas|unit\s+converter)(?:\s+in\s+(?:the\s+)?math(?:s|ematics)?\s+corner)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|افتح)\s+(?:ال)?قوانين\s+و(?:ال)?صيغ(?:\s+في\s+(?:زاويه|ركن)\s+(?:ال)?رياضيات)?` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|افتح)\s+(?:ال)?محول\s+(?:ال)?وحدات` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?function\s+(?:grapher|plotter)(?:\s+(?:in|during)\s+(?:the\s+|my\s+)?(?:class|lesson))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|افتح|اشغل)\s+(?:ال)?راسم\s+(?:ال)?اقترانات(?:\s+في\s+(?:ال)?(?:حصه|صف|درس))?` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?(?:scientific\s+)?calculator\s+(?:in|during)\s+(?:the\s+|my\s+)?(?:class|lesson)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:استخدم|افتح|اشغل)\s+(?:ال)?(?:اله\s+)?(?:ال)?حاسبه(?:\s+(?:ال)?علميه)?\s+في\s+(?:ال)?(?:حصه|صف|درس)` + AR_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`use\s+(?:the\s+)?(?:scientific\s+)?calculator(?:\s+in\s+(?:the\s+)?math(?:s|ematics)?\s+corner)?` + EN_RULE_TAIL),
      new RegExp(String.raw`^what\s+(?:tools|is)\s+(?:are\s+)?in\s+(?:the\s+)?math(?:s|ematics)?\s+corner` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:استخدم|افتح|اشغل)\s+(?:ال)?(?:اله\s+)?(?:ال)?حاسبه(?:\s+(?:ال)?علميه)?(?:\s+(?:في|ب)\s+(?:زاويه|ركن)\s+(?:ال)?رياضيات)?` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:ما\s+(?:هي\s+)?|ماهي\s+)(?:ال)?ادوات\s+(?:زاويه|ركن)\s+(?:ال)?رياضيات` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'subject-average',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|get|find|calculate)\s+(?:the\s+)?average\s+(?:marks|grades|scores)\s+(?:of\s+(?:the\s+)?(?:class|students)\s+)?(?:in|for)\s+(?:a\s+|the\s+whole\s+)?(?:whole\s+)?subject` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|احسب|اعرف)\s+متوسط\s+(?:علامات|درجات)\s+(?:ال)?(?:صف|شعبه|طلبه|طلاب)\s+في\s+(?:ماده\s+)?(?:ال)?\S+\s+(?:كلها|كامله|كاملا)` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|احسب|اعرف)\s+متوسط\s+(?:علامات|درجات)\s+(?:ال)?(?:صف|شعبه|طلبه|طلاب)\s+في\s+ماده` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'teaching-plans',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|view|open|find)\s+(?:my\s+)?(?:old|previous|earlier)\s+teaching\s+plans` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|افتح|الاقي)\s+خطط\s+(?:ال)?تدريس\s+(?:ال)?(?:قديمه|سابقه)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'add-student',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|enter|paste)\s+(?:all\s+)?(?:my\s+)?students\s+(?:at\s+once|in\s+bulk|all\s+at\s+once|in\s+one\s+go)(?:\s+from\s+a\s+list)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|ادخل|ادخال|الصق|لصق)\s+(?:ال)?(?:طلاب(?:ا)?|طلبه|اسماء\s+(?:ال)?(?:طلاب|طلبه))\s+(?:دفعه(?:\s+واحده)?|مره\s+واحده|كلهم\s+معا)(?:\s+من\s+(?:ال)?(?:قائمه|ملف|نسخ))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'live-game-start',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:start|run|host|launch|create)\s+(?:a\s+|the\s+)?live\s+(?:game|quiz)(?:\s+(?:that|where)\s+.*)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابدا|اشغل|شغل|انشئ|اعمل|اطلق)\s+(?:ال)?لعبه\s+(?:ال)?مباشره(?:\s+(?:يجيب|يلعب|يشارك|يجاوب)\s+.*)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'live-game-join',
    res: [
      new RegExp(String.raw`^how\s+(?:do|can)\s+(?:the\s+|my\s+)?students\s+(?:join|enter)\s+(?:the\s+)?live\s+game` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:كيف|كيفيه)\s+(?:ينضم|يدخل|ينضمون|يدخلون|يشارك)\s+(?:ال)?(?:طلبه|طلاب)\s+(?:(?:الي|في|ل)\s*)?(?:ال)?لعبه\s+(?:ال)?مباشره` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'live-game-limit',
    res: [
      new RegExp(String.raw`^how\s+many\s+(?:students|players)\s+(?:can|could)\s+(?:play|join|take\s+part|participate)(?:\s+in)?\s+(?:the\s+)?live\s+game` + EN_RULE_TAIL),
      new RegExp(String.raw`^كم\s+(?:طالبا|طالب|لاعبا|لاعب|طلبه)(?:\s+(?:يمكنه|يمكنهم|يستطيع|يقدر|يتسع|يسمح))?(?:\s+(?:ال)?(?:مشاركه|انضمام|دخول|لعب))?(?:\s+(?:في|الي|ل))?\s+(?:ال)?لعبه\s+(?:ال)?مباشره` + AR_RULE_TAIL),
      new RegExp(String.raw`^ما\s+(?:هو\s+)?(?:اقصي|اعلي|اكبر)\s+عدد\s+(?:ل|من\s+)?(?:ال)?(?:لاعبين|طلبه|طلاب)\s+(?:في\s+)?(?:ال)?لعبه\s+(?:ال)?مباشره` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'live-game-results',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:see|view|find|check)\s+(?:the\s+)?(?:live\s+game|game)\s+results?(?:\s+after\s+.*)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ارى|اري|اشوف|اعرض|اشاهد|اطلع\s+علي)\s+(?:ال)?(?:نتائج|نتيجه)\s+(?:ال)?لعبه\s+(?:ال)?مباشره(?:\s+بعد\s+\S+)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'classroom-about',
    res: [
      new RegExp(String.raw`^what(?:['’]?s|\s+is)\s+(?:the\s+)?interactive\s+(?:class|lesson|classroom)` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:ما|ماذا)\s+(?:هي\s+|هو\s+)?(?:ال)?حصه\s+(?:ال)?تفاعليه` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'interactive-deck',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:build|create|make|design)\s+(?:an?\s+)?interactive\s+(?:presentation|deck|slides?)(?:\s+for\s+(?:the\s+|my\s+)?(?:class|lesson))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:ابني|انشئ|اعمل|اصمم|اجهز|اصنع)\s+عرضا?\s+تفاعليا?(?:\s+(?:ل|لل)\s*(?:ال)?(?:صف|حصه|درس))?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'slides-own-text',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:create|make|build|generate)\s+(?:the\s+)?(?:slides|a\s+presentation|a\s+deck)\s+from\s+(?:my\s+own\s+|my\s+|a\s+)?(?:text|notes)(?:\s+i\s+(?:write|wrote|paste))?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:انشئ|اعمل|اجهز|ابني|اصنع)\s+(?:ال)?(?:شرائح|عرضا?(?:\s+تقديميا?)?)\s+من\s+(?:نص|كلام|ملاحظات)(?:\s+(?:اكتبه|الصقه|عندي)(?:\s+انا)?)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'slide-theme',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:choose|change|pick|select|set)\s+(?:the\s+|a\s+)?(?:slide|slides|deck|presentation)\s+(?:theme|template|look|design|style)` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اختار|اغير|احدد|اضبط)\s+(?:ال)?(?:قالب|مظهر|ثيم|تصميم|الوان)\s+(?:ال)?(?:شرائح|عرض)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'activity-types',
    res: [
      new RegExp(String.raw`^what\s+(?:types|kinds)\s+of\s+(?:class(?:room)?\s+)?activities\s+(?:are\s+)?(?:available|there)` + EN_RULE_TAIL),
      new RegExp(String.raw`^ما\s+(?:هي\s+)?(?:انواع|اشكال|انماط)\s+(?:ال)?انشطه(?:\s+(?:ال)?صفيه)?(?:\s+(?:ال)?متاحه)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'activity-group-size',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|choose|change|control)\s+(?:the\s+)?group\s+size(?:\s+(?:for|of|in)\s+(?:the\s+|an?\s+)?activity)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدد|حدد|اغير|اضبط|اختار)\s+عدد\s+(?:ال)?(?:طلبه|طلاب)\s+في\s+(?:ال)?مجموعه(?:\s+(?:لل|ل)\s*(?:ال)?نشاط)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'quiz-types',
    res: [
      new RegExp(String.raw`^what\s+(?:types|kinds)\s+of\s+questions\s+(?:are\s+(?:in|there\s+in)|can\s+(?:a|the)\s+quiz\s+have|does\s+the\s+quiz\s+have)(?:\s+(?:the\s+|a\s+)?(?:short\s+)?quiz)?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|include)\s+(?:an?\s+)?essay\s+question\s+(?:to|in)\s+(?:the\s+|a\s+)?(?:short\s+)?quiz` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:shuffle|randomi[sz]e)\s+(?:the\s+)?(?:order\s+of\s+)?(?:the\s+)?(?:short\s+)?quiz\s+questions` + EN_RULE_TAIL),
      new RegExp(String.raw`^ما\s+(?:هي\s+)?انواع\s+(?:ال)?اسئله\s+(?:في|ب)\s+(?:ال)?اختبار(?:\s+(?:ال)?قصير)?` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضف)\s+سؤالا?\s+مقاليا?\s+(?:لل|ل|الي|في)\s*(?:ال)?اختبار(?:\s+(?:ال)?قصير)?` + AR_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اخلط|خلط)\s+(?:ترتيب\s+)?(?:ال)?اسئله\s+(?:ال)?اختبار(?:\s+(?:ال)?قصير)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'worksheet-levels',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:set|choose|pick)\s+(?:the\s+)?(?:level|difficulty)\s+of\s+(?:a\s+|the\s+)?worksheet\s+for\s+(?:strong|advanced|weak|struggling|gifted)\s+students` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احدد|حدد|اضبط|اختار)\s+مستوي\s+ورقه\s+(?:ال)?عمل\s+(?:ل|لل)\s*(?:ال)?(?:طلبه|طلاب)\s+(?:ال)?(?:متفوقين|ضعاف|الضعاف|المتوسطين)` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'worksheet-example',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:add|include)\s+(?:a\s+)?(?:worked|solved)\s+example\s+(?:to|in)\s+(?:the\s+|a\s+|my\s+)?worksheet` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اضيف|اضافه|اضف|ادرج)\s+مثالا?\s+محلولا?\s+(?:ل|الي|في)\s*(?:ال)?ورقه\s+(?:ال)?عمل` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'worksheet-count',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:reduce|lower|decrease|increase|change|set)\s+(?:the\s+)?(?:number\s+of\s+questions|question\s+count)\s+(?:in|on|of|for)\s+(?:the\s+|a\s+|my\s+)?worksheet` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اقلل|تقليل|انقص|اخفض|ازيد|زياده|اغير)\s+عدد\s+(?:ال)?اسئله\s+(?:في|ب)\s+(?:ال)?ورقه\s+(?:ال)?عمل` + AR_RULE_TAIL),
    ],
  },
];

/**
 * «وين ألاقي خطة الدرس اللي حفظتها؟» opened the lesson-plan generator: the tool's
 * name was the only keyword. Something the teacher saved is in «ملفاتي», whatever
 * kind it is, so a where / how question that says it was saved goes there.
 */
const DARK_MODE = /(?:^|\s)(?:ال)?وضع\s+(?:ال)?(?:ليلي|داكن|مظلم)(?:\s|$)|\b(?:dark|night)\s+(?:mode|theme)\b/;
const SAVED_WORD = /(?:^|\s)(?:حفظتها|حفظته|حفظتهم|حفظت|المحفوظه|المحفوظات|محفوظه|محفوظ)(?:\s|$)|\bsaved\b/;

/**
 * «كيف أشارك رمز الربط مع أولياء الأمور؟» opened Messages: «أولياء الأمور» is a
 * longer keyword than «رمز الربط», and the longest keyword wins. The link code is
 * the app's own word, so wherever it is named in a how / where question, it is
 * what the question is about.
 */
const LINK_CODE = /(?:^|\s)(?:رمز\s+(?:ال)?(?:ربط|انضمام)|link\s+code|join\s+code|class\s+code)(?:\s|$)/;
const AR_INTENT_START = new RegExp(`^${AR_INTENT}`);
const EN_INTENT_START = new RegExp(`^${EN_INTENT}`);

const statementPlaceId = (plainQuery: string): string | undefined => {
  const rule = RULE_PLACES.find(r => r.res.some(re => re.test(plainQuery)));
  if (rule) return rule.id;
  if (
    LINK_CODE.test(plainQuery) &&
    (HOW_PATTERN.test(plainQuery) || WHERE_PATTERN.test(plainQuery) || AR_INTENT_START.test(plainQuery) || EN_INTENT_START.test(plainQuery))
  ) {
    return 'link-code';
  }
  if (SAVED_WORD.test(plainQuery) && (WHERE_PATTERN.test(plainQuery) || HOW_PATTERN.test(plainQuery))) return 'workspace';
  // There is no switch to point at, so «وين الوضع الليلي» gets the explanation,
  // not a path to a screen that does not have one.
  if (
    DARK_MODE.test(plainQuery) &&
    (HOW_PATTERN.test(plainQuery) || WHERE_PATTERN.test(plainQuery) || AR_INTENT_START.test(plainQuery) || EN_INTENT_START.test(plainQuery))
  ) {
    return 'dark-mode';
  }
  return STATEMENT_PLACES.find(s => s.re.test(plainQuery))?.id;
};
const isAddToAccount = (plainQuery: string) =>
  EN_ADD_TO_ACCOUNT.test(plainQuery) || EN_ADD_BARE_GRADE.test(plainQuery) || EN_ADD_GRADE_TO_MY.test(plainQuery) ||
  AR_ADD_TO_ACCOUNT.test(plainQuery) || AR_ADD_BARE_GRADE.test(plainQuery);

/**
 * «i want to change the language», «بدي افتح الاعدادات»: first-person intent, a
 * verb, an optional «my / the», then exactly the name of a screen and nothing
 * else — so «i want to change the lesson to be shorter» and «i want to find the
 * best game for students» stay teaching. Built from the places' own keywords so
 * a screen added there is covered here. A generator's name counts only after
 * «export / تصدير», which is a question about the app whatever it exports.
 * Written against `matchForm()` output, which also drops «ال».
 */
type ScreenPatterns = { en: RegExp; ar: RegExp; enProblem: RegExp[]; arProblem: RegExp };
let screenPatterns: ScreenPatterns | null = null;
function buildScreenPatterns(): ScreenPatterns {
  if (screenPatterns) return screenPatterns;
  const esc = (kw: string) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const alt = (list: string[]) => [...new Set(list)].sort((a, b) => b.length - a.length).map(esc).join('|');
  const latin = (kw: string) => /^[\x00-\x7F]+$/.test(kw);
  const screens = APP_PLACES.filter(p => !p.isTool).flatMap(p => p.keywords);
  const tools = APP_PLACES.filter(p => p.isTool).flatMap(p => p.keywords);
  const enScreens = alt(screens.filter(latin));
  const arScreens = alt(screens.filter(k => !latin(k)));
  const verbBearing = /^(?:change|start|switch|تغيير|تغير|اغير|بدء|ابدا)(?:\s|$)/;
  const tail = String.raw`(?:\s+(?:please|pls|plz|now|today))*$`;
  const enDet = String.raw`(?:(?:my|the|a|an|our|your|all|some)\s+)?`;
  const enVerb = String.raw`(?:change|edit|open|see|view|find|go\s+to|delete|remove|link|invite|switch|start)`;
  const arVerb = String.raw`(?:اغير|اعدل|افتح|اشوف|اشاهد|اري|الاقي|احذف|اربط|ادعو|ابدا)`;
  const en = new RegExp(
    `^${EN_INTENT}(?:` +
      `${enVerb}\\s+${enDet}(?:${enScreens})` +
      `|(?:${alt(screens.filter(k => latin(k) && verbBearing.test(k)))})` +
      `|export\\s+${enDet}(?:${alt([...screens, ...tools].filter(latin))})` +
    `)${tail}`,
  );
  const ar = new RegExp(
    `^${AR_INTENT}(?:` +
      `${arVerb}\\s+(?:${arScreens})` +
      `|(?:${alt(screens.filter(k => !latin(k) && verbBearing.test(k)))})` +
      `|(?:تصدير|اصدر)\\s+(?:${alt([...screens, ...tools].filter(k => !latin(k)))})` +
    `)${tail}`,
  );
  // Problems: the same anchor, so «i can't find the settings of the equation» is
  // not «i can't find settings». Screens only: a generator's name never counts.
  const enNeg = String.raw`(?:i|we)\s+(?:am\s+|are\s+)?(?:can['’]?t|cannot|can\s+not|couldn['’]?t|could\s+not|unable\s+to|not\s+able\s+to|don['’]?t|do\s+not|didn['’]?t|did\s+not)\s+(?:seem\s+to\s+)?`;
  const enSubject = String.raw`(?:(?:my|the|all\s+my|all\s+the)\s+)?`;
  const enProblem = [
    // «i can't find my classes», «i can't add a class» (the keyword carries its own «add»)
    new RegExp(`^${enNeg}(?:(?:find|see|open|reach|access|get\\s+to|locate)\\s+${enDet})?(?:${enScreens})(?:\\s+(?:anymore|anywhere|now|again))*$`),
    // «my classes are missing», «my class list is empty»
    new RegExp(`^${enSubject}(?:${enScreens})(?:\\s+list)?\\s+(?:is|are)\\s+(?:missing|gone|empty|not\\s+(?:showing|there|appearing|visible)|disappeared)(?:\\s+(?:now|again|too))*$`),
    // «where did my classes go»
    new RegExp(`^where\\s+(?:did|has|have)\\s+${enSubject}(?:${enScreens})\\s+(?:go|gone|went|disappear(?:ed)?)$`),
  ];
  const arProblem = new RegExp(
    String.raw`^(?:(?:ما|مو|مش|لم|لن)\s*(?:ب)?(?:لقيت|لاقي|الاقي|اجد|شفت|اشوف|اري)\s+(?:${arScreens})(?:\s+(?:بعد|الان|ابدا))*` +
      String.raw`|(?:اختفت|اختفي|ضاعت|راحت)\s+(?:${arScreens})` +
      String.raw`|(?:${arScreens})\s+(?:اختفت|ضاعت|راحت|مفقوده|فاضيه|فارغه))$`,
  );
  screenPatterns = { en, ar, enProblem, arProblem };
  return screenPatterns;
}
const isScreenStatement = (query: string) => {
  const q = matchForm(query);
  const { en, ar } = buildScreenPatterns();
  return en.test(q) || ar.test(q);
};
/** A problem with adding gets the add steps, not the path to the screen. */
const PROBLEM_ADDING = /\b(?:add|create)\b|(?:^|\s)(?:اضيف|اضافه|انشي)(?:\s|$)/;
const isProblemWithScreen = (query: string) => {
  const q = matchForm(query);
  const { enProblem, arProblem } = buildScreenPatterns();
  return enProblem.some(re => re.test(q)) || arProblem.test(q);
};

/**
 * «class of compounds», «class activity», «class quiz» say «class» in the other
 * sense. Dropped before the keywords are matched, so «where can i find classes of
 * compounds» no longer finds My classes — the word after it still counts, so «the
 * class activity» still finds the activity generator.
 */
const NOT_A_SCHOOL_CLASS = /\bclass(?:es)?(?=\s+(?:of|activity|activities|quiz|quizzes|test|exam|worksheet)\b)/g;

/** «جدول الضرب» and «الجدول الدوري» are the times table and the periodic table, not the timetable. */
const NOT_A_TIMETABLE = /(?:^|\s)جدول(?=\s+(?:ضرب|دوري)(?:\s|$))/g;

/**
 * «كيف أضيف صفاً إلى المصفوفة» is a matrix row, not a grade: dropped before the
 * keywords are matched, so «اضيف صف» no longer finds the grade steps. Only when
 * the matrix follows («صف جديد للمصفوفة», «صفوف في المصفوفة»).
 */
const NOT_A_GRADE = /(?:^|\s)(?:صف|صفوف)(?=(?:\s+(?:جديد|اخر|ثاني|اضافي))?\s+(?:(?:الي|في|من)\s+)?(?:لل|ل)?مصفوف)/g;

/**
 * «how do i make students listen» and «كيف أشارك طلابي في النقاش» got the
 * add-a-class steps (found 2026-10-18): a how-verb plus «students» was all the
 * matcher saw. The students are in nearly every teaching question, so alone they
 * point at My classes only when asked where («وين طلابي»); adding one is
 * `ADD_STUDENT`'s, which is anchored.
 */
const STUDENT_WORDS = new Set(['students', 'طلابي', 'طلبتي']);

/** A word that says the question is about the app, even when no place matched. */
const APP_NOUN = /تطبيق|البرنامج|صفحه|قسم|تبويب|زر|قائمه|\bapp\b|\bpage\b|\bscreen\b|\btab\b|\bbutton\b|\bmenu\b/i;

/**
 * Places the question names, best first, at most `limit`. A keyword counts
 * only as whole words — «جدول» must not claim «الجدول الدوري» on a chemistry
 * question, so multi-word keywords win over their single-word prefixes.
 */
export function findAppPlaces(query: string, limit = 3): AppPlace[] {
  const pq = plain(query);
  const statementId = statementPlaceId(pq);
  if (statementId) return APP_PLACES.filter(p => p.id === statementId);
  const q = ` ${matchForm(query).replace(NOT_A_SCHOOL_CLASS, ' ').replace(NOT_A_TIMETABLE, ' ').replace(NOT_A_GRADE, ' ')} `;
  const howOnly = HOW_PATTERN.test(pq) && !WHERE_PATTERN.test(pq);
  const scored: { place: AppPlace; score: number }[] = [];
  for (const place of APP_PLACES) {
    let best = 0;
    for (const kw of place.keywords) {
      if (howOnly && STUDENT_WORDS.has(kw)) continue;
      if (q.includes(` ${kw} `)) best = Math.max(best, kw.length);
    }
    if (best > 0) scored.push({ place, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.place);
}

const plain = (query: string) => normalize(foldAccusative(query.replace(/[؟?!.,،]/g, ' ')));

/** "How do I…" rather than "where is…" — the answer is steps, not a path. */
export function isHowQuery(query: string): boolean {
  const q = plain(query);
  // «add more classes to my account» is a «how do I» in disguise: it gets the steps.
  // So is «i can't add a class», and a statement about a screen gets that screen's
  // steps when it has any (answerAppHelp falls back to the path when it has none).
  return HOW_PATTERN.test(q) || isAddToAccount(q) || Boolean(statementPlaceId(q)) || (isProblemWithScreen(q) && PROBLEM_ADDING.test(q)) || isScreenStatement(query);
}

/**
 * «كيف أعدّل ورقة العمل لتناسب الطلاب الضعاف؟», «كيف أستخدم النشاط لتعزيز
 * التعاون؟», "how do i make my slides more engaging": a how-question that names a
 * material and then what it is for asks about teaching, and got the make-a-worksheet
 * steps (found 2026-10-18). Anchored rules and statements are decided before this,
 * so «كيف أطبع ورقة العمل بدون إجابات» keeps its steps.
 */
const PURPOSE =
  /(?:^|\s)(?:لتناسب|ليناسب|يناسب|تناسب|لتعزيز|ليعزز|لتنميه|لتحسين|ليحسن|لزياده|لجعل|ليكون|لتكون|لتشجيع|ليشجع|لمراعاه|يراعي|بحيث|بطريقه|بشكل|حتي|لكي|كي)(?:\s|$)|(?:^|\s)(?:اقل|اكثر)\s+(?:مللا?|تشويقا?|متعه|جاذبيه|تفاعلا?|تعقيدا?|صعوبه)(?:\s|$)|\b(?:(?:more|less)\s+(?:engaging|interesting|fun|interactive|challenging|difficult|effective|attractive|exciting|creative|accessible|boring|dull|tedious|stressful|repetitive|monotonous|confusing|overwhelming)|so\s+that|for\s+(?:weak|struggling|gifted|advanced|slow|fast|mixed)|to\s+(?:help|engage|support|improve|motivate|encourage|suit|fit|differentiate))\b/;

/**
 * A how-question that says what the material is for. It is advice, not a request
 * to make or change anything — so the chat must neither build the tool
 * («how do i make my slides more engaging» opened the slides builder) nor treat
 * it as an edit of the open paper («كيف أعدّل ورقة العمل لتناسب الطلاب الضعاف؟»
 * asked «أيّ مادة تقصد؟»), both found 2026-10-19.
 */
export function isPurposeQuestion(query: string): boolean {
  const q = plain(query);
  return !WHERE_PATTERN.test(q) && HOW_PATTERN.test(q) && PURPOSE.test(q);
}

/**
 * True when the teacher is asking where something is in the app, or how to do
 * something in it. Needs both a "where / how do I" phrase and something
 * app-shaped — «أين تقع البتراء؟» is a geography question and must stay one.
 */
export function isAppHelpQuery(query: string): boolean {
  const q = plain(query);
  if (isAddToAccount(q) || statementPlaceId(q) || isProblemWithScreen(q) || isScreenStatement(query)) return true;
  if (!WHERE_PATTERN.test(q) && !HOW_PATTERN.test(q)) return false;
  if (!WHERE_PATTERN.test(q) && PURPOSE.test(q)) return false;
  return findAppPlaces(q, 1).length > 0 || APP_NOUN.test(q);
}

export type AppHelpAnswer = { text: string; places: AppPlace[] };

const PRINT_VERB = /(?:^|\s)(?:اطبع|نطبع|طباعه)(?:\s|$)|\bprint/;
const REMOVE_VERB = /(?:^|\s)(?:احذف|حذف|امسح|مسح|ازيل|ازاله|ارشف|ارشفه|الغي|الغاء)(?:\s|$)|\b(?:delete|remove|archive|erase)\b/;
/**
 * «كيف أغير اسم الشعبة؟» got «اضغط شعبة جديدة» (found 2026-10-18): a teacher who
 * follows it ends up with two classes. Steps that make a new class or student
 * never answer a question about changing one. Not the grade steps: «اريد تغيير
 * الصف» is answered with them on purpose (see `STATEMENT_PLACES`).
 */
const CHANGE_VERB = /(?:^|\s)(?:اغير|تغيير|اعدل|تعديل|ابدل|تبديل|تسميه)(?:\s|$)|\b(?:change|edit|rename|update)\b/;
/**
 * A generator's make-steps answer only a question about making one: «كيف أشارك
 * ورقة العمل على واتساب؟» got «اختر ورقة عمل… جهّز ورقة العمل» (found 2026-10-18).
 */
const MAKE_HOWS = new Set(Object.values(TOOL_HOW));
const MAKE_VERB = /(?:^|\s)(?:ا|ن)?(?:عمل|نشئ|نشي|نشاء|سوي|جهز|حضر|ولد|كتب|صنع)(?:\s|$)|(?:^|\s)(?:انشاء|اعداد|تحضير|تجهيز|توليد|عمل)(?:\s|$)|\b(?:make|create|generate|prepare|build|write|design|produce|get)\b/;
const NEW_ITEM_HOWS = new Set(['howAddClass', 'howAddStudent']);
/** Steps that add something, which must not answer a question about removing it. */
const ADD_HOWS = new Set(['howAddClass', 'howAddGrade', 'howAddStudent']);

/** The reply text and the places to offer as buttons. */
export function answerAppHelp(
  query: string,
  lang: 'ar' | 'en',
  t: (key: string) => string,
): AppHelpAnswer {
  const isAr = lang === 'ar';
  const places = findAppPlaces(query);
  if (!places.length) {
    const faq = APP_PLACES.find(p => p.id === 'faq')!;
    return {
      text: isAr
        ? 'لم أعرف أي قسم تقصد. تجد شرحًا لأقسام التطبيق في «الأسئلة الشائعة» داخل الملف الشخصي، أو اكتب لي اسم ما تبحث عنه.'
        : "I couldn't tell which part you mean. The FAQ under Profile explains each part of the app, or tell me the name of what you're looking for.",
      places: [faq],
    };
  }
  // A how-to gets the steps of the best match when it has them, with the
  // button to open it; otherwise it falls through to the path listing.
  // «how do I export my lesson plan» names a generator first and the export
  // screen second: the steps asked for are the export's, so it is the one place
  // allowed to answer from behind another.
  // Printing is exporting: «كيف أطبع ورقة العمل» gets the export steps, which
  // end in a PDF or Word file ready to print. And steps for adding never answer
  // a question about removing: «كيف أحذف صفاً» gets the path to the grades, not
  // «اضغط إضافة صف» (the class version has its own steps, `archive-class`).
  const q = plain(query);
  const exportHow = places.find(p => p.id === 'export')?.howKey
    ?? (PRINT_VERB.test(q) ? APP_PLACES.find(p => p.id === 'export')?.howKey : undefined);
  const firstHow = places[0]!.howKey && !(ADD_HOWS.has(places[0]!.howKey) && REMOVE_VERB.test(q)) && !(NEW_ITEM_HOWS.has(places[0]!.howKey) && CHANGE_VERB.test(q))
    && !(MAKE_HOWS.has(places[0]!.howKey) && !MAKE_VERB.test(q))
    ? places[0]!.howKey
    : undefined;
  // A generator's own steps say how to make one, so «how do I export my
  // worksheet» still gets the export's.
  const how = isHowQuery(query)
    ? places[0]!.isTool ? exportHow ?? firstHow : firstHow ?? exportHow
    : undefined;
  if (how) return { text: t(how), places: [places[0]!] };
  const sep = isAr ? ' ← ' : ' → ';
  const lines = places.map(p => {
    // A top-level place has no path to add: «المكتبة: المكتبة» said nothing twice.
    if (p.pathKeys.length === 0) return `• **${t(p.labelKey)}**`;
    const where = [...p.pathKeys, p.labelKey].map(t).join(sep);
    return `• **${t(p.labelKey)}**: ${where}`;
  });
  return {
    text: [isAr ? 'تجده هنا:' : "Here's where to find it:", ...lines, '', isAr ? 'أو اضغط الزر لأفتحه لك:' : 'Or tap the button to open it:'].join('\n'),
    places,
  };
}
