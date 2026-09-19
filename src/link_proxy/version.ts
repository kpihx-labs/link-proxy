/**
 * link-proxy — Version utility.
 *
 * PLACEHOLDER: Single source of truth for version from package.json.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_JSON = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");

/** Single source of truth: the manifest the package was published from. */
export const VERSION: string = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version;

export function getVersion(): string {
  return VERSION;
}
