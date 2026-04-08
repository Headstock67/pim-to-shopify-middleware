import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { logger } from '../logging';
import { stateStore } from '../services/store';
import { db } from '../services/db';
import { encryptToken } from '../services/encryption';
import { config } from '../config';
import { verifyShopifyHmac } from '../services/shopifyHmac';
import { recordSystemEvent } from '../services/systemEvents';
import { asyncContext } from '../middleware/asyncContext';

export const authRouter = Router();

const SCOPES = 'read_products,write_products';

authRouter.get('/start', (req: Request, res: Response) => {
  const shop = req.query.shop as string;

  if (!shop) {
    logger.warn('OAuth start missing shop parameter.');
    res.status(400).send('Missing shop query string.');
    return;
  }

  // Generate a random state string for CSRF protection
  const state = randomBytes(16).toString('hex');
  
  stateStore.set(shop, { state, timestamp: Date.now() });

  const authorizeUrl = `https://${shop}/admin/oauth/authorize?client_id=${config.SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${config.SHOPIFY_REDIRECT_URI}&state=${state}`;

  logger.info({ shop }, 'Redirecting to Shopify for OAuth.');

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Authenticating...</title>
      </head>
      <body>
        <p>Redirecting to Shopify securely...</p>
        <script>
          window.top.location.href = "${authorizeUrl}";
        </script>
      </body>
    </html>
  `);
});

authRouter.get('/callback', async (req: Request, res: Response) => {
  const { shop, code, hmac, state } = req.query as Record<string, string>;

  if (!shop || !code || !hmac || !state) {
    logger.error('Missing core authentication payload.');
    res.status(400).send('Bad Request');
    return;
  }

  if (!verifyShopifyHmac(req.query as Record<string, string>, config.SHOPIFY_API_SECRET)) {
    logger.error({ shop }, 'HMAC Verification failed.');
    res.status(401).send('Unauthorized');
    return;
  }

  const storedState = stateStore.get(shop);
  if (!storedState || storedState.state !== state) {
    logger.error({ shop }, 'CSRF state verification failed.');
    res.status(403).send('Forbidden');
    return;
  }

  stateStore.delete(shop);

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.SHOPIFY_API_KEY,
        client_secret: config.SHOPIFY_API_SECRET,
        code: code
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Shopify Token Exchange failed with status: ${tokenResponse.status}`);
    }

    const payload = await tokenResponse.json() as { access_token: string, scope: string };

    if (!payload.access_token) {
      throw new Error('Access Token missing from Shopify response.');
    }

    const encryptedToken = encryptToken(payload.access_token);

    // Atomic Postgres UPSERT for session storage
    await db.query(`
      INSERT INTO shopify_sessions (shop, access_token, scope, is_offline) 
      VALUES ($1, $2, $3, true)
      ON CONFLICT (shop) DO UPDATE SET 
        access_token = EXCLUDED.access_token, 
        scope = EXCLUDED.scope, 
        updated_at = CURRENT_TIMESTAMP;
    `, [shop, encryptedToken, payload.scope]);

    logger.info({ shop }, 'Offline Access Token persisted securely.');

    res.redirect(`https://${shop}/admin/apps/${config.SHOPIFY_API_KEY}`);
  } catch (error: any) {
    let eventId = 'UNKNOWN_EVENT';
    const requestId = asyncContext.getStore()?.requestId || 'UNKNOWN_REQ';

    try {
      eventId = await recordSystemEvent({
        severity: 'error',
        eventType: 'OAUTH_TOKEN_EXCHANGE_FAILURE',
        domain: 'auth',
        requestId,
        message: 'OAuth Exchange failed.',
        details: { shop }
      });
    } catch (logErr: any) {
      // Log the inner failure but do not throw to avoid blocking the response
      logger.error({ error: logErr.message }, 'Failed to record system event during OAuth fallback.');
    }

    res.status(500).json({
      error: 'Internal server error',
      requestId,
      eventId
    });
  }
});
