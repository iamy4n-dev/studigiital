from __future__ import annotations

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from app.core.config import settings


def download_s3_object(object_key: str) -> bytes:
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        config=Config(signature_version="s3v4"),
    )
    response = client.get_object(Bucket=settings.s3_bucket, Key=object_key)
    body: bytes = response["Body"].read()
    return body


def generate_presigned_put_url(
    object_key: str,
    content_type: str,
    expires: int = 300,
) -> str:
    client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        config=Config(signature_version="s3v4"),
    )
    return str(
        client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires,
        )
    )
