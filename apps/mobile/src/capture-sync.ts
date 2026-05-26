import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { getByStatus, updateStatus } from "./capture-queue";

const SYNC_TASK = "CAPTURE_QUEUE_SYNC";

TaskManager.defineTask(SYNC_TASK, async () => {
  await drainQueue("free");
  return BackgroundTask.BackgroundTaskResult.Success;
});

export async function drainQueue(tier: "free" | "paid" = "free"): Promise<void> {
  const pending = await getByStatus("pending");
  for (const capture of pending) {
    await updateStatus(capture.id, "syncing");
    try {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/v1/captures/transform`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: capture.text, tier }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as unknown;
      await updateStatus(capture.id, "synced", JSON.stringify(result));
    } catch {
      await updateStatus(capture.id, "failed");
    }
  }
}

export async function registerSyncTask(): Promise<void> {
  await BackgroundTask.registerTaskAsync(SYNC_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
