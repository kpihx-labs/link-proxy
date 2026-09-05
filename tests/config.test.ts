import { describe, expect, it } from "bun:test";
import { maskSecret, expandHome } from "../src/link_proxy/config.ts";

describe("config utilities", () => {
  it("should mask secrets keeping head and tail", () => {
    expect(maskSecret("86abcdef12345678")).toBe("86ab…5678");
    expect(maskSecret("short")).toBe("****");
    expect(maskSecret("")).toBe("");
  });

  it("should expand home directory path", () => {
    const expanded = expandHome("~/test-config");
    expect(expanded).not.toContain("~");
    expect(expanded).toContain("test-config");
  });
});
