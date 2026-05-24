.PHONY: dev lint typecheck test spec install help

install: ## Install Python deps (including dev extras)
	uv sync --all-extras

dev: ## Start FastAPI dev server on :8000
	uv run uvicorn app.main:app --reload --port 8000

lint: ## Ruff lint check
	uv run ruff check .

lint-fix: ## Ruff lint with auto-fix
	uv run ruff check . --fix

typecheck: ## Mypy strict type check
	uv run mypy src/

test: ## Run tests with verbose output
	uv run pytest tests/ -v

test-fast: ## Run tests, stop on first failure
	uv run pytest tests/ -x

spec: ## Export openapi.json snapshot (run from repo root via `make spec`)
	uv run python -c \
	  "from app.main import app; import json; print(json.dumps(app.openapi(), indent=2))" \
	  > ../../packages/api-client/openapi.json
	@echo "Spec written to packages/api-client/openapi.json"

check: lint typecheck test ## Run all checks (lint + typecheck + test)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
