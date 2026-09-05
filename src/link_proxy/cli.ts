/**
 * link-proxy — CLI Command Dispatcher & Runtime Gateway.
 *
 * Direct port of whats-proxy / tick-proxy CLI argument dispatcher.
 */

import fs from "node:fs";
import path from "node:path";
import { REGISTRY } from "./actions/registry.ts";
import { POLICIES } from "./actions/policies.ts";
import { printJson, printTable } from "./display.ts";
import {
  printGeneralHelp,
  getCatalogHelp,
  getFullHelp,
  printAdminHelp,
  printAdminAuthHelp,
  printAdminSubHelp,
} from "./doc.ts";
import { buildErrorEnvelope, buildOkEnvelope } from "./helpers.ts";
import { VERSION } from "./version.ts";
import { loadConfig } from "./config.ts";
import { LinkedInClient } from "./client.ts";
import { requestApproval } from "./hitl.ts";
import { adminAuthLogin, adminAuthStatus, adminAuthLogout } from "./admin/auth.ts";
import { adminStatus, adminDoctor, adminPurge } from "./admin/status.ts";
import type { OutputEnvelope } from "./types.ts";

function saveAutosave(action: string, envelope: OutputEnvelope): void {
  try {
    const dir = "/tmp/link-proxy-autosave";
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").replace("T", "_").replace(/\..+/, "");
    const filePath = path.join(dir, `${action}_${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2) + "\n", "utf-8");
  } catch {
    // Best-effort autosave
  }
}

function parsePayload(rawArg?: string): Record<string, unknown> {
  if (!rawArg) return {};
  const trimmed = rawArg.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid inline JSON payload: ${rawArg}`);
    }
  }

  if (fs.existsSync(trimmed)) {
    try {
      const content = fs.readFileSync(trimmed, "utf-8");
      return JSON.parse(content);
    } catch (err: any) {
      throw new Error(`Failed to parse payload file '${trimmed}': ${err.message}`);
    }
  }

  throw new Error(`Payload '${rawArg}' is neither valid JSON nor an existing file path`);
}

// ── `do` command ─────────────────────────────────────────────────────────────

async function cmdDo(argv: string[]): Promise<number> {
  let action: string | undefined;
  let payload: string | undefined;
  let outputFile: string | undefined;
  let fmt: "json" | "table" = "json";
  let fmtExplicit = false;
  let help = false;

  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift()!;
    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "-o" || arg === "--output-file") {
      const v = rest.shift();
      if (!v || v.startsWith("-")) {
        printJson(buildErrorEnvelope("Option -o/--output-file requires a file path."));
        return 2;
      }
      outputFile = v;
    } else if (arg === "-f" || arg === "--format") {
      const v = rest.shift();
      if (!v || v.startsWith("-")) {
        printJson(buildErrorEnvelope("Option -f/--format requires a format (json|table)."));
        return 2;
      }
      fmt = v === "table" ? "table" : "json";
      fmtExplicit = true;
    } else if (arg.startsWith("-")) {
      printJson(buildErrorEnvelope(`Unknown option: ${arg}`));
      return 2;
    } else if (!action) {
      action = arg;
    } else if (!payload) {
      payload = arg;
    } else {
      printJson(buildErrorEnvelope(`Too many arguments: ${arg}`));
      return 2;
    }
  }

  // No action / --help at the `do` level → compact catalog help or per-action help
  if (!action || help) {
    if (action && help) {
      const def = REGISTRY.get(action);
      if (fmtExplicit && fmt === "json") {
        printJson(
          def
            ? buildOkEnvelope({
                action: def.meta?.action || def.name,
                category: def.meta?.category || def.group,
                description: def.meta?.description || def.description,
                arguments: def.meta?.arguments || [],
                returns: def.meta?.returns || "",
              })
            : buildErrorEnvelope(`Unknown action: ${action}.`)
        );
      } else {
        if (!def) {
          printJson(buildErrorEnvelope(`Unknown action: ${action}. Hint: Run 'link-proxy do --help' for catalog.`));
          return 1;
        }
        process.stdout.write(getFullHelp(def) + "\n");
      }
      return 0;
    }
    process.stdout.write(getCatalogHelp() + "\n");
    return 0;
  }

  const def = REGISTRY.get(action);
  if (!def) {
    printJson(buildErrorEnvelope(`Unknown action: ${action}. Hint: Run 'link-proxy do --help' for catalog.`));
    return 1;
  }

  // Token Pre-check
  const config = loadConfig();
  if (!config.accessToken && action !== "profile-status") {
    printJson(buildErrorEnvelope("Not authenticated. Run 'link-proxy admin auth login' to authenticate."));
    return 1;
  }

  let argsObj: Record<string, unknown> = {};
  try {
    argsObj = parsePayload(payload);
  } catch (err: any) {
    printJson(buildErrorEnvelope(err.message));
    return 1;
  }

  // Zod Schema Validation
  if (def.schema) {
    const result = (def.schema as any).safeParse(argsObj);
    if (!result.success) {
      const errorMsg = `Payload validation failed for '${action}': ${result.error.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
      printJson(buildErrorEnvelope(errorMsg));
      return 1;
    }
    argsObj = result.data;
  }

  // Declarative Safety & Preflight
  const policy = POLICIES[action];
  const client = new LinkedInClient(config);

  if (policy?.preflight) {
    try {
      if (action === "post-delete") {
        await client.getPost(String(argsObj.post_urn));
      }
    } catch (err: any) {
      printJson(buildErrorEnvelope(`Preflight target verification failed: ${err.message}`));
      return 1;
    }
  }

  let finalPayload = argsObj;
  let comment = "";
  let edited = false;

  if (policy?.hitl === "always") {
    const review = await requestApproval({
      action,
      payload: argsObj,
      lockedFields: policy.identityFields,
    });

    if (!review.approved) {
      const envelope: OutputEnvelope = {
        meta: { status: "rejected", comment: review.comment, edited: review.edited },
        data: { action, cancelled: true },
      };
      printJson(envelope);
      saveAutosave(action, envelope);
      return 1;
    }

    finalPayload = (review.editedPayload || argsObj) as Record<string, unknown>;
    comment = review.comment || "";
    edited = review.edited;
  }

  try {
    const envelope = await def.handler(finalPayload, { config, client });
    envelope.meta.comment = comment;
    envelope.meta.edited = edited;

    if (outputFile) {
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, JSON.stringify(envelope, null, 2) + "\n", "utf-8");
    }

    if (fmt === "table") {
      printTable(envelope);
    } else {
      printJson(envelope);
    }

    saveAutosave(action, envelope);
    return 0;
  } catch (err: any) {
    const envelope = buildErrorEnvelope(`Action '${action}' failed: ${err.message}`);
    printJson(envelope);
    saveAutosave(action, envelope);
    return 1;
  }
}

// ── `admin` commands ─────────────────────────────────────────────────────────

async function cmdAdmin(argv: string[]): Promise<number> {
  const sub = argv[0];

  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    printAdminHelp();
    return 0;
  }

  if (argv.includes("--format") || argv.includes("-f") || argv.includes("--output-file") || argv.includes("-o")) {
    printJson(buildErrorEnvelope("admin commands do not accept --format/--output-file."));
    return 2;
  }

  if (sub === "auth") {
    const subsub = argv[1];
    const rest = argv.slice(2);

    if (!subsub || subsub === "--help" || subsub === "-h" || subsub === "help") {
      printAdminAuthHelp();
      return 0;
    }

    if (rest.includes("--help") || rest.includes("-h")) {
      printAdminSubHelp(subsub === "status" ? "auth-status" : subsub);
      return 0;
    }

    switch (subsub) {
      case "login": {
        const result = await adminAuthLogin();
        printJson(result);
        return result.meta.status === "error" ? 1 : 0;
      }
      case "status": {
        const result = await adminAuthStatus();
        printJson(result);
        return result.meta.status === "error" ? 1 : 0;
      }
      case "logout": {
        const result = await adminAuthLogout();
        printJson(result);
        return result.meta.status === "error" ? 1 : 0;
      }
      default:
        printJson(
          buildErrorEnvelope(`Unknown admin auth subcommand: ${subsub ?? "(empty)"}`, "", {
            error: `Unknown admin auth subcommand: ${subsub ?? "(empty)"}`,
            usage: "link-proxy admin auth login|status|logout",
          })
        );
        return 2;
    }
  }

  if (sub === "doctor") {
    if (argv.includes("--help") || argv.includes("-h")) { printAdminSubHelp("doctor"); return 0; }
    const result = await adminDoctor();
    printJson(result);
    return result.meta.status === "error" ? 1 : 0;
  }

  if (sub === "status") {
    if (argv.includes("--help") || argv.includes("-h")) { printAdminSubHelp("status"); return 0; }
    const result = await adminStatus();
    printJson(result);
    return result.meta.status === "error" ? 1 : 0;
  }

  if (sub === "purge") {
    if (argv.includes("--help") || argv.includes("-h")) { printAdminSubHelp("purge"); return 0; }
    const result = await adminPurge();
    printJson(result);
    return result.meta.status === "error" ? 1 : 0;
  }

  printJson(
    buildErrorEnvelope(`Unknown admin subcommand: ${sub}`, "", {
      error: `Unknown admin subcommand: ${sub}`,
      usage: "link-proxy admin doctor|status|purge|auth",
    })
  );
  return 2;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function runCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  if (cmd === "--version" || cmd === "-v") {
    printJson(buildOkEnvelope({ version: VERSION }));
    return 0;
  }

  switch (cmd) {
    case "do":
      return cmdDo(rest);
    case "admin":
      return cmdAdmin(rest);
    case "--help":
    case "-h":
    case "help":
    case undefined:
      printGeneralHelp();
      return 0;
    default:
      printJson(
        buildErrorEnvelope(`Unknown command '${cmd}'. Run 'link-proxy --help' for usage.`, "", {
          error: `Unknown command '${cmd}'`,
          usage: "link-proxy do <action> | admin <command>",
        })
      );
      return 2;
  }
}
