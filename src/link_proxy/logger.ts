/**
 * link-proxy — Stderr-only logger.
 *
 * PLACEHOLDER: Guarantees stdout remains pure JSON for pipeline parsing.
 */

export function logInfo(message: string): void {
  // PLACEHOLDER: Log info to stderr
  process.stderr.write(`[INFO] ${message}\n`);
}

export function logError(message: string): void {
  // PLACEHOLDER: Log error to stderr
  process.stderr.write(`[ERROR] ${message}\n`);
}

export function logDebug(message: string): void {
  // PLACEHOLDER: Log debug to stderr
  if (process.env.LINKEDIN_DEBUG) {
    process.stderr.write(`[DEBUG] ${message}\n`);
  }
}
