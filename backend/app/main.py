"""
Clipper.ai API entrypoint.

Mounts:
    /health, /health/ready
    /v1/uploads/presign
    /v1/jobs, /v1/jobs/{id}
    /v1/billing/{checkout,portal,webhook}
    /v1/usage
    /api/inngest                (Inngest function registration)
"""

import logging

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import billing, feedback, health, jobs, uploads
from app.api.inngest_webhook import register_inngest
from app.core.config import get_settings
from app.core.middleware import RequestContextMiddleware, attach_request_id_header
from app.schemas.errors import ErrorDetail, ErrorResponse

settings = get_settings()

# ──────────────────────────────────────────────────────────── LOGGING

logging.basicConfig(level=settings.log_level)
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer() if not settings.is_dev else structlog.dev.ConsoleRenderer(),
    ],
)

log = structlog.get_logger()


# ──────────────────────────────────────────────────────────── SENTRY (optional)

if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            # Don't send PII (email, IP) to Sentry — we have logs for that
            send_default_pii=False,
        )
        log.info("sentry_initialized", env=settings.sentry_environment)
    except ImportError:
        log.warning("sentry_dsn_set_but_sdk_missing — pip install sentry-sdk[fastapi]")


# ──────────────────────────────────────────────────────────── APP

app = FastAPI(
    title="Clipper.ai API",
    version="0.6.0-hardening",
    description=(
        "Clip-from-podcast SaaS backend. Phases 1-5 complete (full pipeline + "
        "auth + billing) + hardening pass (request IDs, structured errors, "
        "rate limiting, idempotency, job cancellation, webhook dedupe)."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    # Expose X-Request-ID so the frontend can read it from successful responses
    expose_headers=["X-Request-ID"],
)

# Middleware order matters: outer-to-inner is the order they're added.
# RequestContextMiddleware first → its contextvars bind survives through the
# whole request, including the response-attachment middleware below.
app.add_middleware(RequestContextMiddleware)
app.middleware("http")(attach_request_id_header)


# ──────────────────────────────────────────────────────────── ERROR HANDLERS

def _envelope(code: str, message: str, request: Request, details: dict | None = None) -> JSONResponse:
    """Build the standard error envelope. Pulls request_id off request.state."""
    request_id = getattr(request.state, "request_id", None)
    payload = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            request_id=request_id,
            details=details,
        )
    )
    return payload


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Normalize FastAPI's HTTPException into our standard envelope.

    Special case: if `detail` is already a dict with an `error` key (e.g. the
    quota-exceeded 402 from /v1/jobs), we use it as the details payload and
    promote `error` to the code field.
    """
    code = "http_error"
    message = "Request failed"
    details: dict | None = None

    if isinstance(exc.detail, dict):
        if "error" in exc.detail:
            code = exc.detail["error"]
            message = exc.detail.get("message", "Request failed")
            details = {k: v for k, v in exc.detail.items() if k not in ("error", "message")}
        else:
            details = exc.detail
            message = "Request failed"
    elif isinstance(exc.detail, str):
        message = exc.detail
        # Derive a code from common status codes
        code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            415: "unsupported_media_type",
            422: "validation_error",
            429: "rate_limited",
        }.get(exc.status_code, "http_error")

    payload = _envelope(code, message, request, details)
    return JSONResponse(
        status_code=exc.status_code,
        content=payload.model_dump(exclude_none=True),
        headers=exc.headers or None,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic validation errors → standard envelope with the field details."""
    payload = _envelope(
        code="validation_error",
        message="Request body failed validation",
        request=request,
        details={"errors": exc.errors()},
    )
    return JSONResponse(status_code=422, content=payload.model_dump(exclude_none=True))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Last-resort catch-all. Logs full exception, returns a generic 500.

    Don't leak the exception type or stack to the client — that's a security
    leak. The request_id in the response lets support look it up.
    """
    log.exception("unhandled_exception", path=request.url.path, method=request.method)
    payload = _envelope(
        code="internal_error",
        message="An internal error occurred. Reference the request_id for support.",
        request=request,
    )
    return JSONResponse(status_code=500, content=payload.model_dump(exclude_none=True))


# ──────────────────────────────────────────────────────────── ROUTES

app.include_router(health.router)
app.include_router(uploads.router)
app.include_router(jobs.router)
app.include_router(billing.router)
app.include_router(feedback.router)

# Inngest serve handler at /api/inngest
register_inngest(app)


@app.get("/")
async def root():
    return {
        "service": "clipper-api",
        "version": app.version,
        "docs": "/docs",
    }
