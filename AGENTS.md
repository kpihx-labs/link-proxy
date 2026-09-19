# link-proxy — Agent Context

## Project

Non-MCP CLI proxy for LinkedIn. Full `linkedin-mcp` catalog plus raw REST v2 API (12 actions) as flat JSON-RPC actions.
`../whats-proxy/` and `../tick-proxy/` are the proxy standard references. **Read `CONTRACT.md` before touching code.**

> **Status:** 🟢 **LIVE: 10 active actions, 6 disabled (code kept).** `CONTRACT.md` is the architecture contract. Version tracked by `package.json`.

## Overview

```bash
link-proxy do <action> [payload|file] [-o path] [-f json|table]   # 12 actions
link-proxy admin auth login|status|logout                         # auth lifecycle
link-proxy admin status|doctor|purge                              # status & diagnostics
```

## Key Rules

- **Never delete `~/.config/link-proxy/token.json`** — OAuth credentials live there.
- **stdout is pure JSON** — never `console.log` anything that could pollute CLI output (use `logger.ts` → stderr).
- **Single source of truth for version:** `package.json` (read via `src/link_proxy/version.ts`).
- **Envelope always:** `{ meta: { status, comment, edited }, data }` — errors exit 1; admin misuse exits 2.
- **Isolated state for tests:** `LINKEDIN_CONFIG_DIR` suppresses real config directory access during tests.
- **Actions must be registered** in `actions/registry.ts` (duplicate detection on boot; registry tests assert 12).
- **Safety is declarative:** `actions/policies.ts` is the only source for approval and preflight locks.

## Commands

```bash
make check        # tsc --noEmit + bun test + smoke
make test         # unit tests only
make smoke        # isolated CLI smoke
make install      # bun link global
make git-push     # push to github + gitlab
```

## Structure

```
src/link_proxy/
├── index.ts cli.ts client.ts helpers.ts config.ts logger.ts
├── display.ts doc.ts version.ts exceptions.ts types.ts hitl.ts
├── actions/   # profile.ts, posts.ts, social.ts, raw.ts, registry.ts, policies.ts, schemas.ts
└── admin/     # auth.ts, status.ts
bin/link-proxy.mjs
tests/
```
