"""
Cloudflare R2 client.

R2 is S3-compatible, so we use boto3 with a custom endpoint. The critical
feature is presigned PUT URLs: the browser uploads the 4GB video directly
to R2, our API never sees the bytes. This is the only way to handle large
uploads on a serverless or memory-constrained backend.
"""

from datetime import datetime, timezone
from uuid import uuid4

import boto3
from botocore.client import Config

from app.core.config import get_settings

_settings = get_settings()


def _r2_client():
    """Build a boto3 S3 client pointed at the R2 endpoint."""
    return boto3.client(
        "s3",
        endpoint_url=_settings.r2_endpoint,
        aws_access_key_id=_settings.r2_access_key_id,
        aws_secret_access_key=_settings.r2_secret_access_key,
        region_name="auto",  # R2 doesn't use real regions
        config=Config(signature_version="s3v4"),
    )


# Public alias — modules outside this file should use this name.
def r2_client():
    return _r2_client()


def build_upload_key(org_id: str, filename: str) -> str:
    """
    Generate the R2 object key for a new upload.

    Format: uploads/<org_id>/<YYYY-MM-DD>/<uuid>-<filename>
    The date prefix keeps prefix-listing efficient and makes lifecycle
    policies easy (e.g. "delete raw uploads >30 days old").
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    safe_name = filename.replace("/", "_").replace("\\", "_")[:200]
    return f"uploads/{org_id}/{today}/{uuid4()}-{safe_name}"


def presign_upload_url(
    key: str,
    content_type: str,
    expires_in: int = 3600,
) -> str:
    """
    Return a presigned PUT URL. The browser does:

        fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': ct } })

    The signed Content-Type must match what the client sends, otherwise R2
    rejects the upload — so we lock it in here and the frontend must echo it.
    """
    client = _r2_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": _settings.r2_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )


def presign_download_url(key: str, expires_in: int = 3600) -> str:
    """Presigned GET for rendered clips. Used by the Export button in Phase 4."""
    client = _r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": _settings.r2_bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def head_object(key: str) -> dict | None:
    """Check that an upload actually landed in R2. Returns metadata or None."""
    client = _r2_client()
    try:
        return client.head_object(Bucket=_settings.r2_bucket, Key=key)
    except client.exceptions.ClientError:
        return None


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload an in-memory blob to R2. Used for transcripts, rendered clips, etc."""
    _r2_client().put_object(
        Bucket=_settings.r2_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def list_objects(prefix: str, max_keys: int = 1000):
    """
    List objects under a prefix. Generator so we don't materialize huge
    lists in memory.

    Yields dicts with keys: Key, LastModified, Size, ETag.
    """
    client = _r2_client()
    continuation = None
    while True:
        kwargs = {
            "Bucket": _settings.r2_bucket,
            "Prefix": prefix,
            "MaxKeys": max_keys,
        }
        if continuation:
            kwargs["ContinuationToken"] = continuation
        resp = client.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            yield obj
        if not resp.get("IsTruncated"):
            break
        continuation = resp.get("NextContinuationToken")


def delete_object(key: str) -> None:
    """Delete a single object. Idempotent — R2 returns success even if absent."""
    _r2_client().delete_object(Bucket=_settings.r2_bucket, Key=key)


def delete_objects(keys: list[str]) -> int:
    """
    Batch delete up to 1000 keys per call. Returns count of keys deleted.
    R2 supports the S3 DeleteObjects API.
    """
    if not keys:
        return 0
    client = _r2_client()
    # S3 DeleteObjects caps at 1000 per request — caller should chunk if needed
    deleted = 0
    for i in range(0, len(keys), 1000):
        batch = keys[i:i + 1000]
        resp = client.delete_objects(
            Bucket=_settings.r2_bucket,
            Delete={"Objects": [{"Key": k} for k in batch], "Quiet": True},
        )
        # Quiet mode: only errors come back. Successes are silent.
        errors = resp.get("Errors", [])
        deleted += len(batch) - len(errors)
    return deleted
