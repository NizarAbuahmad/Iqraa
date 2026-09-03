# Builds and runs iqraa-verifier for Cloud Run. Build context is this
# directory (matches render.yaml's rootDir: artifacts/math-verifier) — the
# service has no dependency on the rest of the monorepo.
#
#   gcloud run deploy iqraa-verifier --source artifacts/math-verifier \
#     --region europe-west1 --allow-unauthenticated --port 8080
#
# This is the one worth timing: Render's free tier took 51s to wake this
# service from sleep, well past the API's 2.5s verify timeout. Cloud Run's
# cold start should be seconds, not a minute — but SymPy's import is heavier
# than average, and nothing here has actually measured it yet.
FROM python:3.12.13-slim

WORKDIR /app
COPY requirements.txt .
# --retries/--timeout: a Render build once failed on a PyPI 502, not a real
# break — see render.yaml's comment on the same flags.
RUN pip install --retries 10 --timeout 30 --no-cache-dir -r requirements.txt

COPY . .

# Same command Render runs (render.yaml startCommand): single worker, since
# the service forks a ProcessPoolExecutor per request so a runaway SymPy job
# can be killed on timeout. Shell form so $PORT expands — Cloud Run injects
# it the same way Render does.
CMD sh -c "uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1"
