const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface OcrResult {
  extracted_text: string;
  suggested_tags: string[];
}

export async function uploadAndOcr(
  file: File,
  token: string | null,
): Promise<OcrResult> {
  const authHeader: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const presignRes = await fetch(`${API_URL}/api/v1/captures/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ filename: file.name, content_type: file.type }),
  });
  if (!presignRes.ok)
    throw new Error(`Presign failed: HTTP ${presignRes.status}`);
  const { upload_url, object_key } = (await presignRes.json()) as {
    upload_url: string;
    object_key: string;
  };

  const s3Res = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!s3Res.ok) throw new Error(`S3 upload failed: HTTP ${s3Res.status}`);

  const ocrRes = await fetch(`${API_URL}/api/v1/captures/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ media_key: object_key, content_type: file.type }),
  });
  if (!ocrRes.ok) throw new Error(`OCR failed: HTTP ${ocrRes.status}`);

  return (await ocrRes.json()) as OcrResult;
}
