/// <reference path="../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '../services/db';
import { recordSystemEvent } from '../services/systemEvents';
import { asyncContext } from './asyncContext';

/**
 * Generates a SHA-256 hash string from a plaintext secret.
 * 
 * @param secret The plaintext string representing the token secret.
 * @returns The hex string representation of the hashed secret.
 */
function hashTokenSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Middleware ensuring a valid API token is provided in the headers.
 * Performs format validation, database lookup, revocation checks,
 * and cryptographic secret validation before attaching the user identity.
 */
export async function requireApiToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const requestId = asyncContext.getStore()?.requestId || 'UNKNOWN_REQ';
  const authHeader = req.headers.authorization;

  // 1. Missing Header Verification
  if (!authHeader) {
    await recordSystemEvent({
      severity: 'warning',
      eventType: 'AUTH_MISSING_HEADER',
      domain: 'auth',
      requestId,
      message: 'Authentication failed due to missing Authorization header.'
    });
    res.status(401).json({ error: 'Unauthorized: Missing authorization header', requestId });
    return;
  }

  // 2. Format Compliance Check
  if (!authHeader.startsWith('Bearer ')) {
    await recordSystemEvent({
      severity: 'warning',
      eventType: 'AUTH_INVALID_FORMAT',
      domain: 'auth',
      requestId,
      message: 'Authentication failed due to missing Bearer prefix.',
      details: { providedHeaderPrefix: authHeader.substring(0, 10) }
    });
    res.status(401).json({ error: 'Unauthorized: Invalid token format', requestId });
    return;
  }

  // Safely extract the token string payload
  const tokenString = authHeader.substring(7).trim();
  const parts = tokenString.split('.');
  
  // Explicit format requirement check: exactly one dot delimiter (abc.xyz)
  if (parts.length !== 2) {
    await recordSystemEvent({
      severity: 'warning',
      eventType: 'AUTH_INVALID_FORMAT',
      domain: 'auth',
      requestId,
      message: 'Authentication failed due to malformed dot-delimiter structure.',
      details: { partsCount: parts.length }
    });
    res.status(401).json({ error: 'Unauthorized: Invalid token structure', requestId });
    return;
  }

  const tokenId = parts[0];
  const tokenSecret = parts[1];

  try {
    // 3. Token Identity Postgres Lookup
    const result = await db.query('SELECT secret_hash, user_id, role, revoked_at FROM api_tokens WHERE token_id = $1', [tokenId]);
    
    if (result.rowCount === 0) {
      await recordSystemEvent({
        severity: 'warning',
        eventType: 'AUTH_TOKEN_NOT_FOUND',
        domain: 'auth',
        requestId,
        message: 'Authentication failed as token ID was not found in database.',
        details: { tokenId }
      });
      res.status(401).json({ error: 'Unauthorized: Invalid token credentials', requestId });
      return;
    }

    const row = result.rows[0];

    // 4. Token Revocation Validation
    if (row.revoked_at !== null) {
      await recordSystemEvent({
        severity: 'warning',
        eventType: 'AUTH_TOKEN_REVOKED',
        domain: 'auth',
        requestId,
        message: 'Authentication failed because the token was previously revoked.',
        details: { tokenId, revokedAt: row.revoked_at }
      });
      res.status(401).json({ error: 'Unauthorized: Invalid token credentials', requestId });
      return;
    }

    // 5. Cryptographic Verification via Constant-Time Sequence
    const providedHashBuffer = Buffer.from(hashTokenSecret(tokenSecret), 'hex');
    const storedHashBuffer = Buffer.from(row.secret_hash, 'hex');

    let isSecretValid = false;
    
    // Explicitly guarantee identical buffer bounds avoiding dynamic exceptions
    if (providedHashBuffer.length === storedHashBuffer.length) {
      isSecretValid = timingSafeEqual(providedHashBuffer, storedHashBuffer);
    }
    
    if (!isSecretValid) {
      await recordSystemEvent({
        severity: 'warning',
        eventType: 'AUTH_SECRET_MISMATCH',
        domain: 'auth',
        requestId,
        message: 'Authentication failed due to invalid token secret cryptographic signature.',
        details: { tokenId } 
        // We purposefully omit storing cryptographic strings to ensure no leakage occurs externally
      });
      res.status(401).json({ error: 'Unauthorized: Invalid token credentials', requestId });
      return;
    }

    // 6. Bind explicit User Identity and permit forwarding
    req.user = {
      userId: row.user_id,
      role: row.role
    };

    next();

  } catch (error: any) {
    // 7. Core execution infrastructure protection trapping unexpected database faults safely
    try {
      await recordSystemEvent({
        severity: 'error',
        eventType: 'AUTH_INTERNAL_ERROR',
        domain: 'auth',
        requestId,
        message: 'Authentication failed gracefully due to an internal system exception routing fault.',
        details: { internalMessage: error.message }
      });
    } catch (logErr) {
      // Ignored to avoid entirely bricking the API response routing dynamically
    }
    
    res.status(500).json({ error: 'Internal server error', requestId });
  }
}
