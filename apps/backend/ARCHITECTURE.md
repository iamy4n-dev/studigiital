# Backend Architecture

FastAPI application. Entry point is `src/app/main.py`. Python 3.12, managed with `uv`.

---

## Directory map

```
src/app/
  main.py              FastAPI app factory — routers, CORS, health check
  core/
    config.py          Pydantic Settings — env vars with .env fallback
    auth.py            Clerk JWT verification → UserClaims dependency
    llm.py             Anthropic async client factory (FastAPI dependency)
  api/v1/
    captures.py        POST /transform (live), POST|GET / and /{id} (stub)
    artifacts.py       Artifact CRUD (stub)
    tags.py            Tag CRUD (stub)
    users.py           User profile endpoints (stub)
  skills/
    base.py            BaseSkill[InputT, OutputT] — structured LLM call helper
    infer_format.py    InferFormatSkill — classifies text to a skill name
    generate_flashcard.py  GenerateFlashcardSkill — produces Anki card pairs
    registry.py        SkillRegistry — maps skill name + tier to a skill instance

tests/
  test_captures_transform.py
  test_skill_registry.py
  test_auth_dev_mode.py
  test_users.py
```

---

## Request lifecycle — `POST /api/v1/captures/transform`

This is the only fully implemented endpoint. All other routes raise `NotImplementedError`.

> Called by: `CaptureSheet` via `submitCapture` in [apps/mobile/ARCHITECTURE.md — capture-submit.ts](../../apps/mobile/ARCHITECTURE.md#capture-submits).

```
Request: { text: str, tier: "free" | "paid" }

1. get_current_user  →  validates Clerk JWT  →  UserClaims { user_id, tier }
2. get_anthropic_client  →  AsyncAnthropic (injected as FastAPI dep)
3. SkillRegistry.get_infer_skill()
     InferFormatSkill.run(text)
       → LLM call (haiku, cheap/fast)
       → { skill_name: "generate_flashcard" | "generate_note" | "generate_quiz", confidence }
4. SkillRegistry.get_generate_skill(skill_name, tier)
     GenerateFlashcardSkill.run(text)   ← only flashcard implemented in v1
       → LLM call (haiku if free, sonnet if paid)
       → { cards: [{ front, back }], source_summary }
5. Response: TransformResponse { skill_name, cards, source_summary }
```

---

## Skill system

### `BaseSkill[InputT, OutputT]`

Abstract generic base. All skills inherit from it. One method to implement: `run(inp: InputT) -> OutputT`.

The shared helper `_call_structured(prompt, output_schema)` drives every LLM call:
- Uses Anthropic tool-use with `tool_choice: { type: "tool", name: "output" }` to force structured JSON output
- Extracts the `tool_use` block from the response and validates it against the Pydantic `output_schema`
- No parsing of raw text — the LLM is constrained to emit valid schema via native structured outputs

### Skill classes

| Skill | Input | Output | Notes |
|-------|-------|--------|-------|
| `InferFormatSkill` | `{ text }` | `{ skill_name, confidence }` | Always haiku — cheap classifier |
| `GenerateFlashcardSkill` | `{ text }` | `{ cards: [{ front, back }], source_summary }` | Tier-gated model |

`generate_note` and `generate_quiz` are declared as valid `SkillName` literals but not yet implemented. `SkillRegistry.get_generate_skill` will raise `ValueError` if routed to them.

### `SkillRegistry`

Instantiated per-request in the route handler. Receives the Anthropic client and returns the correct skill instance for a given name + tier combination.

Model routing:

| Tier | `generate_flashcard` |
|------|---------------------|
| free | `claude-haiku-4-5-20251001` |
| paid | `claude-sonnet-4-6` |

`infer_format` is always `claude-haiku-4-5-20251001` regardless of tier.

---

## Auth

`get_current_user` is a FastAPI dependency injected into every protected route.

**Production path:** Extracts the `Authorization: Bearer <token>` header, fetches Clerk's JWKS (cached), verifies the RS256 JWT, and returns `UserClaims { user_id, tier }`. The `tier` claim is set server-side by Clerk webhooks after a subscription event.

**Dev bypass:** If `settings.dev_mode = True` (env `DEV_MODE=true`), the dependency short-circuits and returns `UserClaims(user_id="dev-user", tier="paid")` without touching the token. Guarded by a `TODO(pre-release)` comment — see issue #31.

**No-key fallback:** If `clerk_secret_key` is empty (local dev without Clerk configured), returns a free-tier dev user. This allows the API to run without Clerk credentials in a fresh checkout.

---

## Configuration

All config is in `src/app/core/config.py` via `pydantic-settings`. Values load from environment variables or a `.env` file.

| Variable | Default | Notes |
|----------|---------|-------|
| `DEBUG` | `False` | Enables `/docs` (Swagger UI) |
| `DATABASE_URL` | `postgresql+asyncpg://localhost/studigital` | Not yet wired to routes |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Add mobile dev origin as needed |
| `AWS_REGION` | `us-east-1` | Not yet used |
| `S3_BUCKET` | `studigiital-media` | Not yet used |
| `CLERK_SECRET_KEY` | `""` | Empty → no-key dev fallback |
| `CLERK_JWKS_URL` | Clerk production JWKS | Override in tests |
| `DEV_MODE` | `False` | Bypasses auth entirely |

`ANTHROPIC_API_KEY` is read directly by the Anthropic SDK from the environment — not declared in `Settings`.

---

## What's stubbed

These routes exist in the router files but raise `NotImplementedError`:

- `POST /api/v1/captures/` — store a raw capture (no DB yet)
- `GET /api/v1/captures/` and `/{id}` — retrieve captures
- All of `artifacts`, `tags`, `users` routers

The database schema (PostgreSQL via RDS) is not yet implemented. `DATABASE_URL` is configured but no ORM models or migrations exist.
