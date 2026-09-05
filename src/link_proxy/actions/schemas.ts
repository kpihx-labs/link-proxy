/**
 * link-proxy — Zod Schemas for all 12 actions.
 *
 * PLACEHOLDER: Input validation schemas for each action.
 */

import { z } from "zod";

export const ProfileGetSchema = z.object({});
export const ProfileStatusSchema = z.object({});

export const PostCreateSchema = z.object({
  text: z.string().min(1, "Post text is required"),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
});

export const PostCreateImageSchema = z.object({
  text: z.string().min(1, "Post text is required"),
  image: z.string().min(1, "Image path or URL is required"),
  alt_text: z.string().optional().default(""),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
});

export const PostDeleteSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
});

export const PostGetSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
});

export const PostListSchema = z.object({
  limit: z.number().optional().default(10),
});

export const PostLikeSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
});

export const CommentCreateSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
  text: z.string().min(1, "Comment text is required"),
});

export const CommentListSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
  limit: z.number().optional().default(10),
});

export const CommentDeleteSchema = z.object({
  comment_urn: z.string().min(1, "Comment URN is required"),
});

export const PostCreateArticleSchema = z.object({
  text: z.string().min(1, "Post commentary text is required"),
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
});

const MediaItemSchema = z.object({
  type: z.enum(["image", "video"]),
  path: z.string().min(1, "File path or URL is required"),
  alt_text: z.string().optional().default(""),
  title: z.string().optional().default(""),
});

export const PostCreateFullSchema = z.object({
  text: z.string().min(1, "Post commentary text is required"),
  url: z.union([z.string().url(), z.literal("")]).optional().default(""),
  title: z.string().optional().default(""),
  description: z.string().optional().default(""),
  media: z.array(MediaItemSchema).optional().default([]),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC"),
});

export const PostReactSchema = z.object({
  post_urn: z.string().min(1, "Post URN is required"),
  reaction: z.enum(["LIKE", "PRAISE", "APPRECIATION", "EMPATHY", "INTEREST", "ENTERTAINMENT"]).default("LIKE"),
});

export const CommentReplySchema = z.object({
  parent_comment_urn: z.string().min(1, "Parent comment URN is required"),
  text: z.string().min(1, "Reply text is required"),
});

export const RawSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  endpoint: z.string().min(1, "API endpoint is required"),
  payload: z.record(z.unknown()).optional(),
});
