/**
 * link-proxy — Output formatting.
 *
 * Provides pure stdout output helpers for JSON envelopes and ANSI formatted tables.
 */

import type { OutputEnvelope } from "./types.ts";

export function printJson(envelope: OutputEnvelope): void {
  console.log(JSON.stringify(envelope, null, 2));
}

export function printTable(envelope: OutputEnvelope): void {
  const data = envelope.data;
  if (!data || typeof data !== "object") {
    printJson(envelope);
    return;
  }

  const entries = Array.isArray(data)
    ? data.map((item, idx) => [`Item #${idx + 1}`, typeof item === "object" ? JSON.stringify(item) : String(item)])
    : Object.entries(data).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);

  if (entries.length === 0) {
    console.log("+-------------------+------------------------------------------+");
    console.log("| (empty result)    |                                          |");
    console.log("+-------------------+------------------------------------------+");
    return;
  }

  const maxKeyLen = Math.max(15, ...entries.map(([k]) => k.length));
  const maxValLen = Math.max(25, ...entries.map(([, v]) => v.length));

  const border = `+${"-".repeat(maxKeyLen + 2)}+${"-".repeat(maxValLen + 2)}+`;
  console.log(border);
  console.log(`| ${"Field".padEnd(maxKeyLen)} | ${"Value".padEnd(maxValLen)} |`);
  console.log(border);
  for (const [k, v] of entries) {
    console.log(`| ${k.padEnd(maxKeyLen)} | ${v.padEnd(maxValLen)} |`);
  }
  console.log(border);
}
