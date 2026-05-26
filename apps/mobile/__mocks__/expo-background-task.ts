export const registerTaskAsync = jest.fn().mockResolvedValue(undefined);
export const unregisterTaskAsync = jest.fn().mockResolvedValue(undefined);
export const getStatusAsync = jest.fn().mockResolvedValue(3); // Available

export enum BackgroundTaskResult {
  Success = "success",
  Failed = "failed",
}

export enum BackgroundTaskStatus {
  Restricted = 1,
  Denied = 2,
  Available = 3,
}
