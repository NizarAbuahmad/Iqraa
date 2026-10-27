/**
 * Intelligent action chips shown after documents are ready.
 */

import type { HomeToolId } from '@/services/homeAiTools';

export type DocQuickAction = {
  id: string;
  emoji: string;
  labelAr: string;
  labelEn: string;
  /** Fill chat input / send as query */
  promptAr: string;
  promptEn: string;
  /** Optional one-click generator tool */
  toolId?: HomeToolId;
};

export const DOCUMENT_QUICK_ACTIONS: DocQuickAction[] = [
  {
    id: 'lesson-plan', emoji: '📖', labelAr: 'خطة درس', labelEn: 'Lesson Plan',
    promptAr: 'جهّز خطة درس كاملة بناءً على الملفات المرفوعة',
    promptEn: 'Create a full lesson plan based on the uploaded files',
    toolId: 'lesson-plan',
  },
  {
    id: 'worksheet', emoji: '📝', labelAr: 'ورقة عمل', labelEn: 'Worksheet',
    promptAr: 'جهّز ورقة عمل صفية من المحتوى المرفوع',
    promptEn: 'Create an in-class worksheet from the uploaded content',
    toolId: 'worksheet',
  },
  {
    id: 'homework', emoji: '🏠', labelAr: 'واجب بيتي', labelEn: 'Homework',
    promptAr: 'جهّز واجباً منزلياً مناسباً من هذه الملفات',
    promptEn: 'Create suitable homework from these materials',
    toolId: 'homework',
  },
  {
    id: 'quiz', emoji: '✅', labelAr: 'اختبار قصير', labelEn: 'Quiz',
    promptAr: 'جهّز اختباراً قصيراً من محتوى الملفات',
    promptEn: 'Create a short quiz grounded in the files',
    toolId: 'quiz',
  },
  {
    id: 'objectives', emoji: '🎯', labelAr: 'أهداف تعلم', labelEn: 'Learning Objectives',
    promptAr: 'استخرج أهداف تعلم واضحة من الملفات المرفوعة',
    promptEn: 'Extract and write clear learning objectives from the uploaded files',
  },
  {
    id: 'bloom', emoji: '🧠', labelAr: 'أسئلة بلوم', labelEn: 'Bloom Questions',
    promptAr: 'جهّز أسئلة حسب مستويات بلوم من المحتوى المرفوع',
    promptEn: 'Create Bloom taxonomy questions from the uploaded content',
  },
  {
    id: 'activity', emoji: '👥', labelAr: 'نشاط صفي', labelEn: 'Classroom Activity',
    promptAr: 'جهّز نشاطاً صفياً عملياً من هذه الملفات',
    promptEn: 'Create a practical classroom activity from these materials',
    toolId: 'activity',
  },
  {
    id: 'simplify', emoji: '💡', labelAr: 'تبسيط الشرح', labelEn: 'Simplify',
    promptAr: 'بسّط الشرح للطلبة المتعثرين بناءً على الملفات',
    promptEn: 'Simplify the explanation for struggling students using the files',
  },
  {
    id: 'summary', emoji: '📄', labelAr: 'ملخص الدرس', labelEn: 'Summary',
    promptAr: 'لخّص الدرس من الملفات المرفوعة بنقاط واضحة',
    promptEn: 'Summarize the lesson from the uploaded files clearly for the teacher',
  },
  {
    id: 'concepts', emoji: '🔍', labelAr: 'مفاهيم أساسية', labelEn: 'Key Concepts',
    promptAr: 'استخرج المفاهيم والمصطلحات والقوانين المهمة من الملفات',
    promptEn: 'Extract key concepts, vocabulary, and formulas from the files',
  },
  {
    id: 'translate', emoji: '🌍', labelAr: 'ترجمة', labelEn: 'Translate',
    promptAr: 'ترجم النقاط الأساسية من الملفات إلى العربية والإنجليزية',
    promptEn: 'Translate the key points from the files into Arabic and English',
  },
  {
    id: 'rewrite', emoji: '✍', labelAr: 'إعادة صياغة', labelEn: 'Rewrite',
    promptAr: 'أعد صياغة الشرح بأسلوب أوضح وأكثر ملاءمة للصف',
    promptEn: 'Rewrite the explanation in a clearer classroom-ready style',
  },
  {
    id: 'exit', emoji: '📋', labelAr: 'غلق الدرس', labelEn: 'Exit Ticket',
    promptAr: 'جهّز غلق درس قصيرًا للتحقق من الفهم',
    promptEn: 'Create a short exit ticket to check understanding',
  },
];
