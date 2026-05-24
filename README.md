# Studigital

A microlearning app. Capture real-life learning material (handwritten notes, quick memos, book pages), transform it via LLM into flashcards, notes, or quizzes, and review it later. The core loop — **Capture → Transform → Tagged artifact** — completes in under 2 minutes.

---

## Monorepo layout

```
apps/
  mobile/      Expo (React Native managed workflow) — iOS + Android
  web/         Next.js — marketing / web access (frontend only)
  backend/     FastAPI — REST API, LLM skill system, PostgreSQL

packages/
  api-client/  TypeScript client auto-generated from FastAPI OpenAPI spec
  types/       Shared TypeScript types

skills/        Python LLM skill classes (one per transformation type)
  ocr-extract/
  generate-flashcard/
  generate-note/
  generate-quiz/
  suggest-tags/
  infer-format/
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node | 20 |
| pnpm | 9 (see `packageManager` in root `package.json`) |
| Python | 3.12 |
| uv | 0.11+ |

---

## Quick start

```bash
# 1. Copy and fill in env files
cp apps/backend/.env.example apps/backend/.env     # set ANTHROPIC_API_KEY at minimum
cp apps/mobile/.env.example apps/mobile/.env       # defaults work for local dev

# 2. Install everything
make install

# 3. Start the backend (FastAPI on :8000)
make backend-dev

# 4. Start the mobile app (Expo dev client)
pnpm --filter @studigiital/mobile start
```

---

## Common tasks

All common tasks are in the root `Makefile`. Run `make help` to see them.

```
make install            Install all JS + Python deps
make build              Build all packages (turbo)
make typecheck          TypeScript typecheck (mobile)
make spec               Export OpenAPI spec from FastAPI + regenerate TS client
make generate           Regenerate TS client from committed openapi.json (no Python needed)

make backend-dev        Start FastAPI dev server on :8000
make backend-lint        Ruff lint check
make backend-typecheck   Mypy type check
make backend-test        Run backend tests

make ci                 Run all CI checks locally (lint + typecheck + test + build)
```

---

## Running tests

```bash
# Mobile (Jest / ts-jest)
pnpm --filter @studigiital/mobile test

# Backend (pytest)
make backend-test
# or from apps/backend:
cd apps/backend && make test
```

---

## API contract

The TypeScript client in `packages/api-client/` is **always generated** — never handwritten. The workflow is:

1. FastAPI auto-generates an OpenAPI spec via `make spec`
2. `hey-api` generates typed TypeScript clients from `packages/api-client/openapi.json`
3. CI checks that the committed client matches the live spec (`git diff --exit-code`)

If you change a FastAPI route or schema, run `make spec` and commit the regenerated files.

---

## Architecture overview

**Auth:** Clerk — Google + Apple sign-in + email fallback. Apple Sign-In is mandatory for App Store compliance.

**Offline:** Expo SQLite as an append-only local capture queue. `expo-background-fetch` syncs captures to the server when connectivity restores. Device → server only (no bidirectional sync in v1).

**LLM skills:** Each skill in `skills/` is a self-contained Python class — prompt template, input/output schema, model config, tools. A skill registry routes each capture to the correct skill. Transformation skills (`generate-flashcard`, `generate-note`, `generate-quiz`) use tier-based model routing — free tier gets Gemma 4-class models, paid tier gets Claude/GPT-4-class.

**Storage:** AWS RDS PostgreSQL for structured data + AWS S3 for raw media and export files. Presigned URLs for mobile uploads.

---

## What's been built (implementation status)

| # | Feature | Status |
|---|---------|--------|
| 3 | Auth: Clerk gate + Google/Apple sign-in + onboarding | Merged |
| 5 | API contract: FastAPI → OpenAPI → TypeScript client | Merged |
| 6 | Offline capture queue (expo-sqlite + background sync) | Merged |
| 7 | Quick Text capture screen (submit → flashcard result) | Merged |

---

## Contributing

- All changes go on a dedicated branch and merge via PR — never push directly to `main`.
- Branch naming: `feat/<slug>`, `fix/<slug>`, `scaffold/<slug>`.
- CI runs on every push: build, lint, typecheck (mobile), tests (mobile + backend), API contract staleness check. See [docs/ci.md](docs/ci.md) for what each job checks and how to fix failures locally.
- For agent context and codebase conventions, see [CLAUDE.md](CLAUDE.md).
- For product decisions and design rationale, see [studigital-design-decisions.md](studigital-design-decisions.md).
