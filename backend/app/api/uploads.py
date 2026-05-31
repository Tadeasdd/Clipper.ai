"""
Presigned upload endpoint.

Flow:
    1. Frontend POSTs { filename, content_type, size_bytes } with Clerk JWT
    2. We validate the content type and size, generate an R2 key namespaced
       to the authenticated org, sign a PUT URL
    3. Frontend uploads bytes direct to R2 with PUT
    4. Frontend then POSTs /v1/jobs with the r2_key to kick off processing
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user_and_org
from app.core.r2 import build_upload_key, presign_upload_url
from app.core.rate_limit import enforce_rate_limit
from app.schemas.uploads import ALLOWED_CONTENT_TYPES, PresignRequest, PresignResponse

router = APIRouter(prefix="/v1/uploads", tags=["uploads"])


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(
    req: PresignRequest,
    auth: tuple = Depends(get_current_user_and_org),
):
    _, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "expensive")

    if req.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content_type. Allowed: {sorted(ALLOWED_CONTENT_TYPES)}",
        )

    key = build_upload_key(str(org.id), req.filename)
    expires_in = 3600  # 1 hour to PUT — generous for a 4GB upload on slow connections
    url = presign_upload_url(key, req.content_type, expires_in=expires_in)

    return PresignResponse(upload_url=url, r2_key=key, expires_in_seconds=expires_in)
