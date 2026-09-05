/**
 * link-proxy — Raw REST API escape hatch handler.
 */

import type { ActionDef } from "../types.ts";
import { RawSchema } from "./schemas.ts";
import { buildOkEnvelope } from "../helpers.ts";
import { LinkedInClient } from "../client.ts";

export const RAW_ACTIONS: ActionDef[] = [
  {
    name: "raw",
    description: "Atomic unrestricted gateway to LinkedIn REST v2 API.",
    group: "Escape Hatch",
    meta: {
      action: "raw",
      category: "Escape Hatch",
      description: "Atomic unrestricted gateway to LinkedIn REST v2 API.",
      arguments: [
        { name: "method", description: "HTTP method: GET, POST, PUT, or DELETE. Default GET.", required: false },
        { name: "endpoint", description: "REST API path (e.g. /v2/userinfo).", required: true },
        { name: "payload", description: "Optional JSON payload object.", required: false },
      ],
      returns: "Raw LinkedIn v2 REST API JSON response body",
    },
    schema: RawSchema,
    docstring: `Atomic unrestricted gateway to LinkedIn REST v2 API. Always requires HITL approval.

Parameters:
    - method (optional): HTTP method: GET, POST, PUT, DELETE (default GET).
    - endpoint (required): REST endpoint path (e.g. '/v2/userinfo').
    - payload (optional): JSON request body object.

Examples:
    - Raw GET userinfo:
        \`link-proxy do raw '{"endpoint":"/v2/userinfo"}'\`
        → {"sub":"urn:li:person:abcdef1234","name":"Ivann KAMDEM"}
    - Raw POST ugcPosts:
        \`link-proxy do raw '{"method":"POST","endpoint":"/v2/ugcPosts","payload":{"author":"urn:li:person:123","lifecycleState":"PUBLISHED"}}'\`
        → {"id":"urn:li:ugcPost:998877"}`,
    handler: async (payload: { method?: string; endpoint: string; payload?: Record<string, unknown> }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.rawRequest(
        payload.method || "GET",
        payload.endpoint,
        payload.payload
      );
      return buildOkEnvelope(result);
    },
  },
];
