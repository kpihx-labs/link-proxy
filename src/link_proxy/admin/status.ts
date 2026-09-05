/**
 * link-proxy — Admin Status, Doctor & Purge operations.
 */

import fs from "node:fs";
import { execSync } from "node:child_process";
import { buildOkEnvelope, buildErrorEnvelope } from "../helpers.ts";
import type { OutputEnvelope } from "../types.ts";
import {
  loadConfig,
  getConfigDir,
  getEnvPath,
  getTokenPath,
  DIR_PERMISSIONS,
  FILE_PERMISSIONS,
  clearStoredToken,
} from "../config.ts";
import { LinkedInClient } from "../client.ts";
import { requestApproval } from "../hitl.ts";

function getFileMode(filePath: string): number | null {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return stat.mode & 0o777;
}

export async function adminStatus(): Promise<OutputEnvelope> {
  const config = loadConfig();
  const issues: string[] = [];

  const dirMode = getFileMode(config.configDir);
  const envMode = getFileMode(config.envPath);
  const tokenMode = getFileMode(config.tokenPath);

  if (dirMode !== null && dirMode !== DIR_PERMISSIONS) {
    issues.push(`Config dir permissions are ${dirMode.toString(8)}, expected 700`);
  }
  if (envMode !== null && envMode !== FILE_PERMISSIONS) {
    issues.push(`.env file permissions are ${envMode.toString(8)}, expected 600`);
  }
  if (tokenMode !== null && tokenMode !== FILE_PERMISSIONS) {
    issues.push(`token.json permissions are ${tokenMode.toString(8)}, expected 600`);
  }

  let apiReachable = false;
  let apiError = "";

  if (config.accessToken) {
    try {
      const client = new LinkedInClient(config);
      await client.getProfile();
      apiReachable = true;
    } catch (err: any) {
      apiError = err.message;
      issues.push(`LinkedIn API Probe Failed: ${err.message}`);
    }
  } else {
    issues.push("No access token configured. Run: link-proxy admin auth login");
  }

  let binaryPath = "";
  try {
    binaryPath = execSync("which link-proxy", { encoding: "utf-8" }).trim();
  } catch {
    binaryPath = "Not in PATH";
  }

  return buildOkEnvelope({
    healthy: issues.length === 0,
    api_reachable: apiReachable,
    api_error: apiError,
    authenticated: config.tokenValid,
    days_remaining: config.daysRemaining,
    member: {
      name: config.memberName || "Unknown",
      email: config.memberEmail || "Unknown",
      sub: config.memberId || "Unknown",
    },
    paths: {
      config_dir: config.configDir,
      env_path: config.envPath,
      token_path: config.tokenPath,
      binary: binaryPath,
    },
    permissions: {
      config_dir: dirMode !== null ? `0${dirMode.toString(8)}` : "absent",
      env_path: envMode !== null ? `0${envMode.toString(8)}` : "absent",
      token_path: tokenMode !== null ? `0${tokenMode.toString(8)}` : "absent",
    },
    issues,
  });
}

export async function adminDoctor(): Promise<OutputEnvelope> {
  const config = loadConfig();
  const fixes: string[] = [];
  const issues: string[] = [];

  const configDir = getConfigDir();
  if (fs.existsSync(configDir)) {
    const dirMode = getFileMode(configDir);
    if (dirMode !== DIR_PERMISSIONS) {
      fs.chmodSync(configDir, DIR_PERMISSIONS);
      fixes.push(`Fixed config dir permissions: ${dirMode?.toString(8)} -> 700`);
    }
  } else {
    fs.mkdirSync(configDir, { recursive: true });
    fs.chmodSync(configDir, DIR_PERMISSIONS);
    fixes.push("Created config dir with 700 permissions");
  }

  const envPath = getEnvPath();
  if (fs.existsSync(envPath)) {
    const envMode = getFileMode(envPath);
    if (envMode !== FILE_PERMISSIONS) {
      fs.chmodSync(envPath, FILE_PERMISSIONS);
      fixes.push(`Fixed .env permissions: ${envMode?.toString(8)} -> 600`);
    }
  }

  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    const tokenMode = getFileMode(tokenPath);
    if (tokenMode !== FILE_PERMISSIONS) {
      fs.chmodSync(tokenPath, FILE_PERMISSIONS);
      fixes.push(`Fixed token.json permissions: ${tokenMode?.toString(8)} -> 600`);
    }
  }

  if (!config.accessToken) {
    issues.push("Missing access token. Run: link-proxy admin auth login");
  }

  return buildOkEnvelope({
    healthy: issues.length === 0,
    fixes_applied: fixes,
    issues,
  });
}

export async function adminPurge(): Promise<OutputEnvelope> {
  const configDir = getConfigDir();
  const review = await requestApproval({
    action: "admin purge",
    payload: {
      action: "delete_config_directory",
      config_dir: configDir,
      confirm: "Yes, delete configuration directory and credentials",
    },
    instructions: "Confirm permanent deletion of link-proxy config directory and tokens.",
  });

  if (!review.approved) {
    return buildErrorEnvelope("Purge cancelled by user", review.comment);
  }

  let deleted = false;
  if (fs.existsSync(configDir)) {
    fs.rmSync(configDir, { recursive: true, force: true });
    deleted = true;
  }

  return buildOkEnvelope({
    status: "purged",
    config_dir: configDir,
    deleted,
    note: "Config directory removed. To uninstall global link-proxy CLI binary, run: make uninstall",
  }, review.comment, review.edited);
}
