import { createDrill, isDone, rateFailed, ratePassed } from "../src/lib/drillQueue";

const art = (id: string) => ({ id });

// ---------------------------------------------------------------------------
// Slice 1 — createDrill builds initial state
// ---------------------------------------------------------------------------

test("createDrill puts all artifacts in queue with nothing learned", () => {
  const state = createDrill([art("a"), art("b")]);
  expect(state.queue.map((x) => x.id)).toEqual(["a", "b"]);
  expect(state.learned.size).toBe(0);
  expect(state.total).toBe(2);
});

// ---------------------------------------------------------------------------
// Slice 2 — isDone
// ---------------------------------------------------------------------------

test("isDone is false when queue has items", () => {
  const state = createDrill([art("a")]);
  expect(isDone(state)).toBe(false);
});

test("isDone is true when queue is empty", () => {
  const state = createDrill([art("a")]);
  expect(isDone(ratePassed(state))).toBe(true);
});

// ---------------------------------------------------------------------------
// Slice 3 — ratePassed removes head and marks as learned
// ---------------------------------------------------------------------------

test("ratePassed removes current artifact from queue", () => {
  const state = createDrill([art("a"), art("b")]);
  const next = ratePassed(state);
  expect(next.queue.map((x) => x.id)).toEqual(["b"]);
});

test("ratePassed marks artifact as learned", () => {
  const state = createDrill([art("a"), art("b")]);
  const next = ratePassed(state);
  expect(next.learned.has("a")).toBe(true);
  expect(next.learned.size).toBe(1);
});

// ---------------------------------------------------------------------------
// Slice 4 — rateFailed moves head to end of queue
// ---------------------------------------------------------------------------

test("rateFailed moves current artifact to end of queue", () => {
  const state = createDrill([art("a"), art("b"), art("c")]);
  const next = rateFailed(state);
  expect(next.queue.map((x) => x.id)).toEqual(["b", "c", "a"]);
});

test("rateFailed does not remove artifact from queue", () => {
  const state = createDrill([art("a")]);
  const next = rateFailed(state);
  expect(next.queue.length).toBe(1);
  expect(isDone(next)).toBe(false);
});

// ---------------------------------------------------------------------------
// Slice 5 — rateFailed adds artifact to weakSpots
// ---------------------------------------------------------------------------

test("rateFailed adds artifact to weakSpots", () => {
  const state = createDrill([art("a"), art("b")]);
  const next = rateFailed(state);
  expect(next.weakSpots.has("a")).toBe(true);
});

test("rateFailed on same artifact twice only adds it once to weakSpots", () => {
  let state = createDrill([art("a"), art("b")]);
  state = rateFailed(state);  // a goes to end, b is head
  state = ratePassed(state);  // b learned
  state = rateFailed(state);  // a failed again
  expect(state.weakSpots.size).toBe(1);
  expect(state.weakSpots.has("a")).toBe(true);
});

// ---------------------------------------------------------------------------
// Slice 6 — full drill cycle ends when all artifacts are learned
// ---------------------------------------------------------------------------

test("drill completes when all artifacts are learned after failures", () => {
  let state = createDrill([art("a"), art("b")]);
  state = rateFailed(state); // a → end; b is head
  state = ratePassed(state); // b learned; a is head
  state = ratePassed(state); // a learned; queue empty
  expect(isDone(state)).toBe(true);
  expect(state.learned.size).toBe(2);
  expect(state.weakSpots.has("a")).toBe(true);
  expect(state.weakSpots.has("b")).toBe(false);
});
