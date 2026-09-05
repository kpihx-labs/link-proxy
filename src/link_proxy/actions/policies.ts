/**
 * link-proxy — Declarative Safety Policies.
 *
 * PLACEHOLDER: Approval requirements, preflight targets, identity locks.
 */

export interface ActionPolicy {
  hitl: "always" | "conditional" | "never";
  preflight?: boolean;
  identityFields?: string[];
}

export const POLICIES: Record<string, ActionPolicy> = {
  "profile-get": { hitl: "never" },
  "profile-status": { hitl: "never" },
  "post-create": { hitl: "always" },
  "post-create-image": { hitl: "always" },
  // DISABLED 2026-09-05 (preflight GET 403): "post-delete": { hitl: "always", preflight: true, identityFields: ["post_urn"] },
  // DISABLED 2026-09-05 (GET ugcPosts 403): "post-get": { hitl: "never" },
  // DISABLED 2026-09-05 (FINDER-authors 403): "post-list": { hitl: "never" },
  "post-like": { hitl: "always" },
  "comment-create": { hitl: "always" },
  // DISABLED 2026-09-05 (GET_ALL 403): "comment-list": { hitl: "never" },
  // DISABLED 2026-09-05 (DELETE 404): "comment-delete": { hitl: "always", preflight: true, identityFields: ["comment_urn"] },
  "post-create-article": { hitl: "always" },
  "post-create-full": { hitl: "always" },
  // DISABLED 2026-09-05 (typed reactions rejected): "post-react": { hitl: "always" },
  "comment-reply": { hitl: "always" },
  "raw": { hitl: "always" },
};
