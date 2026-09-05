/**
 * link-proxy — Docstring-based help rendering.
 *
 * Direct port of whats-proxy / tick-proxy dynamic help engine.
 * Reads a `docstring` field from ActionDef and renders it into compact
 * (catalog overview) and full (per-action --help) help text.
 * The `→` output example lines are auto-wrapped in the meta+data envelope.
 */

import type { ActionDef } from "./types.ts";
import { REGISTRY } from "./actions/registry.ts";
import { VERSION } from "./version.ts";

/**
 * Compact help for catalog: everything before the "Examples:" line.
 */
export function getCompactHelp(def: ActionDef): string {
  const doc = def.docstring || def.description || "";
  const parts = doc.split(/\n\s*Examples:\s*\n/i);
  return parts[0]!.trim();
}

/**
 * Wrap a `→ {json}` example line in the meta+data envelope.
 */
function wrapOutput(line: string): string {
  const m = line.match(/^( *→\s*)(.*)/);
  if (!m) return line;
  const arrow = m[1]!;
  const content = m[2]!.trim();
  try {
    const data = JSON.parse(content);
    const wrapped = JSON.stringify(
      {
        meta: { status: "ok", comment: "", edited: false },
        data,
      },
      null,
      2
    );
    return `${arrow}${wrapped}`;
  } catch {
    return line;
  }
}

/**
 * Full help for per-action --help: full docstring with → lines wrapped in envelope.
 */
export function getFullHelp(def: ActionDef): string {
  const doc = def.docstring || def.description || "";
  const wrapped = doc.split("\n").map(wrapOutput).join("\n");
  const hasArgs = (def.meta?.arguments?.length || 0) > 0;
  const usage = hasArgs
    ? `Usage:\n  link-proxy do ${def.meta?.action || def.name} [payload|file] [-o file] [-f json|table]\n`
    : `Usage:\n  link-proxy do ${def.meta?.action || def.name} [-f json|table]\n`;
  return usage + "\n" + wrapped;
}

/**
 * Compact catalog help: one line per action grouped by category.
 */
export function getCatalogHelp(): string {
  const lines: string[] = [
    "For detailed information and examples on a specific action, run:",
    "  link-proxy do <action> --help\n",
  ];

  const byCategory = new Map<string, string[]>();
  for (const [name, def] of REGISTRY.entries()) {
    const cat = def.meta?.category || def.group || "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(name);
  }

  for (const [cat, names] of [...byCategory.entries()].sort()) {
    lines.push(`\x1b[1;35m── ${cat} ──\x1b[0m`);
    for (const name of names.sort()) {
      const def = REGISTRY.get(name)!;
      lines.push(`\x1b[1;36m${name}\x1b[0m`);
      const compact = getCompactHelp(def);
      if (compact) {
        for (const l of compact.split("\n")) {
          lines.push(l);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function printGeneralHelp(): void {
  console.log(`link-proxy v${VERSION} — Non-MCP LinkedIn CLI Proxy (RPC + Admin)

Usage:
  link-proxy do <action> [payload|file] [-o file] [-f json|table] [-h]
  link-proxy do --help                                  # Full 10-action catalog
  link-proxy do <action> --help                         # Action-specific help & schema
  link-proxy admin doctor                               Fix permissions + create missing dirs
  link-proxy admin setup                                Install service + config
  link-proxy admin status                               Full installation status
  link-proxy admin purge                                Remove everything
  link-proxy admin auth login                           Interactive Web HITL form for credentials
  link-proxy admin auth status                          Token presence & member status
  link-proxy admin auth logout                          Clear stored token
  link-proxy --version

Key Namespaces:
  do       RPC Actions — 10 flat JSON-RPC actions (profile, posts, social, raw)
  admin    Admin Commands — Auth lifecycle, system health, doctor & purge (ALWAYS JSON stdout)

For the full catalog of 10 RPC actions, run:
  link-proxy do --help`);
}

export function printAdminHelp(): void {
  console.log(`Usage:
  link-proxy admin doctor                               Fix permissions + create missing dirs
  link-proxy admin setup                                Install service + config
  link-proxy admin status                               Full installation status
  link-proxy admin purge                                Remove everything
  link-proxy admin auth login|status|logout`);
}

export function printAdminAuthHelp(): void {
  console.log(`Usage:
  link-proxy admin auth login                           Launch interactive HITL Web form pre-filled with credentials
  link-proxy admin auth status                          Inspect token status, expiration countdown, member URN
  link-proxy admin auth logout                          Remove stored access token (token.json)`);
}

export function printAdminSubHelp(sub: string): void {
  switch (sub) {
    case "login":
      console.log(`Usage:
  link-proxy admin auth login                           Launch interactive HITL Web form pre-filled with credentials

Launches local HTTP review server (127.0.0.1:0) and opens browser.
Collects client_id, client_secret, auth_mode (oauth2 | direct_token), and access_token.
Pre-loads existing masked credentials. Executes GET /v2/userinfo profile probe before saving.`);
      break;

    case "auth-status":
      console.log(`Usage:
  link-proxy admin auth status                          Inspect token status, expiration countdown, member URN

Reports token validity, days remaining until 60-day expiration, member name/email/URN,
and masked client credentials.`);
      break;

    case "logout":
      console.log(`Usage:
  link-proxy admin auth logout                          Remove stored access token (token.json)

Prompts for HITL confirmation and deletes ~/.config/link-proxy/token.json.`);
      break;

    case "status":
      console.log(`Usage:
  link-proxy admin status                               Full installation status

Comprehensive diagnostic tool checking:
  - Configuration directory & file existence + POSIX permissions (0700 / 0600)
  - Live REST v2 API probe (GET /v2/userinfo)
  - Member account identity & token expiration
  - Binary executable path`);
      break;

    case "doctor":
      console.log(`Usage:
  link-proxy admin doctor                               Fix permissions + create missing dirs

Audit & auto-repair tool for link-proxy:
  - Auto-creates ~/.config/link-proxy if missing (chmod 0700)
  - Auto-fixes file permissions for .env and token.json (chmod 0600)`);
      break;

    case "purge":
      console.log(`Usage:
  link-proxy admin purge                                Remove everything

Prompts for HITL confirmation and deletes ~/.config/link-proxy configuration directory.`);
      break;

    default:
      printAdminHelp();
      break;
  }
}
