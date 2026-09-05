/**
 * link-proxy — Profile domain action handlers.
 */

import type { ActionDef } from "../types.ts";
import { ProfileGetSchema, ProfileStatusSchema } from "./schemas.ts";
import { buildOkEnvelope } from "../helpers.ts";
import { LinkedInClient } from "../client.ts";

export const PROFILE_ACTIONS: ActionDef[] = [
  {
    name: "profile-get",
    description: "Fetch your own LinkedIn profile information (name, email, sub, picture, locale).",
    group: "Profile",
    meta: {
      action: "profile-get",
      category: "Profile",
      description: "Fetch your own LinkedIn profile information (name, email, sub, picture, locale).",
      arguments: [],
      returns: "{ sub, name, given_name, family_name, picture, email, locale }",
    },
    schema: ProfileGetSchema,
    docstring: `Fetch your own LinkedIn profile information via OpenID Connect (OIDC).

Parameters:
    - (no payload required)

Examples:
    - Fetch current profile:
        \`link-proxy do profile-get\`
        → {"sub":"urn:li:person:abcdef1234","name":"Ivann KAMDEM","email":"kapoivha@gmail.com","locale":{"country":"US","language":"en"}}
    - Fetch profile with output saved to file:
        \`link-proxy do profile-get -o /tmp/profile.json\`
        → {"sub":"urn:li:person:abcdef1234","name":"Ivann KAMDEM","email":"kapoivha@gmail.com","locale":{"country":"US","language":"en"}}`,
    handler: async (_payload, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const profile = await client.getProfile();
      return buildOkEnvelope(profile);
    },
  },
  {
    name: "profile-status",
    description: "Check current LinkedIn authentication status and token summary.",
    group: "Profile",
    meta: {
      action: "profile-status",
      category: "Profile",
      description: "Check current LinkedIn authentication status and token summary.",
      arguments: [],
      returns: "{ authenticated, member_id, name, email, days_remaining }",
    },
    schema: ProfileStatusSchema,
    docstring: `Check current LinkedIn authentication status and token summary.

Parameters:
    - (no payload required)

Examples:
    - Check auth status:
        \`link-proxy do profile-status\`
        → {"authenticated":true,"member_id":"urn:li:person:abcdef1234","name":"Ivann KAMDEM","email":"kapoivha@gmail.com","days_remaining":58}
    - Check auth status formatted as table:
        \`link-proxy do profile-status -f table\`
        → {"authenticated":true,"member_id":"urn:li:person:abcdef1234","name":"Ivann KAMDEM","email":"kapoivha@gmail.com","days_remaining":58}`,
    handler: async (_payload, ctx) => {
      const config = ctx.config as any;
      return buildOkEnvelope({
        authenticated: config.tokenValid,
        member_id: config.memberId,
        name: config.memberName,
        email: config.memberEmail,
        days_remaining: config.daysRemaining,
      });
    },
  },
];
