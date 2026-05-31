"""Request/response schemas for job endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    """Frontend submits this after the video has been PUT to R2."""

    source_filename: str = Field(..., min_length=1, max_length=500)
    source_r2_key: str = Field(..., min_length=1, max_length=500)
    source_size_bytes: int | None = Field(None, ge=0)


class ClipResponse(BaseModel):
    """Shape consumed by the results view in the frontend."""

    id: UUID
    title: str
    hook: str
    duration_seconds: float
    start_seconds: float
    end_seconds: float
    virality_score: int | None
    engagement: dict | None  # { hook, retention, shareability }
    reasons: list[str] | None
    platforms: list[str] | None
    rendered_urls: dict[str, str] | None  # aspect -> presigned download URL

    model_config = {"from_attributes": True}


class JobResponse(BaseModel):
    """Returned by POST /v1/jobs and GET /v1/jobs/{id}."""

    id: UUID
    status: str
    progress_pct: int
    source_filename: str
    error_message: str | None
    clips: list[ClipResponse] = Field(default_factory=list)
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    """
    Cursor-paginated list response. `next_cursor` is opaque — callers should
    pass it back unmodified on the next request. When null, no more pages.
    """

    items: list[JobResponse]
    next_cursor: str | None = None
