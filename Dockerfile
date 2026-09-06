# Builds and runs iqraa-api for Cloud Run. Build context must be the repo
# ROOT (not artifacts/api-server) — the build copies a data directory out of
# lib/curriculum (see build.mjs) and pnpm needs the workspace manifests.
#
#   gcloud run deploy iqraa-api --source . --region europe-west1 \
#     --allow-unauthenticated --port 8080
#
# ponytail: one stage, not build+runtime split. The startCommand below runs
# `pnpm --filter @workspace/db run seed:assessment` on every boot (same as
# Render, see render.yaml's comment on why), which needs the workspace's
# installed deps present at runtime anyway — so there is nothing left to
# discard by splitting stages. Revisit only if image size becomes a real
# problem (it affects cold-start pull time, not per-request billing).
FROM node:24.15.0-slim

WORKDIR /app
COPY . .

# Mirrors render.yaml's buildCommand exactly — same pnpm version, same
# --filter (installs @workspace/api-server plus its workspace deps: db,
# curriculum, math-verify, api-zod, integrations-openai-ai-server — not the
# unrelated Expo/mobile tree).
RUN corepack enable \
  && corepack prepare pnpm@11.18.0 --activate \
  && pnpm install --frozen-lockfile --filter @workspace/api-server... \
  && pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
# Cloud Run injects PORT itself; src/index.ts reads it directly and throws
# if it's missing — nothing to set here.

# Mirrors render.yaml's startCommand exactly: seed runs before every boot,
# idempotent, matches on natural keys (see that file's comment on why this
# runs here and not once by hand).
CMD ["sh", "-c", "pnpm --filter @workspace/db run seed:assessment && pnpm --filter @workspace/api-server run start"]
