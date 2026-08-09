/**
 * Curriculum catalog — re-exported from `@workspace/curriculum`.
 *
 * The catalog itself moved into a shared package because the API server has to
 * resolve learning objectives server-side (evaluation questions are generated
 * and graded against them, and that can't depend on what a client sends).
 *
 * This file stays so the ~25 screens and services importing
 * `@/services/curriculumData` keep working unchanged. Add curriculum *data* to
 * the package, not here.
 */
export * from '@workspace/curriculum';

// ─── Notifications ────────────────────────────────────────────────────────────
// Mock UI data, not curriculum — deliberately left in the app.
export const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'تحديث المنهج', titleEn: 'Curriculum Update', body: 'تم تحديث منهج الكيمياء للصف العاشر للعام 2024-2025.', bodyEn: 'Grade 10 Chemistry curriculum updated for 2024-2025.', time: 'منذ ساعتين', timeEn: '2h ago', read: false, type: 'info' },
  { id: 'n2', title: 'خطة الدرس جاهزة', titleEn: 'Lesson Plan Ready', body: 'خطة درس الروابط الكيميائية جاهزة للاستخدام.', bodyEn: 'AI-generated lesson plan for Chemical Bonding is ready.', time: 'منذ 4 ساعات', timeEn: '4h ago', read: false, type: 'success' },
  { id: 'n3', title: 'رسالة المدير', titleEn: 'Admin Message', body: 'جدول الاختبارات النصفية متاح. يرجى مراجعة القاعات المخصصة.', bodyEn: 'Midterm exam schedule posted. Please review your assigned rooms.', time: 'منذ يوم', timeEn: '1d ago', read: true, type: 'warning' },
  { id: 'n4', title: 'مورد تعليمي جديد', titleEn: 'New Resource', body: 'تمت إضافة ورقة عمل جديدة لمادة العلوم – الصف الثامن.', bodyEn: 'New worksheet for Science Grade 8 has been added.', time: 'منذ يومين', timeEn: '2d ago', read: true, type: 'info' },
  { id: 'n5', title: 'حسابك غير مكتمل', titleEn: 'Incomplete Profile', body: 'أكمل بيانات حسابك لتفعيل كل الميزات.', bodyEn: 'Complete your teacher profile to unlock all features.', time: 'منذ 3 أيام', timeEn: '3d ago', read: true, type: 'info' },
];
