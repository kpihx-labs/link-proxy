import { describe, expect, it } from "bun:test";
import { runCli } from "../src/link_proxy/cli.ts";

describe("CLI dispatcher", () => {
  it("should return version when --version flag is passed", async () => {
    const code = await runCli(["--version"]);
    expect(code).toBe(0);
  });

  it("should return general help when --help flag is passed", async () => {
    const code = await runCli(["--help"]);
    expect(code).toBe(0);
  });

  it("should reject admin commands with formatting flags", async () => {
    const code = await runCli(["admin", "status", "-f", "table"]);
    expect(code).toBe(2);
  });

  it("should return error for unknown action", async () => {
    const code = await runCli(["do", "nonexistent-action"]);
    expect(code).toBe(1);
  });
});
