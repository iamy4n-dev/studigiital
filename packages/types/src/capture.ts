export type CaptureMode = "photo" | "quick_text" | "backlog";

export type CaptureStatus =
  | "pending"
  | "queued"
  | "processing"
  | "ready"
  | "offline"
  | "failed";

export interface Capture {
  id: string;
  userId: string;
  mode: CaptureMode;
  status: CaptureStatus;
  rawContent: string | null;
  mediaKey: string | null;
  createdAt: string;
  updatedAt: string;
}
