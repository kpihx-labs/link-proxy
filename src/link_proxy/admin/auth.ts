/**
 * link-proxy — Admin Auth operations.
 *
 * Single source of truth for authentication lifecycle:
 *   - adminAuthLogin  : opens interactive web HITL page pre-filled with masked credentials
 *   - adminAuthStatus : checks token presence, validity, expiration, member profile
 *   - adminAuthLogout : removes stored token (HITL-confirmed)
 */

import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";
import { buildOkEnvelope, buildErrorEnvelope } from "../helpers.ts";
import type { OutputEnvelope } from "../types.ts";
import {
  loadConfig,
  maskSecret,
  writeEnv,
  writeStoredToken,
  clearStoredToken,
  type StoredToken,
} from "../config.ts";
import { requestApproval } from "../hitl.ts";
import { LinkedInClient } from "../client.ts";
import { logInfo, logError } from "../logger.ts";

const LI_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const DEFAULT_SCOPES = ["openid", "profile", "email", "w_member_social"];

function buildAuthUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: DEFAULT_SCOPES.join(" "),
  });
  return `${LI_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<any> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }
  return data;
}

function runOAuthFlow(clientId: string, clientSecret: string, requestedPort = 0): Promise<any> {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString("hex");
    let server: http.Server;
    let actualPort = 0;
    let redirectUri = "";

    const handleReq = async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${actualPort}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>OAuth Error: ${error}</h2>`);
        server.close();
        return reject(new Error(`OAuth error: ${error}`));
      }

      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Invalid state parameter — CSRF mismatch.</h2>");
        server.close();
        return reject(new Error("State mismatch"));
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>No authorization code received.</h2>");
        server.close();
        return reject(new Error("No code in callback"));
      }

      try {
        const tokenData = await exchangeCode(clientId, clientSecret, code, redirectUri);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>link-proxy authenticated successfully!</h2><p>You can close this tab now.</p>");
        server.close();
        resolve(tokenData);
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h2>Token exchange failed</h2><p>${err.message}</p>`);
        server.close();
        reject(err);
      }
    };

    server = http.createServer(handleReq);

    const onListening = () => {
      actualPort = (server.address() as any).port;
      redirectUri = `http://localhost:${actualPort}/callback`;
      const authUrl = buildAuthUrl(clientId, state, redirectUri);

      logInfo(`OAuth server listening on port ${actualPort}`);
      logInfo(`Opening OAuth authorization URL: ${authUrl}`);

      const cmd = process.platform === "darwin" ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
      exec(cmd, (err) => { if (err) logError(`Failed to open browser: ${err.message}`); });
    };

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE" && requestedPort !== 0) {
        logError(`Port ${requestedPort} is in use. Cannot use a dynamic free port because LinkedIn strictly validates the exact redirect URI. Please free port ${requestedPort} or change it in the form.`);
        reject(new Error(`Port ${requestedPort} in use. LinkedIn OAuth requires a fixed port.`));
      } else {
        reject(err);
      }
    });

    server.listen(requestedPort, "127.0.0.1", onListening);

    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out (5 min)"));
    }, 300_000);
  });
}

export async function adminAuthLogin(): Promise<OutputEnvelope> {
  const currentConfig = loadConfig();

  const currentForm = {
    client_id: currentConfig.clientId ? maskSecret(currentConfig.clientId) : "",
    client_secret: currentConfig.clientSecret ? maskSecret(currentConfig.clientSecret) : "",
    auth_mode: "oauth2",
    access_token: currentConfig.accessToken ? maskSecret(currentConfig.accessToken) : "",
    redirect_port: 38421,
  };

  const review = await requestApproval({
    action: "admin auth login",
    payload: currentForm,
    instructions: "Fill or update LinkedIn Client ID/Secret, choose OAuth2 or direct token mode, then approve.",
  });

  if (!review.approved) {
    return buildErrorEnvelope("Auth login rejected by user", review.comment);
  }

  const values = (review.editedPayload || currentForm) as typeof currentForm;
  let clientId = String(values.client_id || "").trim();
  let clientSecret = String(values.client_secret || "").trim();
  const authMode = String(values.auth_mode || "oauth2").trim();
  const directToken = String(values.access_token || "").trim();
  const port = Number(values.redirect_port) || 38421;

  // Preserve existing secrets if user left masked string intact
  if (clientId.includes("…")) clientId = currentConfig.clientId;
  if (clientSecret.includes("…")) clientSecret = currentConfig.clientSecret;

  let rawToken = directToken.includes("…") ? currentConfig.accessToken : directToken;
  let expiresIn = 5184000;

  if (authMode === "oauth2") {
    if (!clientId || !clientSecret) {
      return buildErrorEnvelope("client_id and client_secret are required for OAuth2 flow");
    }
    writeEnv({
      LINKEDIN_CLIENT_ID: clientId,
      LINKEDIN_CLIENT_SECRET: clientSecret,
    });

    try {
      const tokenRes = await runOAuthFlow(clientId, clientSecret, port);
      rawToken = tokenRes.access_token;
      if (tokenRes.expires_in) expiresIn = tokenRes.expires_in;
    } catch (err: any) {
      return buildErrorEnvelope(`OAuth authorization flow failed: ${err.message}`);
    }
  } else if (rawToken) {
    if (clientId && clientSecret) {
      writeEnv({
        LINKEDIN_CLIENT_ID: clientId,
        LINKEDIN_CLIENT_SECRET: clientSecret,
      });
    }
  }

  if (!rawToken) {
    return buildErrorEnvelope("No access token acquired or provided.");
  }

  // Pre-flight probe to fetch member identity
  const tempClient = new LinkedInClient({
    ...loadConfig(),
    accessToken: rawToken,
  });

  let profile: any = {};
  try {
    profile = await tempClient.getProfile();
  } catch (err: any) {
    return buildErrorEnvelope(`Pre-flight OIDC profile fetch failed: ${err.message}`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresIn * 1000);

  const storedToken: StoredToken = {
    access_token: rawToken,
    expires_in: expiresIn,
    obtained_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    member_id: (profile.sub as string) || "",
    name: (profile.name as string) || "",
    email: (profile.email as string) || "",
  };

  writeStoredToken(storedToken);

  return buildOkEnvelope({
    message: "Authenticated successfully!",
    member: {
      name: storedToken.name,
      email: storedToken.email,
      sub: storedToken.member_id,
    },
    expires_at: storedToken.expires_at,
  }, review.comment, review.edited);
}

export async function adminAuthStatus(): Promise<OutputEnvelope> {
  const config = loadConfig();
  return buildOkEnvelope({
    authenticated: config.tokenValid,
    days_remaining: config.daysRemaining,
    member: {
      name: config.memberName || "Unknown",
      email: config.memberEmail || "Unknown",
      sub: config.memberId || "Unknown",
    },
    credentials: {
      client_id: maskSecret(config.clientId),
      client_secret: maskSecret(config.clientSecret),
      access_token: maskSecret(config.accessToken),
    },
    paths: {
      config_dir: config.configDir,
      env_file: config.envPath,
      token_file: config.tokenPath,
    },
  });
}

export async function adminAuthLogout(): Promise<OutputEnvelope> {
  const review = await requestApproval({
    action: "admin auth logout",
    payload: { confirm: "Yes, clear stored token" },
    instructions: "Confirm clearing the stored access token from token.json.",
  });

  if (!review.approved) {
    return buildErrorEnvelope("Logout cancelled by user", review.comment);
  }

  clearStoredToken();
  return buildOkEnvelope({ message: "Stored access token cleared successfully" }, review.comment, review.edited);
}
