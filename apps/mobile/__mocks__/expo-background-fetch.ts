export const registerTaskAsync = jest.fn().mockResolvedValue(undefined);
export const unregisterTaskAsync = jest.fn().mockResolvedValue(undefined);

export enum BackgroundFetchResult {
  NewData = "newData",
  NoData = "noData",
  Failed = "failed",
}
