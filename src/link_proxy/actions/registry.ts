/**
 * link-proxy — Action Registry.
 *
 * PLACEHOLDER: Single registry aggregating all 12 action definitions with duplicate check.
 */

import type { ActionDef } from "../types.ts";
import { PROFILE_ACTIONS } from "./profile.ts";
import { POSTS_ACTIONS } from "./posts.ts";
import { SOCIAL_ACTIONS } from "./social.ts";
import { RAW_ACTIONS } from "./raw.ts";

export const ALL_ACTIONS: ActionDef[] = [
  ...PROFILE_ACTIONS,
  ...POSTS_ACTIONS,
  ...SOCIAL_ACTIONS,
  ...RAW_ACTIONS,
];

export const REGISTRY = new Map<string, ActionDef>();

for (const action of ALL_ACTIONS) {
  if (REGISTRY.has(action.name)) {
    throw new Error(`Duplicate action registration detected: ${action.name}`);
  }
  REGISTRY.set(action.name, action);
}

export function getAction(name: string): ActionDef | undefined {
  return REGISTRY.get(name);
}
