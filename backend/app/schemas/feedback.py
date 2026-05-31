"""Request/response schemas for the feedback endpoint."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class FeedbackCreateRequest(BaseModel):
    """
    A demo visitor's reaction. Everything is optional individually, but the
    submission must carry *something* — a rating, a message, or both. We reject
    empty submissions so the table stays signal, not accidental button clicks.
    """

    email: str | None = Field(None, max_length=320)
    name: str | None = Field(None, max_length=200)
    rating: int | None = Field(None, ge=1, le=5)
    message: str | None = Field(None, max_length=5000)
    job_id: UUID | None = None
    clip_id: UUID | None = None
    context: dict | None = None

    @model_validator(mode="after")
    def _require_content(self) -> "FeedbackCreateRequest":
        if self.rating is None and not (self.message and self.message.strip()):
            raise ValueError("Provide a rating, a message, or both.")
        return self


class FeedbackResponse(BaseModel):
    id: UUID
    rating: int | None
    message: str | None
    email: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
