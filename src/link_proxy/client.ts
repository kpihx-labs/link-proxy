/**
 * link-proxy — LinkedIn REST v2 API Client.
 *
 * Wraps official LinkedIn REST v2 API endpoints with Bearer access token headers.
 */

import fs from "node:fs";
import { AuthenticationError, LinkProxyError } from "./exceptions.ts";
import { loadConfig, loadStoredToken, type LinkProxyConfig } from "./config.ts";

const LI_API_BASE = "https://api.linkedin.com";
const LI_VERSION = "202501";

/**
 * RFC3986 path encoding for LinkedIn URNs.
 * encodePath() leaves `( ) ! ' *` unescaped, which breaks
 * compound URNs like `urn:li:comment:(urn:li:share:123,456)` in path
 * variables (LinkedIn answers 400 "Syntax exception in path variables").
 */
export function encodePath(urn: string): string {
  return encodeURIComponent(urn).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export class LinkedInClient {
  private config: LinkProxyConfig;
  private token: string | null = null;

  constructor(customConfig?: LinkProxyConfig) {
    this.config = customConfig || loadConfig();
  }

  private resolveToken(): string {
    if (this.token) return this.token;
    if (this.config.accessToken) {
      this.token = this.config.accessToken;
      return this.token;
    }
    const stored = loadStoredToken();
    if (stored?.access_token) {
      this.token = stored.access_token;
      return this.token;
    }
    throw new AuthenticationError("Not authenticated. Run: link-proxy admin auth login");
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.resolveToken()}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LI_VERSION,
      ...extra,
    };
  }

  private resolveMemberUrn(): string {
    if (this.config.memberId) {
      return this.config.memberId.startsWith("urn:li:person:")
        ? this.config.memberId
        : `urn:li:person:${this.config.memberId}`;
    }
    const stored = loadStoredToken();
    if (stored?.member_id) {
      return stored.member_id.startsWith("urn:li:person:")
        ? stored.member_id
        : `urn:li:person:${stored.member_id}`;
    }
    throw new LinkProxyError("Member URN not resolved. Re-run: link-proxy admin auth login");
  }

  public async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; headers: Record<string, string>; status: number }> {
    const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
      ? endpoint
      : `${LI_API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const res = await fetch(url, {
      ...options,
      headers: this.headers(options.headers as Record<string, string>),
    });

    const bodyText = await res.text();
    let body: any = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = { raw: bodyText };
      }
    }

    if (!res.ok && res.status !== 204) {
      const msg = body.message || body.error_description || body.error || `HTTP ${res.status}`;
      throw new LinkProxyError(`LinkedIn API Error (${res.status}): ${msg}`, "API_ERROR", res.status);
    }

    return {
      data: body as T,
      headers: Object.fromEntries(res.headers.entries()),
      status: res.status,
    };
  }

  // ── Profile ─────────────────────────────────────────────────────────────────

  /**
   * Fetch own profile via GET /v2/userinfo
   */
  public async getProfile(): Promise<Record<string, unknown>> {
    const res = await fetch(`${LI_API_BASE}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${this.resolveToken()}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new LinkProxyError(`Failed to fetch profile: HTTP ${res.status}`, "PROFILE_ERROR", res.status);
    }
    return body as Record<string, unknown>;
  }

  // ── Posts ───────────────────────────────────────────────────────────────────

  /**
   * Create a text post via POST /v2/ugcPosts
   */
  public async createPost(text: string, visibility = "PUBLIC"): Promise<{ postUrn: string; raw: unknown }> {
    const author = this.resolveMemberUrn();
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };

    const { data, headers } = await this.request("/v2/ugcPosts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const postUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || (data as any)?.id || "";
    return { postUrn, raw: data };
  }

  /**
   * Create a post with an image attachment
   */
  public async createImagePost(
    text: string,
    imagePath: string,
    altText = "",
    visibility = "PUBLIC"
  ): Promise<{ postUrn: string; assetUrn: string }> {
    const author = this.resolveMemberUrn();

    // Step 1: Register upload
    const { data: regData } = await this.request<any>("/v2/assets?action=registerUpload", {
      method: "POST",
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: author,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      }),
    });

    const uploadUrl = regData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    const assetUrn = regData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      throw new LinkProxyError("Image upload registration failed: missing uploadUrl or asset URN");
    }

    // Step 2: Binary transfer
    let imageBuffer: Buffer;
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      const r = await fetch(imagePath);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      imageBuffer = fs.readFileSync(imagePath);
    }

    await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.resolveToken()}`,
        "Content-Type": "application/octet-stream",
      },
      body: imageBuffer as any,
    });

    // Step 3: Create post
    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              description: { text: altText },
              media: assetUrn,
              title: { text: altText || "Image" },
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };

    const { headers } = await this.request("/v2/ugcPosts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const postUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || "";
    return { postUrn, assetUrn };
  }

  /**
   * Delete an own post by URN
   */
  public async deletePost(postUrn: string): Promise<{ deleted: boolean; postUrn: string }> {
    const encoded = encodePath(postUrn);
    await this.request(`/v2/ugcPosts/${encoded}`, { method: "DELETE" });
    return { deleted: true, postUrn };
  }

  /**
   * Fetch specific post details by URN
   */
  public async getPost(postUrn: string): Promise<unknown> {
    const encoded = encodePath(postUrn);
    const { data } = await this.request(`/v2/ugcPosts/${encoded}`);
    return data;
  }

  /**
   * List recent author posts
   */
  public async listPosts(limit = 10): Promise<unknown> {
    const author = this.resolveMemberUrn();
    const encodedAuthor = encodePath(author);
    const { data } = await this.request(`/v2/ugcPosts?q=authors&authors=List(${encodedAuthor})&count=${limit}`);
    return data;
  }

  // ── Social Actions ──────────────────────────────────────────────────────────

  /**
   * Like a post by URN
   */
  public async likePost(postUrn: string): Promise<{ liked: boolean; postUrn: string }> {
    const author = this.resolveMemberUrn();
    const encoded = encodePath(postUrn);
    await this.request(`/v2/socialActions/${encoded}/likes`, {
      method: "POST",
      body: JSON.stringify({ actor: author }),
    });
    return { liked: true, postUrn };
  }

  /**
   * Comment on a post
   */
  public async commentOnPost(postUrn: string, text: string): Promise<{ commentUrn: string; postUrn: string }> {
    const author = this.resolveMemberUrn();
    const encoded = encodePath(postUrn);
    const { headers } = await this.request(`/v2/socialActions/${encoded}/comments`, {
      method: "POST",
      body: JSON.stringify({
        actor: author,
        message: { text },
      }),
    });
    const commentUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || "";
    return { commentUrn, postUrn };
  }

  /**
   * List comments on a post
   */
  public async listComments(postUrn: string, limit = 10): Promise<unknown> {
    const encoded = encodePath(postUrn);
    const { data } = await this.request(`/v2/socialActions/${encoded}/comments?count=${limit}`);
    return data;
  }

  /**
   * Delete a comment by URN
   */
  public async deleteComment(commentUrn: string): Promise<{ deleted: boolean; commentUrn: string }> {
    const encoded = encodePath(commentUrn);
    await this.request(`/v2/socialActions/${encoded}`, { method: "DELETE" });
    return { deleted: true, commentUrn };
  }

  /**
   * Create an article/link share post with rich OG preview card
   */
  public async createArticlePost(
    text: string,
    url: string,
    title = "",
    description = "",
    visibility = "PUBLIC"
  ): Promise<{ postUrn: string; raw: unknown }> {
    const author = this.resolveMemberUrn();
    const mediaEntry: Record<string, unknown> = {
      status: "READY",
      originalUrl: url,
    };
    if (title) mediaEntry.title = { text: title };
    if (description) mediaEntry.description = { text: description };

    const payload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "ARTICLE",
          media: [mediaEntry],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };

    const { data, headers } = await this.request("/v2/ugcPosts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const postUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || (data as any)?.id || "";
    return { postUrn, raw: data };
  }

  /**
   * React to a post with a specific reaction type
   */
  public async reactToPost(
    postUrn: string,
    reaction = "LIKE"
  ): Promise<{ reacted: boolean; reaction: string; postUrn: string }> {
    const author = this.resolveMemberUrn();
    const encoded = encodePath(postUrn);
    const reactionUrn = `urn:li:reactionType:${reaction}`;

    await this.request(`/v2/socialActions/${encoded}/likes`, {
      method: "POST",
      body: JSON.stringify({
        actor: author,
        object: postUrn,
        reactionType: reactionUrn,
      }),
    });
    return { reacted: true, reaction, postUrn };
  }

  /**
   * Reply to a specific comment (nested/threaded reply)
   */
  public async replyToComment(
    parentCommentUrn: string,
    text: string
  ): Promise<{ replyUrn: string; parentCommentUrn: string }> {
    const author = this.resolveMemberUrn();
    const encoded = encodePath(parentCommentUrn);
    const { headers } = await this.request(`/v2/socialActions/${encoded}/comments`, {
      method: "POST",
      body: JSON.stringify({
        actor: author,
        message: { text },
      }),
    });
    const replyUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || "";
    return { replyUrn, parentCommentUrn };
  }

  // ── Full Post (multi-media) ────────────────────────────────────────────────

  private async _uploadMedia(
    filePath: string,
    type: "image" | "video",
    owner: string
  ): Promise<{ assetUrn: string; uploadUrl: string }> {
    const recipe = type === "video"
      ? "urn:li:digitalmediaRecipe:feedshare-video"
      : "urn:li:digitalmediaRecipe:feedshare-image";

    const { data: regData } = await this.request<any>("/v2/assets?action=registerUpload", {
      method: "POST",
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [recipe],
          owner,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      }),
    });

    const uploadUrl =
      regData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
    const assetUrn = regData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      throw new Error(`Upload registration failed for ${filePath}`);
    }

    let fileBuffer: Buffer;
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      const r = await fetch(filePath);
      fileBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      fileBuffer = fs.readFileSync(filePath);
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.resolveToken()}`,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer as any,
    });

    if (!uploadRes.ok) {
      throw new Error(`Binary upload failed for ${filePath}: HTTP ${uploadRes.status}`);
    }

    return { assetUrn, uploadUrl };
  }

  /**
   * Create a full post with multiple images, videos, optional URL, and custom title/description.
   * Uploads each media item sequentially via the 2-step register+PUT pipeline.
   */
  public async createFullPost(
    text: string,
    url: string,
    title: string,
    description: string,
    mediaItems: Array<{ type: "image" | "video"; path: string; alt_text?: string; title?: string }>,
    visibility = "PUBLIC"
  ): Promise<{ postUrn: string; uploadedAssets: string[] }> {
    const author = this.resolveMemberUrn();
    const uploadedAssets: string[] = [];

    // Step 1: Upload all media items
    for (const item of mediaItems) {
      const { assetUrn } = await this._uploadMedia(item.path, item.type, author);
      uploadedAssets.push(assetUrn);
    }

    // Step 2: Determine share category
    const hasMedia = uploadedAssets.length > 0;
    const hasUrl = Boolean(url);
    let shareMediaCategory = "NONE";

    if (hasUrl) {
      shareMediaCategory = "ARTICLE";
    } else if (hasMedia) {
      const hasVideo = mediaItems.some((m) => m.type === "video");
      shareMediaCategory = hasVideo ? "VIDEO" : "IMAGE";
    }

    // Step 3: Build media array
    const mediaEntries: Array<Record<string, unknown>> = [];

    if (hasUrl) {
      const urlEntry: Record<string, unknown> = {
        status: "READY",
        originalUrl: url,
      };
      if (title) urlEntry.title = { text: title };
      if (description) urlEntry.description = { text: description };
      mediaEntries.push(urlEntry);
    }

    for (let i = 0; i < uploadedAssets.length; i++) {
      const item = mediaItems[i]!;
      mediaEntries.push({
        status: "READY",
        media: uploadedAssets[i],
        description: { text: item.alt_text || "" },
        title: { text: item.title || item.path.split("/").pop() || `Media ${i + 1}` },
      });
    }

    // Step 4: Build and send payload
    const payload: Record<string, unknown> = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory,
          ...(mediaEntries.length > 0 ? { media: mediaEntries } : {}),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };

    const { data, headers } = await this.request("/v2/ugcPosts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const postUrn = headers["x-restli-id"] || headers["X-RestLi-Id"] || (data as any)?.id || "";
    return { postUrn, uploadedAssets };
  }

  // ── Raw Gateway ─────────────────────────────────────────────────────────────

  public async rawRequest(
    method: string,
    endpoint: string,
    payload?: Record<string, unknown>
  ): Promise<unknown> {
    const options: RequestInit = { method: method.toUpperCase() };
    if (payload && Object.keys(payload).length > 0) {
      options.body = JSON.stringify(payload);
    }
    const { data } = await this.request(endpoint, options);
    return data;
  }
}
