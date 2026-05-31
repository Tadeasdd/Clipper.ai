"""Schemas for the presigned upload flow."""

from pydantic import BaseModel, Field


# Accepted video MIME types — matches the .mp4/.mov/.webm promise on the landing page.
ALLOWED_CONTENT_TYPES = {
    "video/mp4",
    "video/quicktime",  # .mov
    "video/webm",
    "video/x-matroska",  # .mkv (allow but not advertised)
}

# 4GB max — matches "Up to 4GB" copy in the Studio upload zone.
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024


class PresignRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=500)
    content_type: str = Field(..., min_length=1, max_length=100)
    size_bytes: int = Field(..., gt=0, le=MAX_UPLOAD_BYTES)


class PresignResponse(BaseModel):
    upload_url: str
    r2_key: str
    expires_in_seconds: int
