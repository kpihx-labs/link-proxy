/**
 * link-proxy — Configuration loader & state manager.
 *
 * Single source of truth:
 *   - ~/.config/link-proxy/token.json (chmod 0600) — access token, expiration, member info
 *   - ~/.config/link-proxy/.env (chmod 0600)       — LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const DIR_PERMISSIONS = 0o700;
export const FILE_PERMISSIONS = 0o600;

export interface StoredToken {
  access_token: string;
  expires_in?: number;
  obtained_at?: string;
  expires_at?: string;
  member_id?: string;
  name?: string;
  email?: string;
}

export interface LinkProxyConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  configDir: string;
  envPath: string;
  tokenPath: string;
  tokenValid: boolean;
  daysRemaining: number;
}

export function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function getConfigDir(): string {
  const dir = process.env.LINKEDIN_CONFIG_DIR || path.join(os.homedir(), ".config", "link-proxy");
  return expandHome(dir);
}

export function getEnvPath(): string {
  return path.join(getConfigDir(), ".env");
}

export function getTokenPath(): string {
  return path.join(getConfigDir(), "token.json");
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function loadEnv(): Record<string, string> {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const val = rest.join("=").trim();
    const k = key.trim();
    if (k && val) {
      if (!process.env[k]) {
        process.env[k] = val;
      }
      result[k] = val;
    }
  }
  return result;
}

export function writeEnv(values: Record<string, string>): void {
  const configDir = getConfigDir();
  fs.mkdirSync(configDir, { recursive: true });
  fs.chmodSync(configDir, DIR_PERMISSIONS);

  const envPath = getEnvPath();
  const lines = [
    "# link-proxy configuration — managed by `link-proxy admin auth login`.",
    "# Credentials are NEVER committed; this file is chmod 600.",
    "",
  ];
  for (const [k, v] of Object.entries(values)) {
    if (v) {
      lines.push(`${k}=${v}`);
      process.env[k] = v;
    }
  }

  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
  fs.chmodSync(envPath, FILE_PERMISSIONS);
}

export function loadStoredToken(): StoredToken | null {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const raw = fs.readFileSync(tokenPath, "utf-8");
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

export function writeStoredToken(tokenData: StoredToken): void {
  const configDir = getConfigDir();
  fs.mkdirSync(configDir, { recursive: true });
  fs.chmodSync(configDir, DIR_PERMISSIONS);

  const tokenPath = getTokenPath();
  fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2) + "\n", "utf-8");
  fs.chmodSync(tokenPath, FILE_PERMISSIONS);
}

export function clearStoredToken(): void {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
}

export function loadConfig(): LinkProxyConfig {
  loadEnv();
  const tokenData = loadStoredToken();
  const configDir = getConfigDir();

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN || tokenData?.access_token || "";
  let tokenValid = false;
  let daysRemaining = 0;

  if (tokenData?.expires_at) {
    const expires = new Date(tokenData.expires_at).getTime();
    const now = Date.now();
    if (expires > now) {
      tokenValid = true;
      daysRemaining = Math.max(0, Math.floor((expires - now) / (1000 * 60 * 60 * 24)));
    }
  } else if (accessToken) {
    // Direct env token without explicit expires_at timestamp is treated as valid
    tokenValid = true;
    daysRemaining = 60;
  }

  return {
    clientId: process.env.LINKEDIN_CLIENT_ID || "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
    accessToken,
    memberId: tokenData?.member_id || "",
    memberName: tokenData?.name || "",
    memberEmail: tokenData?.email || "",
    configDir,
    envPath: getEnvPath(),
    tokenPath: getTokenPath(),
    tokenValid,
    daysRemaining,
  };
}
