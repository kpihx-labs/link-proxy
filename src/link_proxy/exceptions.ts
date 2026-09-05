/**
 * link-proxy — Exception hierarchy.
 *
 * PLACEHOLDER: Custom error classes for link-proxy.
 */

export class LinkProxyError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = "LINK_PROXY_ERROR", statusCode = 1) {
    super(message);
    this.name = "LinkProxyError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends LinkProxyError {
  constructor(message = "Not authenticated. Run: link-proxy admin auth login") {
    super(message, "AUTHENTICATION_ERROR", 1);
    this.name = "AuthenticationError";
  }
}
