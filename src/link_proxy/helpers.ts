/**
 * link-proxy — Shared helper functions.
 *
 * PLACEHOLDER: Envelope builders, payload parsers, file utilities.
 */

import type { OutputEnvelope } from "./types.ts";

export function buildOkEnvelope<T>(data: T, comment = "", edited = false): OutputEnvelope<T> {
  // PLACEHOLDER: Build standard ok response envelope
  return {
    meta: { status: "ok", comment, edited },
    data,
  };
}

export function buildErrorEnvelope<T = Record<string, unknown> | null>(
  message: string,
  comment = "",
  data: T = null as T
): OutputEnvelope<T> {
  return {
    meta: { status: "error", comment: comment || message, edited: false },
    data: data ?? ({ error: message } as unknown as T),
  };
}
