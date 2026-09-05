# link-proxy — Architecture Contract

> **Status:** 🟢 **LIVE — 10 active actions, 6 disabled (code kept).** This document is the authoritative architecture
> contract for `link-proxy`, the non-MCP LinkedIn CLI built on the exact ADN of `whats-proxy`
> (`$HOME/KpihX-Labs/Proxies/whats-proxy/`) and `tick-proxy` (`$HOME/KpihX-Labs/Proxies/tick-proxy/`).

---

## Mission

Complete rewrite of the MCP `linkedin-mcp` (`$HOME/Work/AI/MCPs/linkedin_mcp`) into a non-MCP CLI proxy that
follows **exactly** the `whats-proxy` / `tick-proxy` model, adapted for LinkedIn's official OAuth 2.0 and REST v2 surface.

- **Single binary, two namespaces** — `link-proxy do <action>` (RPC) + `link-proxy admin <action>` (always JSON)
- **Flat kebab-case actions** — ONE level after `do`, pure JSON-RPC, payload inline or file
- **`meta` + `data` envelope** — every response, always
- **Docstring-driven `--help`** — the docstring IS the documentation (single source of truth)
- **HITL web UI** — two templates: full post editor (`post-review.html`) for text-composing actions, compact JSON review (`hitl.html`) for the rest
- **Autosave** — every `do` execution snapshots to `/tmp/link-proxy-autosave/`
- **TypeScript + Zod + Bun toolchain + Node.js runtime** — Bun owns install/test/build, Node.js runs CLI
- **NO Docker** — explicitly excluded (same as `whats-proxy` / `tick-proxy`)

**Location:** `$HOME/KpihX-Labs/Proxies/link-proxy/` — sibling of `whats-proxy/` and `mail-proxy/`.

---

## Mantras

- **0 Hardcoding · 100% Flexibility** — no hardcoded client IDs or redirect URLs in logic; every
  configurable value lives as a documented default in `config.ts`, overridable via env or `admin`.
- **0 Magic · 100% Transparency** — every LinkedIn v2 REST call is explicit; the token status is visible via
  `admin status`; HITL review payloads are full JSON; no hidden retry loops or silent drops.
- **0 Trust · 100% Control** — session state protected (credentials stored with 0600 permissions); HITL mandatory on
  all feed posts; destructive actions preflight then pass through HITL with identity fields locked.
- **Stateful persistence** — OAuth tokens persisted to `~/.config/link-proxy/token.json`; member identity cached
  at auth time to accelerate URN resolution.

---

## Design — Single Binary, Namespaced CLI

```
link-proxy
   │
   ├── admin <action>                       # ALWAYS JSON — auth + config lifecycle
   │   ├── auth login                       # Interactive HITL web form → credentials & OAuth consent
   │   ├── auth status                      # Token presence, validity, days remaining, member profile
   │   ├── auth logout                      # Clear stored OAuth token (HITL-confirmed)
   │   ├── status                           # Complete system status & API reachability probes
   │   ├── doctor                           # Diagnostic + permission auto-fixer (0700/0600)
   │   └── purge                            # Clear config and state directory (HITL-confirmed)
   │
   └── do <action> [payload|file] [--output-file/-o] [--format/-f] [--help/-h]
                                             # RPC — 10 active actions, JSON payload (inline or file)
```

### `link-proxy admin` — Admin (ALWAYS JSON to stdout — hardcoded, no `--format`)

| Command | Role | Output | HITL | Backend |
|---------|------|--------|:----:|---------|
| `link-proxy admin auth login` | First-time / re-pair auth via interactive HITL web form. **Pre-loads existing `client_id`, `client_secret`, and token state in masked format** (`86ab…3456`). Untouched fields preserve existing secrets so the user can validate without re-entering unchanged data. | JSON (final) | ✅ (Interactive Web Form) | OAuth 2.0 PKCE / Code exchange |
| `link-proxy admin auth status` | Auth token state: presence, validity, days remaining, member URN, masked credentials. | JSON | ❌ | Token check + OIDC profile probe |
| `link-proxy admin auth logout` | Clear stored OAuth token (`token.json`). | JSON | ✅ | Local file removal |
| `link-proxy admin status` | Complete system health: config files, permissions check, REST API reachability, binary path. | JSON | ❌ | System & API probe |
| `link-proxy admin doctor` | System check & file permissions audit/auto-fix (`chmod 0700` dir, `0600` files). | JSON | ❌ | System probe |
| `link-proxy admin purge` | Delete all credentials and state files. | JSON | ✅ | Local purge |

**Admin never accepts `--format` or `--output-file`** — passing either exits **2** with an error envelope.

### `do` — RPC Actions (JSON default, table via `--format/-f`)

**Meta options (ONLY for `do`, every `--` has its `-`):**

| Option | Role |
|--------|------|
| `--output-file <path>` / `-o <path>` | Write the full envelope to a file (path required) |
| `--format json\|table` / `-f json\|table` | Display format (default: `json`) |
| `--help` / `-h` | Full docstring + Zod payload schema for that action |
| *(positional)* `payload` | Inline JSON `'{"k":"v"}'` **or** a file path `./payload.json` |

**Output envelope — EVERY response:**

```json
{
  "meta": {
    "status": "ok",
    "comment": "",
    "edited": false
  },
  "data": { }
}
```

| `meta` field | Values | Meaning |
|--------------|--------|---------|
| `status` | `ok` · `approved` · `rejected` · `error` | `approved`/`rejected` only when HITL was involved |
| `comment` | free text | the HITL reviewer's comment (empty if none) |
| `edited` | `true` · `false` | the HITL reviewer modified the payload before approving |

**Pre-check (ALL `do` commands):** Valid token must exist (`~/.config/link-proxy/token.json` or `LINKEDIN_ACCESS_TOKEN`). If missing/expired, returns an error envelope with hint `link-proxy admin auth login`.

**Autosave:** every `do` execution writes `/tmp/link-proxy-autosave/{action}_{YYYYmmdd_HHMMSS}.json`.

---

## Actions — FLAT, ONE level after `do` (10 active + 6 disabled)

Naming convention: **`<domain>-<verb>`, kebab-case, domain FIRST.** All `linkedin-mcp` `verb_noun` names are flipped.

### Profile (2)

| Action | Source tool (`linkedin-mcp`) | Auth | HITL | Notes |
|--------|------------------------------|:----:|:----:|-------|
| `profile-get` | `linkedin_get_profile` | REST | ❌ | Fetch own profile (name, email, sub, picture, locale) via OIDC `/v2/userinfo` |
| `profile-status` | `linkedin_auth_status` | Local | ❌ | Token presence, validity, days remaining, member info |

### Posts (4 active + 3 disabled)

| Action | Source tool | Auth | HITL | Status | Notes |
|--------|-------------|:----:|:----:|:------:|-------|
| `post-create` | `linkedin_create_post` | REST | ✅ | ✅ | Publish text post (`PUBLIC` or `CONNECTIONS`) |
| `post-create-image` | `linkedin_create_image_post` | REST | ✅ | ✅ | Upload single image + publish post |
| `post-create-article` | *(new)* | REST | ✅ | ✅ | Share external URL with rich OG preview card (`ARTICLE`) |
| `post-create-full` | *(new)* | REST | ✅ | ✅ | Rich post: unlimited images/videos + optional URL + custom OG card |
| `post-delete` | `linkedin_delete_post` | REST | ✅ | 🚫 | **Disabled** — preflight GET is 403 on personal tokens |
| `post-get` | *(new)* | REST | ❌ | 🚫 | **Disabled** — `ugcPosts.GET` is 403 on personal tokens |
| `post-list` | *(new)* | REST | ❌ | 🚫 | **Disabled** — `ugcPosts.FINDER-authors` is 403, org-only |

### Social (3 active + 3 disabled)

| Action | Source tool | Auth | HITL | Status | Notes |
|--------|-------------|:----:|:----:|:------:|-------|
| `post-like` | `linkedin_like_post` | REST | ✅ | ✅ | Like a post by URN (own or third-party, no discovery) |
| `comment-create` | `linkedin_create_comment` | REST | ✅ | ✅ | Add comment to a post |
| `comment-reply` | *(new)* | REST | ✅ | ✅ | Reply to a specific comment (nested/threaded); requires `encodePath()` for compound URNs |
| `post-react` | *(new)* | REST | ✅ | 🚫 | **Disabled** — server rejects typed reactions (`Unpermitted fields [/reactionType]`) |
| `comment-list` | *(new)* | REST | ❌ | 🚫 | **Disabled** — `socialActions.GET_ALL` is 403 on personal tokens |
| `comment-delete` | *(new)* | REST | ✅ | 🚫 | **Disabled** — DELETE is 404 on all path variants |

### Raw API (1)

| Action | Source tool | Auth | HITL | Notes |
|--------|-------------|:----:|:----:|-------|
| `raw` | *(new)* | REST | ✅ | Direct HTTP REST gateway (`GET`/`POST`/`DELETE`/`PUT`) to LinkedIn API |

### Action Summary

| Group | Active | Disabled | Total |
|-------|-------:|---------:|------:|
| Profile | 2 | 0 | 2 |
| Posts | 4 | 3 | 7 |
| Social | 3 | 3 | 6 |
| Raw API | 1 | 0 | 1 |
| **TOTAL** | **10** | **6** | **16** |

> 🚫 Disabled actions are **commented out** (block-commented in `posts.ts`/`social.ts`, line-commented in `policies.ts`).
> Code is preserved for re-enablement if LinkedIn changes API scope permissions.

---

## HITL — Two-Template Routing

Mirrors `whats-proxy` (`hitl.html` vs `message-review.html`). Routing is explicit via `POST_ACTIONS` allowlist in `hitl.ts`.

| Template | Serves | Features |
|----------|--------|----------|
| `post-review.html` | `post-create`, `post-create-image`, `post-create-article`, `post-create-full`, `comment-create`, `comment-reply` | Full-space textarea (45vh), unicode bold/italic toolbar, LinkedIn char counter (/3000), visibility select, article URL/title/description fields, dynamic `media[]` rows with local/HTTP previews, live LinkedIn-like preview card, raw JSON two-way sync |
| `hitl.html` | `post-like`, `post-react`, `comment-delete`, `raw`, etc. | Compact review: 🎯 Target summary (identity fields highlighted, 🔒 locked), full-width raw JSON, reviewer comment |

Server protocol (`requestApproval` → `handlePost` → `resolve`) is **identical** for both templates.

### HITL Submit Logging (v0.1.6+)

Every HITL submit logs: `HITL submit '<action>': decision=<approve|reject> keys=[...] media=N`.
This isolates editor-side issues (media count mismatch) from upload-side issues.

---

## Safety Model

`src/link_proxy/actions/policies.ts` is the **single executable safety contract**.

| Protection | Mechanism | Applies to |
|---|---|---|
| **Approval** | Local editable browser review, port `0`, 600-second fail-closed timeout | All 10 active actions with `hitl: "always"` |
| **Preflight** | Pre-read target URN before review, then lock identity field | *(Currently disabled — `post-delete` and `comment-delete` preflights are blocked by 403/404)* |

### HITL Policies (active)

| Action | HITL | Preflight | Identity Fields |
|--------|:----:|:---------:|-----------------|
| `profile-get` | never | — | — |
| `profile-status` | never | — | — |
| `post-create` | always | — | — |
| `post-create-image` | always | — | — |
| `post-create-article` | always | — | — |
| `post-create-full` | always | — | — |
| `post-like` | always | — | — |
| `comment-create` | always | — | — |
| `comment-reply` | always | — | — |
| `raw` | always | — | — |

---

## Configuration

Defaults live in `config.ts`. Overridable via environment variables:

| Env Var | Purpose | Default |
|---------|---------|---------|
| `LINKEDIN_CLIENT_ID` | OAuth Client ID | `""` |
| `LINKEDIN_CLIENT_SECRET` | OAuth Client Secret | `""` |
| `LINKEDIN_ACCESS_TOKEN` | Direct Access Token override | `""` |
| `LINKEDIN_CONFIG_DIR` | State and config directory | `~/.config/link-proxy/` |

---

## Known Limitations (LinkedIn API Personal Developer Accounts)

> LinkedIn enforces strict permission boundaries on personal developer apps (non-organization accounts).
> These limitations are **inherent to LinkedIn's API policy**, not bugs in `link-proxy`.

### Read Operations — All Restricted

| Action | Endpoint | Status | Reason |
|--------|----------|--------|--------|
| `post-list` | `GET /v2/ugcPosts?q=authors` | ❌ **403** | `ugcPosts.FINDER-authors` requires organization-level access (`rw_organization_social`). |
| `post-get` | `GET /v2/ugcPosts/{id}` | ❌ **403** | `ugcPosts.GET` rejected on personal tokens. |
| `comment-list` | `GET /v2/socialActions/{urn}/comments` | ❌ **403** | `socialActions.GET_ALL` rejected on personal tokens. |
| `GET /v2/me` | `GET /v2/me` | ❌ **403** | Deprecated for personal developer accounts. `profile-get` uses OIDC `/v2/userinfo` instead. |

### Write Operations — Live Matrix (verified 2026-09-05)

> Web-confirmed: (1) LinkedIn exposes **no API for native long-form articles** — `ARTICLE` category is a link share with OG card. Automation of native articles would violate ToS. (2) `w_member_social` acts **as the authenticated member** — likes/comments/replies can target **any known post URN** (own or third-party); no discovery endpoint exists. (3) `ugcPosts` is deprecated upstream in favor of `/rest/posts` — migration TBD.

| Action | Endpoint | Status |
|--------|----------|--------|
| `post-create` | `POST /v2/ugcPosts` | ✅ |
| `post-create-image` | `POST /v2/assets` + `POST /v2/ugcPosts` | ✅ — sequential register+PUT upload pipeline |
| `post-create-article` + `url` | `POST /v2/ugcPosts` (`ARTICLE`) | ✅ — link share with OG card, NOT native article |
| `post-create-full` + `media[]` | sequential asset upload + `POST /v2/ugcPosts` | ✅ — multi-image carousel (verified 3 assets) |
| `post-like` | `POST /v2/socialActions/{urn}/likes` | ✅ |
| `comment-create` | `POST /v2/socialActions/{urn}/comments` | ✅ |
| `comment-reply` | `POST /v2/socialActions/{commentUrn}/comments` | ✅ — requires `encodePath()` for `()` in URNs |
| `post-delete` | `DELETE /v2/ugcPosts/{id}` | ⚠️ Unusable — preflight GET is 403 |
| `post-react` (typed) | `POST /v2/socialActions/{urn}/likes` | ❌ — server rejects `reactionType`, `reactableUrn`, `reactedEntity` |
| `comment-delete` | `DELETE /v2/socialActions/{commentUrn}` | ❌ **404** on all path variants |

### OAuth Callback Port

The OAuth callback server uses port `38421` by default (configurable in the HITL form).
This port **must be registered** as an authorized redirect URI in the LinkedIn Developer Console:
```
http://localhost:38421/callback
```

### Token Lifespan

Personal LinkedIn developer tokens expire after **60 days**. No refresh token is issued.
Re-authentication via `link-proxy admin auth login` is required every 60 days.

---

## Version History (highlights)

| Version | Date | Key Changes |
|---------|------|-------------|
| 0.1.6 | 2026-09-05 | 6 impossible actions disabled (commented, code kept); `rawEl` hoisting bug fixed (media rows lost); `collectEditor` extra-keys injection fixed (`'key' in ORIGINAL` guard); HITL split into 2 templates; `encodePath()` for compound URNs; `comment-delete` path corrected; `PostCreateFullSchema` `url` union fix; HITL submit logging; CONTRACT live matrix |
| 0.1.3 | 2026-09-03 | `post-create-full`: rich multi-media upload |
| 0.1.2 | 2026-09-03 | `post-create-article`, `post-react`, `comment-reply` |
| 0.1.1 | 2026-09-03 | Full E2E: 12 actions, HITL, OAuth PKCE, autosave |

---

## Status

- See `AGENTS.md` for agent working context.
- See `CHANGELOG.md` for full version history.
- See `README.md` for user-facing documentation.

*Architecture contract drafted 2026-09-03 — rewrite of `linkedin-mcp` (8 MCP tools) into `link-proxy` (16 flat RPC actions, 10 active).*
