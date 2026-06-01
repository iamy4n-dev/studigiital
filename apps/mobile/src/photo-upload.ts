const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export interface PhotoUploadResult {
  capture_id: string;
}

export async function uploadPhoto(
  token: string,
  uri: string,
  filename: string,
  contentType = "image/jpeg",
): Promise<PhotoUploadResult> {
  const urlRes = await fetch(`${API_URL}/api/v1/captures/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!urlRes.ok) {
    throw new Error(`Presign request failed: HTTP ${urlRes.status}`);
  }
  const { upload_url, object_key } = (await urlRes.json()) as {
    upload_url: string;
    object_key: string;
  };

  const photoRes = await fetch(uri);
  const blob = await photoRes.blob();
  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!s3Res.ok) {
    throw new Error(`S3 upload failed: HTTP ${s3Res.status}`);
  }

  const captureRes = await fetch(`${API_URL}/api/v1/captures/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode: "photo", media_key: object_key }),
  });
  if (!captureRes.ok) {
    throw new Error(`Create capture failed: HTTP ${captureRes.status}`);
  }
  const capture = (await captureRes.json()) as { id: string };
  return { capture_id: capture.id };
}
