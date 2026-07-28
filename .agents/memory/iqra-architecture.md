---
name: Iqra App Architecture
description: Knowledge base, i18n, tabs, iQra chat, curriculum data structure and key decisions; now includes Interactive Classroom Engine
---

## Routing
- Tabs: `(tabs)/index`, `(tabs)/iqra`, `(tabs)/ai-tools`, `(tabs)/workspace`
- AI tools nested under `/ai-tools/` (lesson-plan, worksheet, quiz, activity)
- Classroom engine nested under `/ai-tools/classroom/` with its own `_layout.tsx` (Stack, headerShown:false)
  - `index.tsx` — activity hub (activity type picker)
  - `builder.tsx` — configure + generate activity
  - `presentation.tsx` — full-screen dark presentation mode

## Classroom Engine (Task #38)
- Color: `#4F46E5` (indigo)
- Schema: `ClassroomActivity` + `ActivitySlide` + `TeacherCompanion` + `ClassroomActivityRequest` in `AIService.ts`
- `classroomStore.ts` — module-level singleton to pass activity from builder → presentation (avoids URL param length limits)
- Mock data: full Math Escape Challenge (Quadratic Equations, 12 slides, 5 challenges) in `generators.ts`
- API route: `POST /generate/classroom-activity` in `generate.ts`
- Presentation mode: full-screen dark (`#0D0D14`), animated timer bar, hint/answer reveal, teacher companion bottom panel, fade slide transitions
- Printables: not yet wired to PDF export (follow-up task #39)
- Activity types: only `escape-challenge` active; bingo/relay/exit-ticket cards show "Coming Soon"

## Knowledge Base
- `services/knowledgeBase.ts` — `searchKB`, `getLessonById`, `buildResponse`
- Lesson IDs: `kbl-chem-1-1` format
- Curriculum IDs: `lesson-chem-1` format (from `curriculumData.ts`)
- `services/kbContext.ts` — `buildGeneratorContext(topic, lang)` for injecting KB text into generator prompts

## AI Services
- `AIService.ts` — abstract base class with all abstract methods
- `generators.ts` (MockAIService) — full mocks for all generators
- `RemoteAIService.ts` — calls API server, falls back to mock on error

## i18n
- `services/i18n.ts` — AR + EN translation dictionaries
- Keys use camelCase; function-valued keys for plurals (e.g. `slideCount: (n) => ...`)
- All classroom engine keys added under `toolClassroomTitle`, `classroomHubTitle`, `startPresentation`, etc.

## Key Decisions
- Slides export = PDF via expo-print (HTML → PDF), NOT PPTX
- `buildActivityHTML` and slide builders are self-contained (don't call `htmlBase`)
- TopicSelector component in `components/ui/TopicSelector.tsx` — takes `subjectId`, `gradeId`, `value`, `onChange`, `lang`, `isRTL`, `colors`, `accent`, `hasError`, `t`
- Activity chip in iQra only shows in teacher mode
- Presentation screen uses `useFocusEffect` from `expo-router` (NOT `@react-navigation/native`)
- Timer: `useRef` interval + plain state, not Animated.Value
