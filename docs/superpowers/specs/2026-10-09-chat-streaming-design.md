# Chat streaming with cancel — design

**Problem.** `POST /chat` returns one JSON body after the whole completion
is generated. The client (`artifacts/mobile/app/(tabs)/iqra.tsx`) shows
«إقرأ يكتب…» for the full wait — up to 45 s — and offers no way to stop.
A 1200-token Arabic answer takes 15–25 s before a single word appears, and
the teacher's only recourse is to wait or background the app. The chat is the
one AI path that is never served from the shared pool, so every turn pays
this latency live.

**What changes.**

1. The API streams the reply as Server-Sent Events when the client asks for
   it with `Accept: text/event-stream`. Clients that do not ask get the
   JSON body they get today — old OTA bundles and binaries keep working
   through the deploy window (the API ships before the web bundle; native
   binaries lag by days).
2. The client renders the reply as it arrives, in the assistant bubble, and
   shows a **Stop** button in the composer while a remote reply is in
   flight. Stop keeps whatever text arrived; a stop before any text removes
   the bubble and puts the question back in the box.
3. When the client disconnects, the server aborts the upstream OpenAI
   stream and records what was spent. If the usage chunk never arrived, the
   spend is **estimated** (over, never under) so the shared budget guard
   stays honest.

**Protocol.** One `data:` line per event, JSON-encoded:

| event | shape | when |
| --- | --- | --- |
| delta | `{"type":"delta","text":"…"}` | each model chunk with content |
| done | `{"type":"done","content":"<full reply>"}` | the model finished; `content` is authoritative |
| error | `{"type":"error","code":"stream_failed","message":"…"}` | failure after headers were sent |

Pre-flight refusals (`live_mode_off`, `user_quota_exceeded`,
`budget_exceeded`, bad body) are still plain JSON with their status codes:
they are decided before any header is sent, so the client's existing
`isCapError` / `aiErrorMessageKey` mapping keeps working unchanged.

**Out of scope.** The demo-mode (local) path is untouched — production web
still ships `DEMO_MODE` on, so streaming reaches native builds, OTA
updates, and any build with `EXPO_PUBLIC_DEMO_MODE=false`. The generators'
JSON responses are not streamed. The list's scroll-to-end on every content
change is left as is (it follows the growing bubble, which is the wanted
behaviour while streaming; the scroll-up yank is a separate fix).

**Why `expo/fetch`.** React Native's built-in `fetch` is XHR-backed and
exposes no `body` stream. Expo SDK 52+ ships `expo/fetch`, a WinterCG fetch
whose `Response.body` is a readable stream on iOS, Android and web (on web
it is the browser's fetch). The project is on Expo SDK 54.

**Why not the generators.** They return structured JSON the screens edit;
a partial JSON object is not renderable. Chat is prose, read top to bottom.
