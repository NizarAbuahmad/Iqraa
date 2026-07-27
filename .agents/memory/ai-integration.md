---
name: AI Integration Architecture
description: How real AI is wired in — API server routes, mobile RemoteAIService, RAG flow for iQra, fallback strategy.
---

# AI Integration Architecture

## API Server endpoints (artifacts/api-server)
- `POST /api/chat` — iQra chat; accepts `{ messages, context, mode, language }`, returns `{ content }` JSON (non-streaming for RN compatibility). Grounds answer with KB context from mobile.
- `POST /api/generate/lesson-plan` — returns `LessonPlanOutput` JSON
- `POST /api/generate/worksheet` — returns `WorksheetOutput` JSON
- `POST /api/generate/quiz` — returns `QuizOutput` JSON
- `POST /api/generate/homework` — returns `WorksheetOutput` JSON
- All use `gpt-5.6-luna` via `@workspace/integrations-openai-ai-server` (Replit AI proxy)
- Route files: `artifacts/api-server/src/routes/chat.ts`, `artifacts/api-server/src/routes/generate.ts`

**Why non-streaming for chat:** React Native has no native EventSource/SSE; a plain `fetch` + JSON response is simpler and avoids a polyfill. Latency is acceptable with the thinking indicator already in place.

## Mobile RemoteAIService (artifacts/mobile/services/ai/RemoteAIService.ts)
- Calls `https://${EXPO_PUBLIC_DOMAIN}/api/...` (env var set in Expo workflow)
- Falls back to `MockAIService` (from generators.ts) automatically if any network call fails
- Exported as `remoteAIService` singleton
- All AI tool screens (lesson-plan, worksheet, quiz) import `remoteAIService as aiService` from RemoteAIService.ts

## iQra RAG flow (artifacts/mobile/app/(tabs)/iqra.tsx)
1. Local KB search (`searchKB`) retrieves relevant lessons → grounding context string
2. `remoteAIService.chat({ messages, context, mode, language })` sends to API
3. Fallback: if server unreachable, renders `buildResponse()` (local KB formatter) instead
4. Conversation history (last 10 messages) is sent for multi-turn context

## API base URL resolution
- `EXPO_PUBLIC_DOMAIN` = Replit dev domain (set in mobile workflow env)
- API server previewPath = `/api`, localPort = 8080
- From mobile: `https://${EXPO_PUBLIC_DOMAIN}/api/{route}`

## Metro config fix
- `artifacts/mobile/metro.config.js` blocks `/node_modules/.*_tmp_\d+/.*/` and `/node_modules/openai_tmp.*/` — prevents crash when openai package creates ephemeral tmp dirs during pnpm install
