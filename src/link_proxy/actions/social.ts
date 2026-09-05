/**
 * link-proxy — Social domain action handlers.
 */

import type { ActionDef } from "../types.ts";
import {
  PostLikeSchema,
  PostReactSchema,
  CommentCreateSchema,
  CommentListSchema,
  CommentDeleteSchema,
  CommentReplySchema,
} from "./schemas.ts";
import { buildOkEnvelope } from "../helpers.ts";
import { LinkedInClient } from "../client.ts";

export const SOCIAL_ACTIONS: ActionDef[] = [
  {
    name: "post-like",
    description: "Like a LinkedIn post on your behalf.",
    group: "Social",
    meta: {
      action: "post-like",
      category: "Social",
      description: "Like a LinkedIn post on your behalf.",
      arguments: [
        { name: "post_urn", description: "Target post URN.", required: true },
      ],
      returns: "{ liked, postUrn }",
    },
    schema: PostLikeSchema,
    docstring: `Like a LinkedIn post on your behalf. Requires HITL approval.

Parameters:
    - post_urn (required): Target post URN (e.g. 'urn:li:ugcPost:7234567890123456789').

Examples:
    - Like a post:
        \`link-proxy do post-like '{"post_urn":"urn:li:ugcPost:7234567890123456789"}'\`
        → {"liked":true,"postUrn":"urn:li:ugcPost:7234567890123456789"}
    - Like a post from payload file:
        \`link-proxy do post-like ./target_post.json\`
        → {"liked":true,"postUrn":"urn:li:ugcPost:7234567890123456789"}`,
    handler: async (payload: { post_urn: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.likePost(payload.post_urn);
      return buildOkEnvelope(result);
    },
  },
  {
    name: "comment-create",
    description: "Add a comment to a LinkedIn post.",
    group: "Social",
    meta: {
      action: "comment-create",
      category: "Social",
      description: "Add a comment to a LinkedIn post.",
      arguments: [
        { name: "post_urn", description: "Target post URN.", required: true },
        { name: "text", description: "Comment message text.", required: true },
      ],
      returns: "{ commentUrn, postUrn }",
    },
    schema: CommentCreateSchema,
    docstring: `Add a comment to a LinkedIn post. Requires HITL approval.

Parameters:
    - post_urn (required): Target post URN.
    - text (required): Comment message text.

Examples:
    - Add a comment:
        \`link-proxy do comment-create '{"post_urn":"urn:li:ugcPost:7234567890123456789","text":"Great update!"}'\`
        → {"commentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)","postUrn":"urn:li:ugcPost:7234567890123456789"}
    - Add a formatted feedback comment:
        \`link-proxy do comment-create '{"post_urn":"urn:li:ugcPost:7234567890123456789","text":"Congrats on the release! Looking forward to testing."}'\`
        → {"commentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998878)","postUrn":"urn:li:ugcPost:7234567890123456789"}`,
    handler: async (payload: { post_urn: string; text: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.commentOnPost(payload.post_urn, payload.text);
      return buildOkEnvelope(result);
    },
  },
  /* DISABLED 2026-09-05 — comment-list: socialActions.GET_ALL is 403 on personal tokens. Code kept for re-enable.
  {
    name: "comment-list",
    description: "List comments on a LinkedIn post.",
    group: "Social",
    meta: {
      action: "comment-list",
      category: "Social",
      description: "List comments on a LinkedIn post.",
      arguments: [
        { name: "post_urn", description: "Target post URN.", required: true },
        { name: "limit", description: "Maximum comments to return (default 10).", required: false },
      ],
      returns: "{ elements: [...] }",
    },
    schema: CommentListSchema,
    docstring: `List comments on a LinkedIn post.

Parameters:
    - post_urn (required): Target post URN.
    - limit (optional): Maximum comments to return (default 10).

Examples:
    - List post comments:
        \`link-proxy do comment-list '{"post_urn":"urn:li:ugcPost:7234567890123456789"}'\`
        → {"elements":[{"id":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)","message":{"text":"Great update!"}}]}
    - List top 20 comments with table format:
        \`link-proxy do comment-list '{"post_urn":"urn:li:ugcPost:7234567890123456789","limit":20}' -f table\`
        → {"elements":[{"id":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)","message":{"text":"Great update!"}}]}`,
    handler: async (payload: { post_urn: string; limit?: number }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.listComments(payload.post_urn, payload.limit || 10);
      return buildOkEnvelope(result);
    },
  },
  */
  /* DISABLED 2026-09-05 — comment-delete: DELETE is 404 on all path variants. Code kept for re-enable.
  {
    name: "comment-delete",
    description: "Delete a comment on a LinkedIn post.",
    group: "Social",
    meta: {
      action: "comment-delete",
      category: "Social",
      description: "Delete a comment on a LinkedIn post.",
      arguments: [
        { name: "comment_urn", description: "Target comment URN.", required: true },
      ],
      returns: "{ deleted, commentUrn }",
    },
    schema: CommentDeleteSchema,
    docstring: `Delete a comment on a LinkedIn post. Preflights comment target and locks identity in HITL.

Parameters:
    - comment_urn (required): Target comment URN.

Examples:
    - Delete a comment:
        \`link-proxy do comment-delete '{"comment_urn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)"}'\`
        → {"deleted":true,"commentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)"}
    - Delete comment from JSON file:
        \`link-proxy do comment-delete ./target_comment.json\`
        → {"deleted":true,"commentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)"}`,
    handler: async (payload: { comment_urn: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.deleteComment(payload.comment_urn);
      return buildOkEnvelope(result);
    },
  },
  */
  /* DISABLED 2026-09-05 — post-react: server rejects typed reactions (Unpermitted fields). Plain LIKE via post-like works. Code kept for re-enable.
  {
    name: "post-react",
    description: "React to a LinkedIn post with a specific reaction type (LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT).",
    group: "Social",
    meta: {
      action: "post-react",
      category: "Social",
      description: "React to a LinkedIn post with a specific reaction type (LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT).",
      arguments: [
        { name: "post_urn", description: "Target post URN.", required: true },
        { name: "reaction", description: "Reaction type: LIKE, PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT. Default LIKE.", required: false },
      ],
      returns: "{ reacted, reaction, postUrn }",
    },
    schema: PostReactSchema,
    docstring: `React to a LinkedIn post with a specific reaction type. Requires HITL approval.

Parameters:
    - post_urn (required): Target post URN (e.g. 'urn:li:ugcPost:7234567890123456789').
    - reaction (optional): Reaction type: LIKE (default), PRAISE, APPRECIATION, EMPATHY, INTEREST, ENTERTAINMENT.

Examples:
    - React with PRAISE:
        \`link-proxy do post-react '{"post_urn":"urn:li:ugcPost:7234567890123456789","reaction":"PRAISE"}'\`
        → {"reacted":true,"reaction":"PRAISE","postUrn":"urn:li:ugcPost:7234567890123456789"}
    - React with default LIKE:
        \`link-proxy do post-react '{"post_urn":"urn:li:ugcPost:7234567890123456789"}'\`
        → {"reacted":true,"reaction":"LIKE","postUrn":"urn:li:ugcPost:7234567890123456789"}`,
    handler: async (payload: { post_urn: string; reaction?: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.reactToPost(payload.post_urn, payload.reaction || "LIKE");
      return buildOkEnvelope(result);
    },
  },
  */
  {
    name: "comment-reply",
    description: "Reply to a specific comment on a LinkedIn post (nested/threaded reply).",
    group: "Social",
    meta: {
      action: "comment-reply",
      category: "Social",
      description: "Reply to a specific comment on a LinkedIn post (nested/threaded reply).",
      arguments: [
        { name: "parent_comment_urn", description: "URN of the comment to reply to.", required: true },
        { name: "text", description: "Reply text.", required: true },
      ],
      returns: "{ replyUrn, parentCommentUrn }",
    },
    schema: CommentReplySchema,
    docstring: `Reply to a specific comment on a LinkedIn post (nested/threaded reply). Requires HITL approval.

Parameters:
    - parent_comment_urn (required): URN of the comment to reply to.
    - text (required): Reply text.

Examples:
    - Reply to a comment:
        \`link-proxy do comment-reply '{"parent_comment_urn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)","text":"Thanks for the feedback!"}'\`
        → {"replyUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998878)","parentCommentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)"}
    - Reply with agreement:
        \`link-proxy do comment-reply '{"parent_comment_urn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)","text":"Totally agree!"}'\`
        → {"replyUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998879)","parentCommentUrn":"urn:li:comment:(urn:li:ugcPost:7234567890123456789,998877)"}`,
    handler: async (payload: { parent_comment_urn: string; text: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.replyToComment(payload.parent_comment_urn, payload.text);
      return buildOkEnvelope(result);
    },
  },
];
