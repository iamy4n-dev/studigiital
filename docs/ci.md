# CI reference

CI runs on every push to `main`, `feat/**`, `fix/**`, `scaffold/**`, and on all PRs to `main`.

Three jobs run in parallel. All three must pass before merging.

---

## Job: Build & Lint

**What it checks:** JS dependency install, Turborepo build (includes Next.js web build), TypeScript typecheck (web).

Web steps run with `NEXT_PUBLIC_DEV_MODE=true` so no Clerk keys are required in CI.

Mobile CI is intentionally excluded until after the first web release.

| Step | Failure means | Fix locally |
|------|--------------|-------------|
| Install JS dependencies | `pnpm-lock.yaml` is out of sync | `pnpm install` then commit the updated lockfile |
| Build (turbo) | A package fails to compile | `make build` |
| Typecheck web | TypeScript errors in `apps/web` | `pnpm --filter @studigiital/web typecheck` |

---

## Job: API contract (stale check)

**What it checks:** That `packages/api-client/` matches what FastAPI currently generates. Regenerates the OpenAPI spec from the live Python code and the TypeScript client from that spec, then fails if `git diff` shows any change.

| Step | Failure means | Fix locally |
|------|--------------|-------------|
| Export OpenAPI spec | FastAPI app fails to import | Fix the Python import error first (`make backend-lint`) |
| Regenerate TypeScript client | `hey-api` codegen fails | Check `packages/api-client/openapi.json` is valid JSON |
| Check client is not stale | A FastAPI route/schema changed but the generated client wasn't recommitted | `make spec` then commit `packages/api-client/` |

**Rule:** Any change to a FastAPI route, request model, or response model requires running `make spec` and committing the regenerated files in the same PR.

---

## Job: Backend

**What it checks:** Python dependency install, Ruff lint, Mypy strict type-check, smoke-import, and the full pytest suite.

| Step | Failure means | Fix locally |
|------|--------------|-------------|
| Install Python dependencies | `uv.lock` is out of sync or a dep is broken | `cd apps/backend && uv sync --all-extras` |
| Lint (ruff) | Style or lint violation | `cd apps/backend && uv run ruff check --fix .` |
| Type-check (mypy) | Type error in `src/` | `make backend-typecheck` |
| Health check (import test) | App fails to import at startup | Run `make backend-dev` and read the traceback |
| Test (pytest) | A unit or integration test is failing | `make backend-test` |

---

## Run everything locally before pushing

```bash
make ci
```

This runs: backend lint → backend typecheck → backend tests → JS build → mobile typecheck. It does not run the API contract check (that requires both Python and JS toolchains in sequence). To check that separately:

```bash
make spec   # regenerate — commit the result if anything changed
```
