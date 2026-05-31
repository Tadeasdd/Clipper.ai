"""
Standard error response envelope.

Every 4xx and 5xx from this API returns a consistent JSON shape:

    {
        "error": {
            "code": "quota_exceeded",
            "message": "...human readable...",
            "request_id": "abc123",
            "details": { ... optional extra context ... }
        }
    }

The frontend can switch on `error.code` instead of parsing `message`.
"""

from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Stable machine-readable code")
    message: str = Field(..., description="Human-readable description")
    request_id: str | None = Field(None, description="For support / log lookup")
    details: dict[str, Any] | None = Field(None, description="Optional extra context")


class ErrorResponse(BaseModel):
    error: ErrorDetail
