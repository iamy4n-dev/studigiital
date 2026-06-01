from unittest.mock import MagicMock, patch

from app.core.config import settings
from app.core.s3 import download_s3_object, generate_presigned_put_url


def test_generate_presigned_put_url_calls_boto3_correctly():
    with patch("app.core.s3.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_client.generate_presigned_url.return_value = (
            "https://s3.amazonaws.com/studigiital-media/key?X-Amz-Signature=abc"
        )

        url = generate_presigned_put_url("captures/user1/abc/photo.jpg", "image/jpeg")

    assert url.startswith("https://")
    mock_client.generate_presigned_url.assert_called_once_with(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": "captures/user1/abc/photo.jpg",
            "ContentType": "image/jpeg",
        },
        ExpiresIn=300,
    )


def test_generate_presigned_put_url_custom_expiry():
    with patch("app.core.s3.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_client.generate_presigned_url.return_value = "https://example.com/url"

        generate_presigned_put_url("key", "image/png", expires=60)

    _, kwargs = mock_client.generate_presigned_url.call_args
    assert kwargs["ExpiresIn"] == 60


def test_download_s3_object_returns_bytes() -> None:
    with patch("app.core.s3.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_body = MagicMock()
        mock_body.read.return_value = b"\xff\xd8\xff"
        mock_client.get_object.return_value = {"Body": mock_body}

        result = download_s3_object("captures/user1/abc/photo.jpg")

    assert result == b"\xff\xd8\xff"
    mock_client.get_object.assert_called_once_with(
        Bucket=settings.s3_bucket,
        Key="captures/user1/abc/photo.jpg",
    )
