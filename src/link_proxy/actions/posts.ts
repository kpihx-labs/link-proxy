/**
 * link-proxy — Posts domain action handlers.
 */

import type { ActionDef } from "../types.ts";
import {
  PostCreateSchema,
  PostCreateImageSchema,
  PostCreateArticleSchema,
  PostCreateFullSchema,
  PostDeleteSchema,
  PostGetSchema,
  PostListSchema,
} from "./schemas.ts";
import { buildOkEnvelope } from "../helpers.ts";
import { LinkedInClient } from "../client.ts";

export const POSTS_ACTIONS: ActionDef[] = [
  {
    name: "post-create",
    description: "Publish a text post to your LinkedIn feed.",
    group: "Posts",
    meta: {
      action: "post-create",
      category: "Posts",
      description: "Publish a text post to your LinkedIn feed.",
      arguments: [
        { name: "text", description: "Post content text.", required: true },
        { name: "visibility", description: "Visibility setting: PUBLIC or CONNECTIONS. Default PUBLIC.", required: false },
      ],
      returns: "{ postUrn }",
    },
    schema: PostCreateSchema,
    docstring: `Publish a text post to your LinkedIn feed. Requires HITL approval.

Parameters:
    - text (required): Post commentary content text.
    - visibility (optional): Visibility setting: 'PUBLIC' (default) or 'CONNECTIONS'.

Examples:
    - Publish a public text post:
        \`link-proxy do post-create '{"text":"Excited to announce our new open-source CLI proxy for LinkedIn!","visibility":"PUBLIC"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456789"}
    - Publish a network connections-only update:
        \`link-proxy do post-create '{"text":"Internal update for my network","visibility":"CONNECTIONS"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456790"}`,
    handler: async (payload: { text: string; visibility?: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.createPost(payload.text, payload.visibility || "PUBLIC");
      return buildOkEnvelope(result);
    },
  },
  {
    name: "post-create-image",
    description: "Publish a LinkedIn post with an image attached.",
    group: "Posts",
    meta: {
      action: "post-create-image",
      category: "Posts",
      description: "Publish a LinkedIn post with an image attached.",
      arguments: [
        { name: "text", description: "Post commentary text.", required: true },
        { name: "image", description: "Local file path or remote HTTP URL to image file.", required: true },
        { name: "alt_text", description: "Optional alt text description for image.", required: false },
        { name: "visibility", description: "Visibility setting: PUBLIC or CONNECTIONS. Default PUBLIC.", required: false },
      ],
      returns: "{ postUrn, assetUrn }",
    },
    schema: PostCreateImageSchema,
    docstring: `Publish a LinkedIn post with an image attached. Executes 3-step media upload pipeline. Requires HITL approval.

Parameters:
    - text (required): Post commentary text.
    - image (required): Local file path or remote HTTP URL to image file.
    - alt_text (optional): Image accessibility description.
    - visibility (optional): 'PUBLIC' (default) or 'CONNECTIONS'.

Examples:
    - Publish local image post:
        \`link-proxy do post-create-image '{"text":"Architecture diagram","image":"/tmp/diagram.png","alt_text":"System Diagram"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456791","assetUrn":"urn:li:digitalmediaAsset:C560012345"}
    - Publish remote URL image post:
        \`link-proxy do post-create-image '{"text":"Infographic preview","image":"https://example.com/chart.png"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456792","assetUrn":"urn:li:digitalmediaAsset:C560012346"}`,
    handler: async (payload: { text: string; image: string; alt_text?: string; visibility?: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.createImagePost(
        payload.text,
        payload.image,
        payload.alt_text || "",
        payload.visibility || "PUBLIC"
      );
      return buildOkEnvelope(result);
    },
  },
  /* DISABLED 2026-09-05 — post-delete: preflight GET is 403 on personal tokens, DELETE unreachable. Code kept for re-enable.
  {
    name: "post-delete",
    description: "Delete one of your own LinkedIn posts by URN.",
    group: "Posts",
    meta: {
      action: "post-delete",
      category: "Posts",
      description: "Delete one of your own LinkedIn posts by URN.",
      arguments: [
        { name: "post_urn", description: "Target post URN (e.g. urn:li:ugcPost:12345).", required: true },
      ],
      returns: "{ deleted, postUrn }",
    },
    schema: PostDeleteSchema,
    docstring: `Delete one of your own LinkedIn posts by URN. Preflights post existence and locks identity field in HITL.

Parameters:
    - post_urn (required): Target post URN (e.g. 'urn:li:ugcPost:7234567890123456789').

Examples:
    - Delete an own post:
        \`link-proxy do post-delete '{"post_urn":"urn:li:ugcPost:7234567890123456789"}'\`
        → {"deleted":true,"postUrn":"urn:li:ugcPost:7234567890123456789"}
    - Delete post from JSON file:
        \`link-proxy do post-delete ./target_post.json\`
        → {"deleted":true,"postUrn":"urn:li:ugcPost:7234567890123456789"}`,
    handler: async (payload: { post_urn: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.deletePost(payload.post_urn);
      return buildOkEnvelope(result);
    },
  },
  */
  /* DISABLED 2026-09-05 — post-get: GET ugcPosts is 403 on personal tokens. Code kept for re-enable.
  {
    name: "post-get",
    description: "Fetch details of a specific LinkedIn post.",
    group: "Posts",
    meta: {
      action: "post-get",
      category: "Posts",
      description: "Fetch details of a specific LinkedIn post.",
      arguments: [
        { name: "post_urn", description: "Target post URN.", required: true },
      ],
      returns: "Raw ugcPost record JSON",
    },
    schema: PostGetSchema,
    docstring: `Fetch details of a specific LinkedIn post.

Parameters:
    - post_urn (required): Target post URN (e.g. 'urn:li:ugcPost:7234567890123456789').

Examples:
    - Fetch post details:
        \`link-proxy do post-get '{"post_urn":"urn:li:ugcPost:7234567890123456789"}'\`
        → {"id":"urn:li:ugcPost:7234567890123456789","author":"urn:li:person:abcdef1234","lifecycleState":"PUBLISHED"}
    - Fetch post details formatted as table:
        \`link-proxy do post-get '{"post_urn":"urn:li:ugcPost:7234567890123456789"}' -f table\`
        → {"id":"urn:li:ugcPost:7234567890123456789","author":"urn:li:person:abcdef1234","lifecycleState":"PUBLISHED"}`,
    handler: async (payload: { post_urn: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.getPost(payload.post_urn);
      return buildOkEnvelope(result);
    },
  },
  */
  /* DISABLED 2026-09-05 — post-list: FINDER-authors is 403, org-only. Code kept for re-enable.
  {
    name: "post-list",
    description: "Fetch recent posts from author feed.",
    group: "Posts",
    meta: {
      action: "post-list",
      category: "Posts",
      description: "Fetch recent posts from author feed.",
      arguments: [
        { name: "limit", description: "Maximum number of posts to fetch (default 10).", required: false },
      ],
      returns: "{ elements: [...] }",
    },
    schema: PostListSchema,
    docstring: `Fetch recent posts from author feed.

Parameters:
    - limit (optional): Maximum number of posts to return (default 10).

Examples:
    - Fetch recent 5 posts:
        \`link-proxy do post-list '{"limit":5}'\`
        → {"elements":[{"id":"urn:li:ugcPost:7234567890123456789"}]}
    - Fetch recent posts to output file:
        \`link-proxy do post-list '{"limit":10}' -o /tmp/recent_posts.json\`
        → {"elements":[{"id":"urn:li:ugcPost:7234567890123456789"}]}`,
    handler: async (payload: { limit?: number }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.listPosts(payload.limit || 10);
      return buildOkEnvelope(result);
    },
  },
  */
  {
    name: "post-create-article",
    description: "Share an external URL with a rich Open Graph preview card.",
    group: "Posts",
    meta: {
      action: "post-create-article",
      category: "Posts",
      description: "Share an external URL with a rich Open Graph preview card.",
      arguments: [
        { name: "text", description: "Post commentary text.", required: true },
        { name: "url", description: "External URL to share (https://...).", required: true },
        { name: "title", description: "Optional custom title override for the card.", required: false },
        { name: "description", description: "Optional custom description override for the card.", required: false },
        { name: "visibility", description: "Visibility: PUBLIC or CONNECTIONS. Default PUBLIC.", required: false },
      ],
      returns: "{ postUrn }",
    },
    schema: PostCreateArticleSchema,
    docstring: `Share an external URL with a rich Open Graph preview card. LinkedIn auto-crawls the URL metadata. Requires HITL approval.

Parameters:
    - text (required): Post commentary text.
    - url (required): External URL to share (e.g. 'https://github.com/user/repo').
    - title (optional): Custom title override for the preview card.
    - description (optional): Custom description override for the preview card.
    - visibility (optional): 'PUBLIC' (default) or 'CONNECTIONS'.

Examples:
    - Share a GitHub repo:
        \`link-proxy do post-create-article '{"text":"Just released v2.0!","url":"https://github.com/user/repo"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456793"}
    - Share a blog post with custom title:
        \`link-proxy do post-create-article '{"text":"Great read on AI","url":"https://example.com/ai-article","title":"AI in 2026","description":"A deep dive into AI trends"}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456794"}`,
    handler: async (payload: { text: string; url: string; title?: string; description?: string; visibility?: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.createArticlePost(
        payload.text,
        payload.url,
        payload.title || "",
        payload.description || "",
        payload.visibility || "PUBLIC"
      );
      return buildOkEnvelope(result);
    },
  },
  {
    name: "post-create-full",
    description: "Create a rich post with multiple images, videos, optional URL, custom title/description, and full media control.",
    group: "Posts",
    meta: {
      action: "post-create-full",
      category: "Posts",
      description: "Create a rich post with multiple images, videos, optional URL, custom title/description, and full media control.",
      arguments: [
        { name: "text", description: "Post commentary text.", required: true },
        { name: "url", description: "Optional external URL to share (creates article card with OG preview).", required: false },
        { name: "title", description: "Custom title override for the URL card.", required: false },
        { name: "description", description: "Custom description override for the URL card.", required: false },
        { name: "media", description: "Array of media items: [{type:'image'|'video', path:'/path', alt_text:'...', title:'...'}].", required: false },
        { name: "visibility", description: "PUBLIC or CONNECTIONS. Default PUBLIC.", required: false },
      ],
      returns: "{ postUrn, uploadedAssets: [...] }",
    },
    schema: PostCreateFullSchema,
    docstring: `Create a rich post with multiple images, videos, optional URL, and custom title/description.
Uploads each media item sequentially via the 2-step register+PUT pipeline. Supports unlimited media items.
Requires HITL approval.

Parameters:
    - text (required): Post commentary text.
    - url (optional): External URL to share. Creates article card with OG preview. Custom title/description override OG metadata.
    - title (optional): Custom title for the URL card (overrides crawled OG title).
    - description (optional): Custom description for the URL card (overrides crawled OG description).
    - media (optional): Array of media items. Each item has: type ('image'|'video'), path (file path or HTTP URL), alt_text (optional), title (optional).
    - visibility (optional): 'PUBLIC' (default) or 'CONNECTIONS'.

Examples:
    - Post with 2 images:
        \`link-proxy do post-create-full '{"text":"Our new architecture","media":[{"type":"image","path":"/tmp/diagram.png","alt_text":"System diagram"},{"type":"image","path":"/tmp/flow.png","alt_text":"Flow chart"}]}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456795","uploadedAssets":["urn:li:digitalmediaAsset:C560012345","urn:li:digitalmediaAsset:C560012346"]}
    - Post with URL + custom image thumbnail:
        \`link-proxy do post-create-full '{"text":"Check this out","url":"https://github.com/user/repo","title":"My Project","media":[{"type":"image","path":"https://example.com/hero.png","alt_text":"Hero image"}]}'\`
        → {"postUrn":"urn:li:ugcPost:7234567890123456796","uploadedAssets":["urn:li:digitalmediaAsset:C560012347"]}`,
    handler: async (payload: { text: string; url?: string; title?: string; description?: string; media?: Array<{ type: "image" | "video"; path: string; alt_text?: string; title?: string }>; visibility?: string }, ctx) => {
      const client = (ctx.client as LinkedInClient) || new LinkedInClient();
      const result = await client.createFullPost(
        payload.text,
        payload.url || "",
        payload.title || "",
        payload.description || "",
        payload.media || [],
        payload.visibility || "PUBLIC"
      );
      return buildOkEnvelope(result);
    },
  },
];
