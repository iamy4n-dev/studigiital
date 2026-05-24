# Mobile Architecture

Expo managed workflow (React Native). Entry point is `app/_layout.tsx`; routing is Expo Router file-based.

---

## Directory map

```
app/
  _layout.tsx          Root layout — ClerkProvider + SessionProvider + AuthGate
  (tabs)/
    _layout.tsx        Tab bar layout + CaptureSheet mount
    index.tsx          Home screen (placeholder)
    backlog.tsx        Backlog screen (placeholder)
    capture.tsx        Placeholder — never navigated to directly (see Capture tab below)
    review.tsx         Review screen (placeholder)
    profile.tsx        Profile screen (placeholder)
  sign-in.tsx          Sign-in screen
  onboarding.tsx       Learning-type onboarding screen

components/
  CaptureSheet.tsx     Bottom-sheet modal — full capture flow

src/
  session.tsx          SessionContext — auth state + tier + dev mode bypass
  api.ts               Re-export shim for TransformResponse from api-client
  capture-queue.ts     SQLite append-only capture queue
  capture-sync.ts      Background sync — drains pending queue items to API
  capture-submit.ts    Submit decision: online → API, offline → queue
  capture-placeholder.ts  Pure fn: learning_type → TextInput placeholder text
  capture-mode-prefs.ts   SQLite-backed last-used capture mode preference

__mocks__/
  expo-sqlite.ts       In-memory mock for SQLite (used by all queue/prefs tests)

__tests__/
  capture-queue.test.ts
  capture-sync.test.ts
  capture-submit.test.ts
  capture-placeholder.test.ts
  capture-mode-prefs.test.ts
```

---

## Auth flow

`app/_layout.tsx` wraps the app in `ClerkProvider` → `SessionProvider` → `AuthGate`.

`AuthGate` watches `isLoaded` + `isSignedIn` from `useSession()` and redirects:
- unauthenticated + non-public screen → `/sign-in`
- authenticated + on sign-in screen → `/` (home)

`SessionProvider` (`src/session.tsx`) normalises Clerk state into a single `Session` object:

```
{ isLoaded, isSignedIn, userId, tier: "free" | "paid", isDevMode }
```

`tier` is read from Clerk `publicMetadata.tier` — set server-side after subscription. Defaults to `"free"`.

`DEV_MODE` (`EXPO_PUBLIC_DEV_MODE=true`) bypasses the auth gate entirely, injects a fake `paid` session, and is guarded by a `TODO(pre-release)` comment so it can't be silently shipped.

---

## Capture tab — FAB pattern

The center tab does **not navigate** to `capture.tsx`. Instead, `(tabs)/_layout.tsx` uses `tabBarButton` to replace the tab button with a `CaptureTabButton` (a floating-action-button style `Pressable`). Pressing it sets `sheetOpen = true`, which renders `CaptureSheet` as a modal over the current tab.

`capture.tsx` is a placeholder that satisfies Expo Router's file-based routing requirement; it contains an empty `<View />` and is never rendered in normal use.

---

## CaptureSheet state machine

`CaptureSheet` is a `Modal` (slide-up bottom sheet) driven by a `phase` discriminated union:

```
mode_picker  →  quick_text  →  submitting  →  result
                                           →  queued
                                           →  error  →  quick_text (retry)
```

| Phase | What's shown |
|-------|-------------|
| `mode_picker` | List of capture modes (Quick Text / Photo / Backlog) |
| `quick_text` | TextInput + Submit button |
| `submitting` | ActivityIndicator |
| `result` | Flashcard preview (`TransformResponse.cards`) |
| `queued` | "Saved for later" confirmation |
| `error` | Error message + Try again |

On open, the sheet jumps directly to `quick_text` if the last-used mode was `quick_text` (read from `capture-mode-prefs`), otherwise shows `mode_picker`.

`handleSubmit` flow:
1. Check connectivity via `expo-network`
2. Call `submitCapture(text, mode, tier, isOnline)` — see below
3. Route phase to `result | queued | error`

---

## Logic modules (`src/`)

### `capture-submit.ts`

Single exported function:

```ts
submitCapture(text, mode, tier, isOnline): Promise<SubmitResult>
```

> See also: [apps/backend/ARCHITECTURE.md — Request lifecycle](../../apps/backend/ARCHITECTURE.md#request-lifecycle----post-apiv1capturestransform) for what the server does with this request.

Decision table:

| `isOnline` | API response | Result |
|-----------|-------------|--------|
| `false` | — | `{ status: "queued" }` + item written to SQLite queue |
| `true` | 2xx | `{ status: "success", result: TransformResponse }` |
| `true` | non-2xx / throws | `{ status: "error", message }` |

### `capture-queue.ts`

SQLite table: `capture_queue.db` → `queue`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Random + timestamp-based |
| `text` | TEXT | Raw capture text |
| `mode` | TEXT | `"quick_text"` \| `"photo"` \| `"backlog"` |
| `status` | TEXT | `pending → syncing → synced \| failed` |
| `created_at` | INTEGER | Unix ms |
| `result_json` | TEXT? | Serialised `TransformResponse` after sync |

Key functions: `initQueue`, `enqueue`, `getByStatus`, `updateStatus`.

### `capture-sync.ts`

Registers a `expo-background-fetch` task (`CAPTURE_QUEUE_SYNC`). When triggered, `drainQueue` fetches all `pending` items, POSTs each to `/api/v1/captures/transform`, and marks them `synced` or `failed`.

Also exported as `drainQueue` for manual triggering (e.g. on app foreground).

### `capture-mode-prefs.ts`

SQLite table: same `capture_queue.db` → `prefs` (key-value)

| key | value |
|-----|-------|
| `last_capture_mode` | `"quick_text"` \| `"photo"` \| `"backlog"` |

Functions: `initModePrefs`, `getLastMode`, `setLastMode`. Defaults to `"quick_text"` if no row exists.

### `capture-placeholder.ts`

Pure function: `getPlaceholder(learningType: learning_type | null): string`

Maps Clerk `publicMetadata.learning_type` to a personalised TextInput hint. Returns a generic fallback for `null`. No side effects — unit-tested without any mocks.

---

## SQLite mock

`__mocks__/expo-sqlite.ts` is an in-memory replacement used by all logic tests. It maintains two in-memory stores:

- `_rows: QueueRow[]` — backing store for the `queue` table
- `_prefs: Map<string, string>` — backing store for the `prefs` table

Call `(SQLiteMock as any).__reset()` in `beforeEach` to isolate tests.

---

## Environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `EXPO_PUBLIC_API_URL` | `capture-submit.ts`, `capture-sync.ts` | Base URL for FastAPI — empty string in tests |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `app/_layout.tsx` | Clerk public key |
| `EXPO_PUBLIC_DEV_MODE` | `src/session.tsx` | Set to `"true"` to bypass auth locally |
