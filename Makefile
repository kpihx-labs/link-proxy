SHELL := /bin/zsh

PKG_NAME      := link-proxy
PKG_DIR_NAME  := link_proxy
PKG_DIR       := src/$(PKG_DIR_NAME)
VERSION       := $(shell grep -m 1 '"version"' package.json | tr -s ' ' | cut -d'"' -f4)

# Tooling
BUN := $(shell command -v bun 2>/dev/null || echo bun)
NODE := $(shell command -v node 2>/dev/null || echo node)

.PHONY: help check typecheck test smoke runtime-smoke install uninstall build publish git-push push git-install-hooks release

help: ## Show help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*##"}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Quality ───

check: typecheck test smoke runtime-smoke ## Run all checks (tsc + unit tests + smoke + runtime smoke)
	@echo "✅ All checks passed (v$(VERSION))"

typecheck: ## TypeScript strict typecheck
	@$(BUN) run typecheck

test: ## Unit tests (bun test)
	@$(BUN) run test

smoke: ## Smoke test — CLI end-to-end (isolated state dir)
	@$(BUN) run smoke

runtime-smoke: ## Verify the packaged CLI runs with Node.js / Bun
	@$(BUN) bin/link-proxy.mjs --version > /dev/null
	@$(BUN) bin/link-proxy.mjs do --help > /dev/null
	@echo "✅ CLI runtime smoke test passed"

# ─── Install / Uninstall ───

install: ## Install global binary wrapper to ~/.local/bin/link-proxy
	@mkdir -p $(HOME)/.local/bin
	@echo '#!/bin/sh\nexec bun "$(CURDIR)/bin/link-proxy.mjs" "$$@"' > $(HOME)/.local/bin/link-proxy
	@chmod +x $(HOME)/.local/bin/link-proxy
	@echo "✅ $(PKG_NAME) v$(VERSION) installed to $(HOME)/.local/bin/link-proxy"

install-dev: ## Link globally for local development (bun link)
	@$(BUN) link
	@echo "✅ $(PKG_NAME) v$(VERSION) linked globally via Bun"

uninstall: ## Uninstall global binary and unlink Bun package
	@rm -f $(HOME)/.local/bin/link-proxy
	@$(BUN) unlink 2>/dev/null || true
	@echo "✅ $(PKG_NAME) uninstalled"

# ─── Build / Publish ───

build: ## Build npm package tarball
	@$(BUN) pm pack

publish: build ## Publish npm package
	@npm config set //registry.npmjs.org/:_authToken "$$NPM_TOKEN" && npm publish --access public; npm config delete //registry.npmjs.org/:_authToken

# ─── Git ───

git-push: ## Push to both gitlab and github
	@git push github master
	@git push gitlab master
	@echo "✅ Pushed to github + gitlab"

push: git-push ## Alias for git-push

git-install-hooks: ## Install pre-commit hook
	@echo "#!/bin/sh\nmake check" > .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✅ Pre-commit hook installed"

# ─── Release ───

release: check git-push publish ## Full release: check → push → publish
