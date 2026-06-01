import type { OcrResponse } from "@studigiital/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function uploadAndOcr(
  file: File,
  token: string | null,
): Promise<OcrResponse> {
  if (!token) throw new Error("uploadAndOcr: auth token is required");

  const authHeader = { Authorization: `Bearer ${token}` };

  const contentType = file.type || "image/jpeg";

  const presignRes = await fetch(`${API_URL}/api/v1/captures/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ filename: file.name, content_type: contentType }),
  });
  if (!presignRes.ok)
    throw new Error(`Presign failed: HTTP ${presignRes.status}`);
  const presignBody = (await presignRes.json()) as {
    upload_url?: string;
    object_key?: string;
  };
  if (!presignBody.upload_url || !presignBody.object_key) {
    throw new Error("Presign response missing upload_url or object_key");
  }
  const { upload_url, object_key } = presignBody;

  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!s3Res.ok) throw new Error(`S3 upload failed: HTTP ${s3Res.status}`);

  const ocrRes = await fetch(`${API_URL}/api/v1/captures/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ media_key: object_key, content_type: contentType }),
  });
  if (!ocrRes.ok) throw new Error(`OCR failed: HTTP ${ocrRes.status}`);

  return (await ocrRes.json()) as OcrResponse;
}
