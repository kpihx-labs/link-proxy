# TODO — link-proxy

## Skeleton Phase
- [x] Complete `CONTRACT.md` architecture contract (12 actions, envelope, OAuth flow, HITL, preflight).
- [x] Complete `README.md`, `Makefile`, `package.json`, `tsconfig.json`, `AGENTS.md`.
- [x] Create clean TypeScript file placeholders in `src/link_proxy/`.

## Implementation Phase (P0-P8)
- [ ] P0: Wire `version.ts`, `config.ts`, `exceptions.ts`, `types.ts`, `logger.ts`, `helpers.ts`.
- [ ] P1: Implement low-level `LinkedInClient` in `client.ts` wrapping v2 REST API (userinfo, ugcPosts, socialActions).
- [ ] P2: Implement `hitl.ts` (local HTTP review page) and `admin/auth.ts`, `admin/status.ts`.
- [ ] P3: Implement action definitions and Zod schemas (`schemas.ts`, `policies.ts`, `registry.ts`).
- [ ] P4: Wire `cli.ts`, `doc.py` dynamic help, `display.ts`, and `index.ts`.
- [ ] P5: Implement `post-*`, `profile-*`, `comment-*`, `raw` action handlers.
- [ ] P6: Write comprehensive unit tests and smoke tests (`tests/`).
- [ ] P7: Verify `make check` passes 100%.
