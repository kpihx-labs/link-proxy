/**
 * link-proxy — Smoke test suite.
 *
 * Verifies action registry integrity (10 actions), policy mappings, and CLI docstring quality.
 */

import { describe, expect, it } from "bun:test";
import { REGISTRY } from "../src/link_proxy/actions/registry.ts";
import { POLICIES } from "../src/link_proxy/actions/policies.ts";

describe("link-proxy registry integrity", () => {
  it("should register exactly 10 actions (6 impossible ones disabled 2026-09-05, code kept)", () => {
    expect(REGISTRY.size).toBe(10);
  });

  it("should have matching policies for every registered action", () => {
    for (const actionName of REGISTRY.keys()) {
      expect(POLICIES[actionName]).toBeDefined();
    }
  });

  it("should contain all expected domain action names", () => {
    const expected = [
      "profile-get",
      "profile-status",
      "post-create",
      "post-create-image",
      "post-create-article",
      "post-create-full",
      "post-like",
      "comment-create",
      "comment-reply",
      "raw",
    ];

    for (const name of expected) {
      expect(REGISTRY.has(name)).toBe(true);
    }
  });

  it("should have a docstring with at least 2 examples for every registered action", () => {
    for (const [name, def] of REGISTRY.entries()) {
      const doc = def.docstring || "";
      expect(doc).toContain("Examples:");
      const exampleMatches = doc.match(/\n\s*-\s+.*:\s*\n\s*`link-proxy do/g) || [];
      expect(exampleMatches.length).toBeGreaterThanOrEqual(2);
    }
  });
});
