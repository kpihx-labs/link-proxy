/**
 * link-proxy — Application Entrypoint.
 */

import { runCli } from "./cli.ts";

export async function main(argv: string[]): Promise<number> {
  return await runCli(argv);
}

// Execute when invoked as entrypoint
const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
