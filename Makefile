.PHONY: help dev-up dev-down dev-logs dev-restart clean keyfile

COMPOSE_DEV = docker compose

help: 
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)


keyfile: ## Generate MongoDB keyfile if not exists
	@if [ ! -f mongo-keyfile ]; then \
		echo " Generating MongoDB keyfile..."; \
		openssl rand -base64 756 > mongo-keyfile; \
		chmod 400 mongo-keyfile; \
		echo " Keyfile generated successfully"; \
	else \
		echo "Keyfile already exists"; \
	fi

dev-up: keyfile ## Start development environment
	@echo " Starting development environment..."
	@echo " Cleaning up old containers..."
	$(COMPOSE_DEV) down 2>/dev/null || true
	@echo "🔨 Building and starting services..."
	$(COMPOSE_DEV) up -d --remove-orphans
	@echo " Development environment started"
	@echo " View logs: make dev-logs"

dev-down: ## Stop development environment
	@echo " Stopping development environment..."
	$(COMPOSE_DEV) down
	@echo "Development environment stopped"

dev-restart: ## Restart development environment
	@echo " Restarting development environment..."
	$(COMPOSE_DEV) restart be-nest
	@echo " Development environment restarted"

dev-logs: ## View development logs
	$(COMPOSE_DEV) logs -f be-nest

dev-logs-all: ## View all development logs
	$(COMPOSE_DEV) logs -f

dev-shell: ## Access development container shell
	$(COMPOSE_DEV) exec be-nest sh

dev-mongo-shell: ## Access MongoDB shell
	$(COMPOSE_DEV) exec mongodb mongosh -u root -p 123456 --authenticationDatabase admin

dev-rebuild: ## Rebuild development containers
	@echo "🔨 Rebuilding development containers..."
	$(COMPOSE_DEV) up -d --build --force-recreate
	@echo " Rebuild complete"

dev-reset: ## Reset development environment (remove all data)
	@echo "Resetting development environment..."
	$(COMPOSE_DEV) down -v
	@echo "🔨 Starting fresh..."
	@$(MAKE) dev-up
	@echo "Reset complete"

# ==================== MAINTENANCE ====================

clean: ## Remove all containers, volumes, and images
	@echo "🧹 Cleaning up..."
	@$(COMPOSE_DEV) down -v --rmi all 2>/dev/null || true
	@echo "Cleanup complete"

clean-volumes: ## Remove all volumes (WARNING: deletes all data)
	@echo " WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(COMPOSE_DEV) down -v; \
		echo "Volumes removed"; \
	fi

status: ## Show container status
	@echo "Development:"
	@$(COMPOSE_DEV) ps
	@echo ""

# ==================== DATABASE ====================

db-backup: ## Backup MongoDB database
	@echo "💾 Creating database backup..."
	@mkdir -p backups
	@docker exec nest-mongodb mongodump \
		--username=root \
		--password=123456 \
		--authenticationDatabase=admin \
		--db=nest-book-management \
		--out=/tmp/backup
	@docker cp nest-mongodb:/tmp/backup ./backups/backup-$$(date +%Y%m%d-%H%M%S)
	@echo "Backup created in ./backups/"

db-restore: ## Restore MongoDB database (usage: make db-restore BACKUP=backup-20240101-120000)
	@if [ -z "$(BACKUP)" ]; then \
		echo "Error: Please specify BACKUP folder"; \
		echo "Usage: make db-restore BACKUP=backup-20240101-120000"; \
		exit 1; \
	fi
	@echo "Restoring database from $(BACKUP)..."
	@docker cp ./backups/$(BACKUP) nest-mongodb:/tmp/restore
	@docker exec nest-mongodb mongorestore \
		--username=root \
		--password=123456 \
		--authenticationDatabase=admin \
		--db=nest-book-management \
		/tmp/restore/nest-book-management
	@echo "Database restored"