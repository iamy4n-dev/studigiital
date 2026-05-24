.PHONY: install build typecheck generate spec \
        backend-dev backend-lint backend-typecheck backend-test \
        ci help

# ── Install ───────────────────────────────────────────────────────────────────

install: ## Install all JS + Python deps
	pnpm install
	cd apps/backend && uv sync --all-extras

# ── JS / Turbo ────────────────────────────────────────────────────────────────

build: ## Build all packages (turbo)
	pnpm turbo build

typecheck: ## TypeScript typecheck (mobile)
	pnpm --filter @studigiital/mobile typecheck

generate: ## Regenerate TypeScript client from committed openapi.json
	pnpm run generate:api-client

spec: ## Export OpenAPI spec from FastAPI, then regenerate client
	cd apps/backend && uv run python -c \
	  "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" \
	  > ../../packages/api-client/openapi.json
	pnpm run generate:api-client

# ── Backend ───────────────────────────────────────────────────────────────────

backend-dev: ## Start FastAPI dev server on :8000
	cd apps/backend && uv run uvicorn app.main:app --reload --port 8000

backend-lint: ## Ruff lint check
	cd apps/backend && uv run ruff check .

backend-typecheck: ## Mypy type check
	cd apps/backend && uv run mypy src/

backend-test: ## Run backend tests
	cd apps/backend && uv run pytest tests/ -v

# ── CI (local) ────────────────────────────────────────────────────────────────

ci: backend-lint backend-typecheck backend-test build typecheck ## Run all CI checks locally

# ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
