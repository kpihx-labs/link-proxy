# Changelog

All notable changes to `link-proxy` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-09-05

### Removed (disabled, code kept)
- 6 actions impossible on personal tokens commented out of the CLI (defs block-commented in `posts.ts`/`social.ts`, policies line-commented, registry auto-shrinks): `post-delete` (preflight GET 403), `post-get` (GET 403), `post-list` (FINDER-authors 403), `post-react` (server rejects `reactionType`), `comment-list` (`socialActions.GET_ALL` 403), `comment-delete` (DELETE 404 on all path variants). Live catalog: **10 actions**. Adjusted everywhere: `doc.ts` counts, `README.md` table + example, `CONTRACT.md` limitations header, `smoke.test.ts` (10 + expected list).

## [0.1.5] - 2026-09-05

### Added
- Split HITL into two templates, mirroring `whats-proxy` (`hitl.html` vs `message-review.html`): `post-review.html` (full post editor) serves only text-composing actions (`post-create*`, `comment-create`, `comment-reply`); `hitl.html` is back to a compact generic JSON review with identity target summary for the rest (`post-like`, `post-react`, `post-delete`, `comment-delete`, `raw`). Routing via explicit `POST_ACTIONS` allowlist in `hitl.ts`; server protocol unchanged.
- `encodePath()` in `client.ts`: RFC3986 path encoding for compound URNs (`urn:li:comment:(…)` — `encodeURIComponent` leaves `( )` unescaped → LinkedIn 400). Fixes `comment-reply`.

### Fixed
- `post-react`: replaced unpermitted `reactableUrn`/`reactedEntity` body with docs-correct `{actor, object, reactionType}`.
- `comment-delete`: wrong path `/v2/socialActions/comments/{id}` → `/v2/socialActions/{commentUrn}`.
- `PostCreateFullSchema`: `url` default `""` rejected by `.url()` → `union(url, "")`.
- Self-recursion guard: `encodePath` helper keeps its own inner `encodeURIComponent`.

### Verified (live 2026-09-05, CONNECTIONS)
- ✅ `post-create`, `post-create-image`, `post-create-article`, `post-create-full`, `post-like`, `comment-create`, `comment-reply`.
- ❌ Reads (`post-get`, `post-list`, `comment-list` → 403), typed reactions (server rejects `reactionType`), `comment-delete` (404, all variants), `post-delete` (preflight GET 403). `CONTRACT.md` Known Limitations updated with the live matrix.
- ⚠️ `post-create-full` 3-image publish yielded 1 asset (under diagnosis — HITL submit logging added).
- Web-confirmed: no API for native LinkedIn long-form articles (`ARTICLE` = link share); `w_member_social` acts as the member and can target any known post URN (no discovery endpoint); `ugcPosts` deprecated upstream in favor of `/rest/posts` (migration TBD).

## [0.1.4] - 2026-09-05

### Fixed
- HITL `hitl.html` rewritten as a real full-space editor (ported from `whats-proxy` `message-review.html`): giant `text` textarea (45vh), unicode bold/italic toolbar, live LinkedIn char counter (3000), visibility select, article URL/title/description fields, dynamic `media[]` rows with http previews, live LinkedIn-like preview card, raw JSON always visible with two-way sync. Server protocol unchanged (`hitl.ts` untouched).

## [0.1.3] - 2026-09-03

### Added
- `post-create-full`: Rich post creation with unlimited multi-media (images + videos) upload, optional URL with custom OG card, and per-media alt_text/title.
- Client method `createFullPost()` with sequential 2-step register+PUT upload pipeline.
- Private helper `_uploadMedia()` for individual asset registration and binary transfer.
- `PostCreateFullSchema` with Zod validation for media array: `[{type, path, alt_text?, title?}]`.
- `CONTRACT.md` updated: 16 actions total (7 Posts, 6 Social).

## [0.1.2] - 2026-09-03

### Added
- `post-create-article`: Share external URLs with rich Open Graph preview cards (`shareMediaCategory: "ARTICLE"`).
- `post-react`: React to posts with specific types (LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT).
- `comment-reply`: Nested/threaded replies to specific comments.
- New client methods: `createArticlePost()`, `reactToPost()`, `replyToComment()`.
- New Zod schemas: `PostCreateArticleSchema`, `PostReactSchema`, `CommentReplySchema`.
- New HITL policies for all 3 new actions.
- `CONTRACT.md` updated: 15 actions total (6 Posts, 6 Social).

## [0.1.1] - 2026-09-03

### Added
- Full end-to-end implementation: `LinkedInClient` REST v2 API client, HITL web UI, 12 action handlers, CLI dispatcher.
- OAuth 2.0 PKCE flow with dynamic port binding and `EADDRINUSE` error handling.
- Token persistence (`~/.config/link-proxy/token.json`, `0600`) and masked credential pre-fill in auth form.
- Docstring-driven `--help` system ported from `whats-proxy` / `tick-proxy` (2 examples per action).
- High-quality HITL templates (`auth_login.html`, `hitl.html`) with `mail-proxy` CSS palette.
- Default OAuth callback port changed to `38421` (low collision probability).
- `CONTRACT.md` § Known Limitations: documented LinkedIn personal developer account API restrictions (`post-list` 403, `/v2/me` 403, token 60-day expiry).

### Verified
- `profile-get`: ✅ OIDC profile fetch (`/v2/userinfo`) — name, email, sub, locale, picture.
- `profile-status`: ✅ Token validity check — 59 days remaining.
- `post-create`: ✅ Text post creation via `POST /v2/ugcPosts` (HITL-gated).
- `post-list`: ❌ LinkedIn 403 — `ugcPosts.FINDER-authors` restricted to organization accounts.
- `make check`: 100% green (`tsc --noEmit` + 14 tests + runtime smoke).

## [0.1.0] - 2026-09-03

### Added
- Initial project skeleton for `link-proxy` non-MCP LinkedIn CLI proxy.
- Architecture contract (`CONTRACT.md`) defining 12 flat RPC actions (`profile-*`, `post-*`, `comment-*`, `raw`).
- Full specification of single binary CLI with `do` and `admin` namespaces.
- Declarative HITL and preflight identity lock safety model.
- Complete `Makefile`, `package.json`, `tsconfig.json`, `README.md`, `AGENTS.md`.
- Pure TypeScript placeholder structure in `src/link_proxy/`.
