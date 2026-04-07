// Explicit transient mapping structures handling stateless local sessions.

// Maps Shopify domains securely to their respective administrative offline tokens.
export const tokenStore = new Map<string, string>();

// Maps Shopify domains explicitly tightly to specific short-lived OAuth nonces.
export const stateStore = new Map<string, { state: string; timestamp: number }>();
