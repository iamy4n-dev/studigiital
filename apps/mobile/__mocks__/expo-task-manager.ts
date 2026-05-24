export const defineTask = jest.fn();
export const isTaskRegisteredAsync = jest.fn().mockResolvedValue(false);
export const unregisterAllTasksAsync = jest.fn().mockResolvedValue(undefined);
