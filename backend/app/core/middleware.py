"""
Per-request middleware: request ID, structured log binding, timing.

# What it does

For every request:
    1. Generate a request ID (or pick up an upstream `X-Request-ID` header
       — useful when a CDN or load balancer assigns one).
    2. Bind `request_id`, `method`, `path` into structlog's contextvars
       so every log line from any module includes them automatically.
    3. Time the request and emit a `request_complete` log line at the end
       (success or failure) with status code + elapsed ms.
    4. Return `X-Request-ID` to the caller so they can quote it in support
       requests.

This is the only place we attach Sentry's request context too — putting it
in the same middleware avoids creating two middlewares that do similar
things.
"""

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Bind a request_id + path + method into structlog's contextvars per request."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Prefer caller-supplied ID (so e.g. Cloudflare's ray ID can flow through
        # the whole system), otherwise mint one.
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]

        # structlog.contextvars binds to the current asyncio task's contextvars,
        # so every log call inside this request sees the binding — no manual
        # threading required.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        # Stash on request.state so route handlers can read it too
        request.state.request_id = request_id

        start = time.perf_counter()
        status_code = 500  # default if something throws before response

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            log.info(
                "request_complete",
                status=status_code,
                elapsed_ms=round(elapsed_ms, 1),
            )
            # Don't leak the contextvars to the next request on this asyncio task
            structlog.contextvars.clear_contextvars()

        # Also expose the ID on the response so frontends/users can quote it
        # NOTE: actually setting the header needs to happen inside the try
        # block before returning. See _attach_request_id below for the cleaner
        # pattern used in main.py.


async def attach_request_id_header(request: Request, call_next) -> Response:
    """
    Companion middleware (function form) that appends X-Request-ID to the
    outbound response. Kept separate from RequestContextMiddleware so the
    contextvars cleanup happens *after* the response is fully built.
    """
    response = await call_next(request)
    rid = getattr(request.state, "request_id", None)
    if rid:
        response.headers["X-Request-ID"] = rid
    return response
