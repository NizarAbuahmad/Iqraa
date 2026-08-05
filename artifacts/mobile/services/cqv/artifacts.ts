import type { CqvArtifactId } from './types';

export type CqvArtifactDef = {
  id: CqvArtifactId;
  label: string;
  labelAr: string;
  /** Expo Router path */
  route: string;
  /** How this maps in the Investor MVP demo stack */
  note?: string;
  noteAr?: string;
};

export const CQV_ARTIFACTS: CqvArtifactDef[] = [
  {
    id: 'lesson-plan',
    label: 'Lesson Plan',
    labelAr: 'خطة درس',
    route: '/ai-tools/lesson-plan',
  },
  {
    id: 'worksheet',
    label: 'Worksheet',
    labelAr: 'ورقة عمل',
    route: '/ai-tools/worksheet',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    labelAr: 'اختبار',
    route: '/ai-tools/quiz',
  },
  {
    id: 'homework',
    label: 'Homework',
    labelAr: 'واجب منزلي',
    route: '/ai-tools/worksheet',
    note: 'Demo path: homework uses the worksheet generator.',
    noteAr: 'مسار العرض: الواجب يستخدم مولّد ورقة العمل.',
  },
  {
    id: 'classroom-activity',
    label: 'Classroom Activity',
    labelAr: 'نشاط صفي',
    route: '/ai-tools/activity',
  },
  {
    id: 'interactive-lesson',
    label: 'Interactive Lesson',
    labelAr: 'درس تفاعلي',
    route: '/ai-tools/lesson-flow',
  },
  {
    id: 'assessment',
    label: 'Assessment',
    labelAr: 'تقييم',
    route: '/ai-tools/quiz',
    note: 'Demo path: assessment reviewed via the quiz generator.',
    noteAr: 'مسار العرض: التقييم يُراجع عبر مولّد الاختبار.',
  },
  {
    id: 'answer-key',
    label: 'Answer Key',
    labelAr: 'مفتاح الإجابة',
    route: '/ai-tools/worksheet',
    note: 'Review answer-key sections inside worksheet/quiz demo output.',
    noteAr: 'راجع أقسام مفتاح الإجابة داخل مخرجات ورقة العمل/الاختبار.',
  },
];

export function getArtifactDef(id: CqvArtifactId): CqvArtifactDef {
  return CQV_ARTIFACTS.find(a => a.id === id) ?? CQV_ARTIFACTS[0]!;
}
