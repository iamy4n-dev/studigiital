export interface DrillItem {
  id: string;
}

export interface DrillState<T extends DrillItem = DrillItem> {
  queue: T[];
  learned: Set<string>;
  weakSpots: Set<string>;
  total: number;
}

export function createDrill<T extends DrillItem>(artifacts: T[]): DrillState<T> {
  return {
    queue: [...artifacts],
    learned: new Set(),
    weakSpots: new Set(),
    total: artifacts.length,
  };
}

export function ratePassed<T extends DrillItem>(state: DrillState<T>): DrillState<T> {
  const [current, ...rest] = state.queue;
  if (!current) return state;
  return {
    ...state,
    queue: rest,
    learned: new Set([...state.learned, current.id]),
  };
}

export function rateFailed<T extends DrillItem>(state: DrillState<T>): DrillState<T> {
  const [current, ...rest] = state.queue;
  if (!current) return state;
  return {
    ...state,
    queue: [...rest, current],
    weakSpots: new Set([...state.weakSpots, current.id]),
  };
}

export function isDone<T extends DrillItem>(state: DrillState<T>): boolean {
  return state.queue.length === 0;
}
