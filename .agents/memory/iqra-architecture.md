---
name: Iqra App Architecture
description: Key decisions and structure for the Iqra AI Teaching Assistant mobile app
---

# Iqra App Architecture

## Knowledge Base
- Location: `artifacts/mobile/services/knowledgeBase.ts`
- Content sourced from 2 uploaded PDFs (Grade 10 Chemistry Semester 1, Math Semester 1)
- Structure: `KB_BOOKS → KB_UNITS → KB_LESSONS` (each lesson has summaryAr/En, keyConceptsAr/En, keyTerms, rulesAr/En, examplesAr/En)
- Search: `searchKB(query, lang)` — keyword scoring, returns ranked `KBLesson[]`
- To add new books: append to `KB_BOOKS`, `KB_UNITS`, `KB_LESSONS` in knowledgeBase.ts
- `hasKnowledgeBase: true` on Book records in curriculumData.ts signals PDF-sourced content

**Why:** iQra answers ONLY from uploaded books — no external AI/web lookup.

## i18n / Bilingual
- `artifacts/mobile/services/i18n.ts` — all Arabic/English strings, typed `TranslationKey`
- `artifacts/mobile/context/LanguageContext.tsx` — `LanguageProvider`, `useLanguage()` hook
- Default language: Arabic (`ar`); stored in AsyncStorage key `@iqra_language`
- RTL: managed per-component via `textAlign: isRTL ? 'right' : 'left'` and `writingDirection`; NOT via `I18nManager.forceRTL` (would need app restart)
- Language toggle: `toggleLang()` from `useLanguage()` — persists immediately without restart

**Why:** I18nManager full RTL requires reload; per-component RTL works in web preview.

## Tabs
- 5 tabs: Home (index), Curriculum, iQra (iqra), Notifications, Profile
- AI Tools tab (`ai-tools.tsx`) is HIDDEN from tab bar but still routable — accessed from dashboard quick actions
- Tab layout: `app/(tabs)/_layout.tsx` — ClassicTabLayout (Ionicons) + NativeTabLayout (SF Symbols/LiquidGlass iOS 26+)

**Why:** iQra chat replaces AI Tools as the primary AI interaction surface.

## iQra Chat
- `artifacts/mobile/app/(tabs)/iqra.tsx`
- Teacher/Student mode toggle (affects suggested questions)
- Sends query → `searchKB()` → `buildResponse()` → formatted chat bubble
- Response cites book title, unit, key concepts, terms, rules, examples
- Mock 900-1500ms delay simulates AI processing

## Curriculum Data
- `artifacts/mobile/services/curriculumData.ts`
- All interfaces now have both English and Arabic fields (nameAr, titleAr, descriptionAr, etc.)
- Grade 10 Chemistry + Math books have real units/lessons from the PDFs
- `getBooksForSubjectGrade(subjectId, gradeId)` helper added

## LanguageProvider placement
- Wraps `AuthProvider` in `app/_layout.tsx`
- Order: `LanguageProvider > AuthProvider > GestureHandlerRootView > KeyboardProvider`
