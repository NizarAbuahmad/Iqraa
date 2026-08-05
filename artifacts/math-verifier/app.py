"""
Math verifier microservice — Grade 10 derivative vertical slice.

POST /verify/derivative
  { "question", "answer", "topic"?, "distractors"? }
→ { "verified", "computed_answer", "error"?, "rejected"? }

Latin symbols only (x). Never send Arabic notation here.
Uses ProcessPoolExecutor so a 2s timeout can terminate the worker.
"""
from __future__ import annotations

import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from verify_core import compute_derivative as compute_sync
from verify_core import verify_item as verify_item_sync

VERIFY_TIMEOUT_SEC = 2.0
DEFAULT_TOPIC = "derivative_polynomial"

app = FastAPI(title="Iqraa Math Verifier", version="0.2.0")


class VerifyRequest(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    topic: str | None = None
    distractors: list[dict[str, Any]] | None = None


class VerifyResponse(BaseModel):
    verified: bool
    computed_answer: str | None = None
    error: str | None = None
    rejected: list[dict[str, str]] | None = None


def _verify_worker(
    payload: tuple[str, str, str, list[dict[str, Any]] | None],
) -> dict[str, Any]:
    topic, question, answer, distractors = payload
    return verify_item_sync(topic, question, answer, distractors)


def _compute_worker(question: str) -> dict[str, Any]:
    return compute_sync(question)


_executor: ProcessPoolExecutor | None = None


def get_executor() -> ProcessPoolExecutor:
    global _executor
    if _executor is None:
        ctx = mp.get_context("spawn")
        _executor = ProcessPoolExecutor(max_workers=1, mp_context=ctx)
    return _executor


def _terminate_executor() -> None:
    """Kill worker processes so a timed-out SymPy job cannot keep running."""
    global _executor
    old = _executor
    _executor = None
    if old is None:
        return
    processes = getattr(old, "_processes", None) or {}
    for proc in list(processes.values()):
        try:
            if proc.is_alive():
                proc.terminate()
        except Exception:  # noqa: BLE001
            pass
    try:
        old.shutdown(wait=False, cancel_futures=True)
    except Exception:  # noqa: BLE001
        pass


@app.on_event("startup")
def _warmup() -> None:
    get_executor().submit(
        _verify_worker,
        (DEFAULT_TOPIC, "x**2", "2*x", None),
    ).result(timeout=10)


@app.on_event("shutdown")
def _shutdown() -> None:
    _terminate_executor()


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    from verify_core import SOLVERS

    return {"status": "ok", "topics": sorted(SOLVERS.keys())}


@app.post("/verify/derivative", response_model=VerifyResponse)
def verify_derivative(body: VerifyRequest) -> VerifyResponse:
    topic = body.topic or DEFAULT_TOPIC
    fut = get_executor().submit(
        _verify_worker,
        (topic, body.question, body.answer, body.distractors),
    )
    try:
        result = fut.result(timeout=VERIFY_TIMEOUT_SEC)
    except FuturesTimeout:
        fut.cancel()
        _terminate_executor()
        return VerifyResponse(
            verified=False,
            computed_answer=None,
            error="timeout",
            rejected=None,
        )

    return VerifyResponse(
        verified=bool(result.get("verified")),
        computed_answer=result.get("computed_answer"),
        error=result.get("error"),
        rejected=result.get("rejected") or None,
    )


@app.post("/compute/derivative")
def compute_derivative(body: dict[str, str]) -> dict[str, Any]:
    question = body.get("question", "").strip()
    if not question:
        return {"ok": False, "error": "missing_question"}
    fut = get_executor().submit(_compute_worker, question)
    try:
        result = fut.result(timeout=VERIFY_TIMEOUT_SEC)
    except FuturesTimeout:
        fut.cancel()
        _terminate_executor()
        return {"ok": False, "error": "timeout"}
    if not result.get("ok"):
        return {"ok": False, "error": result.get("error")}
    return {"ok": True, "computed_answer": result["computed_answer"]}
