/**
 * link-proxy — Human-in-the-Loop Web UI server.
 *
 * Launches a temporary HTTP server on an OS-assigned free port (127.0.0.1:0)
 * to allow human review, editing, and approval before destructive or posting actions.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { logInfo, logError } from "./logger.ts";

export interface HitlReviewRequest<T = Record<string, unknown>> {
  action: string;
  payload: T;
  lockedFields?: string[];
  instructions?: string;
}

export interface HitlReviewResponse<T = Record<string, unknown>> {
  approved: boolean;
  comment?: string;
  editedPayload?: T;
  status: "approved" | "rejected";
  edited: boolean;
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd = `xdg-open "${url}"`;
  if (platform === "darwin") cmd = `open "${url}"`;
  if (platform === "win32") cmd = `start "" "${url}"`;
  exec(cmd, (err) => {
    if (err) logError(`Failed to auto-open browser: ${err.message}`);
  });
}

function getTemplatePath(fileName: string): string {
  const dir = path.join(import.meta.dirname || __dirname, "templates");
  return path.join(dir, fileName);
}

function loadCss(): string {
  try {
    return fs.readFileSync(getTemplatePath("hitl.css"), "utf-8");
  } catch {
    return "";
  }
}

/**
 * Template routing (mirrors whats-proxy: `hitl.html` vs `message-review.html`).
 * Actions that compose user-visible text get the full post editor;
 * everything else (likes, deletes, raw…) gets the compact JSON review.
 */
const POST_ACTIONS = new Set([
  "post-create",
  "post-create-image",
  "post-create-article",
  "post-create-full",
  "comment-create",
  "comment-reply",
]);

function renderHtml(action: string, payload: Record<string, unknown>, lockedFields: string[]): string {
  const css = loadCss();
  let templateName = "hitl.html";
  if (action === "admin auth login") templateName = "auth_login.html";
  else if (POST_ACTIONS.has(action)) templateName = "post-review.html";
  const templatePath = getTemplatePath(templateName);

  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace("{{CSS_STYLES}}", css);
  html = html.replace(/{{ACTION}}/g, action);
  html = html.replace("{{PAYLOAD_JSON}}", JSON.stringify(payload));
  html = html.replace("{{LOCKED_FIELDS_JSON}}", JSON.stringify(lockedFields));

  return html;
}

export function requestApproval<T extends Record<string, unknown>>(
  req: HitlReviewRequest<T>
): Promise<HitlReviewResponse<T>> {
  return new Promise((resolve) => {
    const lockedFields = req.lockedFields || [];
    let server: http.Server;

    const timeout = setTimeout(() => {
      if (server) server.close();
      resolve({
        approved: false,
        comment: "HITL review timed out (600s fail-closed)",
        editedPayload: req.payload,
        status: "rejected",
        edited: false,
      });
    }, 600_000);

    server = http.createServer((httpReq, res) => {
      if (httpReq.method === "GET" && httpReq.url === "/") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(renderHtml(req.action, req.payload, lockedFields));
        return;
      }

      if (httpReq.method === "POST" && httpReq.url === "/submit") {
        let body = "";
        httpReq.on("data", (chunk) => { body += chunk; });
        httpReq.on("end", () => {
          clearTimeout(timeout);
          let decision = "reject";
          let comment = "";
          let payloadRaw = "";

          try {
            const parsedBody = JSON.parse(body);
            const statusVal = String(parsedBody.status || parsedBody.decision || "").toLowerCase();
            decision = (statusVal === "approved" || statusVal === "approve") ? "approve" : "reject";
            comment = parsedBody.comment || "";
            if (parsedBody.payload) {
              payloadRaw = typeof parsedBody.payload === "string" ? parsedBody.payload : JSON.stringify(parsedBody.payload);
            }
          } catch {
            const params = new URLSearchParams(body);
            const decVal = String(params.get("decision") || "").toLowerCase();
            decision = (decVal === "approved" || decVal === "approve") ? "approve" : "reject";
            comment = params.get("comment") || "";
            payloadRaw = params.get("payload") || "";
          }

          try {
            const dbg = JSON.parse(payloadRaw || "{}") as Record<string, unknown>;
            const dbgMedia = (dbg as { media?: unknown }).media;
            logInfo(`HITL submit '${req.action}': decision=${decision} keys=[${Object.keys(dbg).join(",")}] media=${Array.isArray(dbgMedia) ? dbgMedia.length : 0}`);
          } catch { /* best-effort diagnostics */ }

          let editedPayload = req.payload;
          let edited = false;

          if (payloadRaw) {
            try {
              const parsed = JSON.parse(payloadRaw);
              // Re-enforce locked fields
              for (const lockedKey of lockedFields) {
                if (req.payload[lockedKey] !== undefined) {
                  parsed[lockedKey] = req.payload[lockedKey];
                }
              }
              if (JSON.stringify(parsed) !== JSON.stringify(req.payload)) {
                edited = true;
              }
              editedPayload = parsed;
            } catch {
              editedPayload = req.payload;
            }
          }

          const approved = decision === "approve" || decision === "approved";
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`<h2>Request ${approved ? "Approved" : "Rejected"}!</h2><p>You can close this window now.</p>`);
          server.close();

          resolve({
            approved,
            comment,
            editedPayload,
            status: approved ? "approved" : "rejected",
            edited,
          });
        });
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as { port: number };
      const url = `http://127.0.0.1:${address.port}/`;
      logInfo(`HITL review required for '${req.action}'. Opening ${url}`);
      openBrowser(url);
    });
  });
}
