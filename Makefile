# Local development. Docker provides DynamoDB Local; the API and the Expo client run on the host so
# they hot-reload.

.PHONY: help infra infra-down seed api api-memory test web

# Override when another project's DynamoDB Local already holds :8000, e.g. `make infra api DYNAMODB_PORT=8010`.
DYNAMODB_PORT ?= 8000
export DYNAMODB_PORT

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

infra: ## Start DynamoDB Local (:$(DYNAMODB_PORT))
	docker compose up -d
	@echo "Waiting for DynamoDB Local…"; until curl -s -o /dev/null http://localhost:$(DYNAMODB_PORT); do sleep 1; done
	@echo "Infra ready — run 'make seed' next."

infra-down: ## Stop and remove the local containers
	docker compose down

seed: ## Create the KnockKnock table in DynamoDB Local (idempotent)
	cd backend && DYNAMODB_ENDPOINT=http://localhost:$(DYNAMODB_PORT) npm run create-table

api: ## Run the API on http://localhost:3001 against DynamoDB Local (reachable from phones on the LAN)
	cd backend && TABLE_NAME=KnockKnock DYNAMODB_ENDPOINT=http://localhost:$(DYNAMODB_PORT) AWS_REGION=eu-west-1 \
		AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local npm run dev

api-memory: ## Run the API with an in-memory store (no Docker needed)
	cd backend && npm run dev

test: ## Run the backend tests
	cd backend && npm test

web: ## Run the Expo client in a browser
	cd app && npm run web
