# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Pre-implementation.** All decisions are documented in `studigital-design-decisions.md`. No application code exists yet. The monorepo structure below is the agreed target — do not create directories speculatively before work begins on a context.

## What this is

**Studigital** — a microlearning app. Users capture real-life learning material (handwritten notes, book pages, quick memos), which is transformed via LLM into digital artifacts (Markdown notes, Anki flashcards, quizzes). The core loop is: **Capture → Transform → Tagged artifact**, completed in under 2 minutes.

## Planned monorepo structure (Turborepo)

```
/apps/
  /mobile          Expo (React Native managed workflow)
  /web             Next.js (frontend only — no API routes)
  /backend         FastAPI (Python)
/packages/
  /types           Shared TypeScript types
  /api-client      hey-api generated TypeScript client from FastAPI's OpenAPI spec
/domain/
  /capture
  /transform
  /review
  /gamification
  /tags
/skills/           Python skill classes (prompt, schema, model config, tools)
  /ocr-extract
  /generate-note
  /generate-flashcard
  /generate-quiz
  /suggest-tags
  /infer-format
```

## Architecture decisions to be aware of

**API contract:** FastAPI auto-generates an OpenAPI spec; `hey-api` generates typed TypeScript clients from it. Never write TypeScript API types by hand — regenerate from the spec.

**LLM skill system:** Each skill in `/skills/` is a self-contained Python class with prompt template, input/output schema, model config, and tools. A skill registry routes captures to the correct skill. All skills produce structured JSON via native LLM structured outputs.

**Skill routing:** Atomic skills (`ocr-extract`, `suggest-tags`, `infer-format`) are hardcoded to cheap/fast models (e.g. Google Vision, small LLM). Transformation skills (`generate-note`, `generate-flashcard`, `generate-quiz`) use tier-based routing — free tier gets Gemma 4 class models, paid tier gets Claude/GPT-4 class.

**Offline:** Expo SQLite (`expo-sqlite`) as append-only local capture queue. `expo-background-fetch` syncs to server when connectivity restores. Captures flow device → server only (no bidirectional sync in v1).

**Auth:** Clerk (not Cognito). Google + Apple sign-in + email fallback. Apple Sign-In is mandatory for App Store compliance.

**Storage:** AWS RDS PostgreSQL for structured data + AWS S3 for raw media and export files. Presigned URLs for mobile uploads.

**Expo eject path:** The repo tracks all Expo-managed and third-party non-native APIs in `studigital-design-decisions.md` (Third-Party & Non-Native API Tracker table) as a migration checklist for future bare React Native eject.

## Domain concepts

The canonical domain terms are defined in per-context `CONTEXT.md` files (see `docs/agents/domain.md` for the file structure). Use the glossary vocabulary in issue titles, test names, and code — do not drift to synonyms.

Key terms from design decisions:
- **Capture** — the raw input (photo, quick text, or backlog item)
- **Artifact** — the transformed output (note, flashcard, quiz)
- **Skill** — a single LLM pipeline unit (input schema → prompt → structured JSON output)
- **Skill registry** — routes a capture to the correct skill
- **Mistake resolution rate** — the integrity metric (how many captured items have been reviewed/passed)
- **Tag mastery score** — per-tag progress percentage

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`iamy4n-dev/studigiital`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context repo — `CONTEXT-MAP.md` at root points to per-context `CONTEXT.md` files. See `docs/agents/domain.md`.
