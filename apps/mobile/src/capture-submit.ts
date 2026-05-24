import type { TransformResponse } from "@studigiital/api-client";
import { enqueue } from "./capture-queue";

export type SubmitResult =
  | { status: "success"; result: TransformResponse }
  | { status: "queued" }
  | { status: "error"; message: string };

export async function submitCapture(
  text: string,
  mode: string,
  tier: "free" | "paid",
  isOnline: boolean
): Promise<SubmitResult> {
  if (!isOnline) {
    await enqueue(text, mode);
    return { status: "queued" };
  }
  try {
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/v1/captures/transform`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tier }),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json()) as TransformResponse;
    return { status: "success", result };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "unknown" };
  }
}
