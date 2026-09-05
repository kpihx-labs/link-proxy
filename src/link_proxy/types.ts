/**
 * link-proxy — Shared type definitions.
 *
 * Action system & Envelope definitions.
 */

export interface OutputMeta {
  status: "ok" | "approved" | "rejected" | "error";
  comment?: string;
  edited?: boolean;
}

export interface OutputEnvelope<T = unknown> {
  meta: OutputMeta;
  data: T;
}

export interface ActionContext {
  config: any;
  client?: any;
}

export interface ActionArg {
  name: string;
  description: string;
  required: boolean;
  type?: string;
}

export interface ActionMeta {
  action: string;
  category: string;
  description: string;
  arguments: ActionArg[];
  returns?: string;
}

export interface ActionDef {
  name: string;
  description: string;
  group: string;
  meta: ActionMeta;
  docstring?: string;
  schema: unknown;
  handler: (payload: any, ctx: ActionContext) => Promise<OutputEnvelope>;
}
