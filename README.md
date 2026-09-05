# link-proxy

Non-MCP CLI proxy for LinkedIn — 10 flat JSON-RPC actions over official LinkedIn REST v2 API (`openid profile email w_member_social`). Follows the exact proxy architecture of [`whats-proxy`](../whats-proxy/) and [`tick-proxy`](../tick-proxy/).

Built with **Bun** + **TypeScript** + **Zod**: `meta`+`data` envelope, `do`/`admin` namespaces, `--format json|table`, `--output-file`, autosave, declarative mandatory HITL, and destructive preflight identity locks.

## Why

`linkedin-mcp` is an MCP server — useful inside MCP hosts, useless in a shell. `link-proxy` turns the same catalog into a **solo CLI**:

```bash
link-proxy do post-create '{"text":"Hello from the shell!","visibility":"PUBLIC"}'
link-proxy do profile-get
link-proxy do post-create-article '{"text":"Good read","url":"https://bun.sh"}'
```

No MCP runtime required. One binary, full catalog.

## Install

```bash
make install
```

Requires [Bun](https://bun.sh) >= 1.1.

## First run — pairing / authentication

```bash
link-proxy admin auth login          # Interactive HITL web form (credentials, client ID/secret, OAuth consent)
link-proxy admin auth status         # Check token status, days remaining, member details
link-proxy admin auth logout         # Clear stored token (HITL-confirmed)
link-proxy admin status              # System status, reachability probes, permissions check
link-proxy admin doctor              # Auto-fix permissions (0700 dir, 0600 token file)
link-proxy admin purge               # Delete config and token directory (HITL-confirmed)
```

Session credentials live in `~/.config/link-proxy/token.json` — protected with `0600` permissions.

## Usage

```
link-proxy do <action> [payload|file] [-o file] [-f json|table] [-h]
link-proxy admin auth login | status | logout
link-proxy admin status
link-proxy admin doctor
link-proxy admin purge
link-proxy --version
```

- **`do`** — dispatch an action. `payload` is a JSON string or a path to a JSON file.
- **`do <action> -h -f json`** — machine-readable per-action help (Zod schema from registry).
- **`admin`** — auth lifecycle and diagnostics. Always JSON output; refuses `-f`/`-o` (exit 2).
- Every response is an envelope: `{ "meta": { "status": "ok"|"error", "comment": "", "edited": false }, "data": {...} }`.
- Errors exit `1` with the envelope on stderr. Autosave writes each call to `/tmp/link-proxy-autosave/`.

### Table format

```bash
link-proxy do profile-get -f table
+-------------------+----------------------------+
| Field             | Value                      |
+-------------------+----------------------------+
| name              | Ivann KAMDEM               |
| email             | kapoivha@gmail.com         |
| sub               | urn:li:person:abcdef1234   |
+-------------------+----------------------------+
```

## Actions (10 — 6 impossible ones disabled 2026-09-05, code kept in place)

| Category | Count | Actions |
|---|---:|---|
| Profile | 2 | profile-get, profile-status |
| Posts | 4 | post-create, post-create-image, post-create-article, post-create-full |
| Social | 3 | post-like, comment-create, comment-reply |
| Raw API | 1 | raw |
| **TOTAL** | **10** | |

> 🚫 Disabled (commented, not deleted): `post-delete` (preflight GET 403), `post-get` (GET 403), `post-list` (FINDER 403), `post-react` (typed reactions rejected), `comment-list` (GET_ALL 403), `comment-delete` (DELETE 404). See `CONTRACT.md` § Known Limitations.

Run `link-proxy do --help` for the live catalog; `link-proxy do <action> -h` for per-action help.

## Development

```bash
bun install
make check       # tsc --noEmit + bun test + smoke
make test        # unit tests only
make smoke       # end-to-end isolated smoke
```

## Contract

[`CONTRACT.md`](CONTRACT.md) is the authoritative implementation contract — safety, envelope, OAuth lifecycle, and catalog surface.

## License

MIT
