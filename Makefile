.PHONY: install build typecheck generate spec \
        dev backend-dev mobile-dev mobile-ios mobile-android web-dev \
        backend-lint backend-typecheck backend-test \
        clean reset \
        ci help

# ── Install ───────────────────────────────────────────────────────────────────

install: ## Install all JS + Python deps
	pnpm install
	cd apps/backend && uv sync --all-extras

# ── Dev servers ───────────────────────────────────────────────────────────────

dev: ## Start mobile + web dev servers in parallel (backend needs a separate terminal)
	pnpm turbo dev

backend-dev: ## Start FastAPI dev server on :8000
	cd apps/backend && uv run uvicorn app.main:app --reload --port 8000

mobile-dev: ## Start Expo Metro bundler (scan QR in Expo Go or press i/a for simulator)
	pnpm --filter @studigiital/mobile start

mobile-ios: ## Launch mobile app in iOS simulator
	pnpm --filter @studigiital/mobile ios

mobile-android: ## Launch mobile app in Android emulator
	pnpm --filter @studigiital/mobile android

web-dev: ## Start Next.js dev server on :3000
	pnpm --filter @studigiital/web dev

# ── JS / Turbo ────────────────────────────────────────────────────────────────

build: ## Build all packages (turbo)
	pnpm turbo build

typecheck: ## TypeScript typecheck (web)
	NEXT_PUBLIC_DEV_MODE=true NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm --filter @studigiital/web typecheck

generate: ## Regenerate TypeScript client from committed openapi.json
	pnpm run generate:api-client

spec: ## Export OpenAPI spec from FastAPI, then regenerate client
	cd apps/backend && uv run python -c \
	  "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" \
	  > ../../packages/api-client/openapi.json
	pnpm run generate:api-client

# ── Backend ───────────────────────────────────────────────────────────────────

backend-lint: ## Ruff lint check
	cd apps/backend && uv run ruff check .

backend-typecheck: ## Mypy type check
	cd apps/backend && uv run mypy src/

backend-test: ## Run backend tests
	cd apps/backend && uv run pytest tests/ -v

# ── Database ─────────────────────────────────────────────────────────────────

db-migrate: ## Apply all pending Alembic migrations (requires DATABASE_URL in apps/backend/.env)
	cd apps/backend && uv run alembic upgrade head

db-revision: ## Autogenerate a new migration (usage: make db-revision MSG="description")
	cd apps/backend && uv run alembic revision --autogenerate -m "$(MSG)"

# ── Maintenance ───────────────────────────────────────────────────────────────

clean: ## Remove build caches and Expo/Next.js output (keeps node_modules and .venv)
	rm -rf .turbo apps/mobile/.expo apps/web/.next
	find . -name dist -not -path "*/node_modules/*" -type d -exec rm -rf {} + 2>/dev/null || true

reset: clean ## Nuke all deps then reinstall from scratch (use when deps are corrupted)
	rm -rf node_modules \
	       apps/mobile/node_modules \
	       apps/web/node_modules \
	       packages/api-client/node_modules \
	       packages/types/node_modules \
	       apps/backend/.venv
	$(MAKE) install

# ── CI (local) ────────────────────────────────────────────────────────────────

ci: backend-lint backend-typecheck backend-test build typecheck ## Run all CI checks locally

# ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
