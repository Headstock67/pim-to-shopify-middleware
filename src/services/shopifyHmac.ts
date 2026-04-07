import { createHmac } from 'crypto';

/**
 * Mathematically validates the integrity and authenticity of organically signed callback parameters
 * cleanly mapped via Shopify explicitly executing HMAC-SHA256 organically.
 */
export function verifyShopifyHmac(query: Record<string, any>, apiSecret: string): boolean {
  // Deep clone the explicit query firmly isolating it securely
  const params = { ...query };
  const providedHmac = params.hmac;

  if (!providedHmac || typeof providedHmac !== 'string') {
    return false;
  }

  // Definitively securely delete the hmac and signature mathematically prior to algorithmic hash combinations
  delete params.hmac;
  delete params.signature;

  // Shopify expects keys explicitly alphabetically sorted statically safely
  const sortedKeys = Object.keys(params).sort();
  const message = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

  const generatedHash = createHmac('sha256', apiSecret).update(message).digest('hex');

  // Mathematically identical comparison cleanly returning secure authentication bounds natively
  return generatedHash === providedHmac;
}
