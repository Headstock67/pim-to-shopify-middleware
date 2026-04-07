import { Router, Request, Response } from 'express';
import { logger } from '../logging';
import { db } from '../services/db';
import { decryptToken } from '../services/encryption';

export const productsRouter = Router();

productsRouter.get('/harness', async (req: Request, res: Response) => {
  const { shop, preset, dateFrom, dateTo, after } = req.query as Record<string, string>;

  if (!shop) {
    logger.error('Product retrieval failed: Missing shop query parameter.');
    res.status(400).send('Bad Request: Missing shop');
    return;
  }

  const result = await db.query('SELECT access_token FROM shopify_sessions WHERE shop = $1', [shop]);
  
  if ((result.rowCount ?? 0) === 0) {
    logger.warn({ shop }, 'Product retrieval blocked: No valid offline token in persistent store.');
    res.status(401).send('Unauthorized: No valid context found for this shop. Please reboot OAuth handshake.');
    return;
  }

  const encryptedPayload = result.rows[0].access_token;
  const token = decryptToken(encryptedPayload);

  if (!token) {
    logger.error({ shop }, 'Product retrieval blocked: Token decryption physically failed. Re-Auth mandated.');
    res.status(401).send('Unauthorized: Invalid cryptographic binding. Please reboot OAuth handshake.');
    return;
  }

  // 1. Precise Date Logic Server-Side Query Construction
  let fromStr = '';
  let toStr = new Date().toISOString().split('T')[0]; // Current date as default TO

  if (preset && preset !== 'custom') {
    const days = parseInt(preset, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromStr = fromDate.toISOString().split('T')[0];
  } else if (dateFrom && dateTo) {
    fromStr = dateFrom;
    toStr = dateTo;
  } else {
    logger.warn({ shop, preset, dateFrom, dateTo }, 'Invalid Date inputs provided.');
    res.status(400).send('Bad Request: Invalid Date Parameters.');
    return;
  }

  // Generate exact GraphQL Search Query
  const searchQuery = `created_at:>=&#39;${fromStr}&#39; AND created_at:<=&#39;${toStr}&#39;`.replace(/&#39;/g, "'");
  
  logger.info({ shop, query: searchQuery, after }, 'Executing Shopify GraphQL Product Fetch');

  // 2. Fetch GraphQL endpoint 2026-01
  const gqlQuery = `
    query ($query: String!, $after: String) {
      products(first: 50, query: $query, after: $after) {
        edges {
          node {
            id
            title
            status
            handle
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables: {
          query: searchQuery,
          after: after || null
        }
      })
    });

    if (!response.ok) {
      logger.error({ shop, status: response.status }, 'Shopify API returned error status.');
      res.status(502).send('Bad Gateway: Shopify API failure.');
      return;
    }

    const payload = await response.json() as any;

    // Handle generic errors in GQL wrapper
    if (payload.errors) {
      logger.error({ shop, errors: payload.errors }, 'Shopify GraphQL evaluation error.');
      res.status(502).send(`Bad Gateway: API Error ${payload.errors[0]?.message}`);
      return;
    }

    const products = payload.data?.products?.edges || [];
    const pageInfo = payload.data?.products?.pageInfo;

    // Build the query parameter string for identical continuity passing forward
    const queryParams = new URLSearchParams({
      shop,
      ...(preset ? { preset } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})
    });

    const nextLink = pageInfo?.hasNextPage 
      ? `<a href="/api/products/harness?${queryParams.toString()}&after=${pageInfo.endCursor}" class="btn" style="margin-bottom: 2rem;">Next Page &rarr;</a>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Products diagnostic</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 2rem; background: #fafafa; color: #333; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h2 { margin-top: 0; color: #2c3e50; }
          .summary { padding: 1rem; background: #eaf5f0; color: #008060; border-radius: 4px; border: 1px solid #c2e2d9; margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
          th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #eee; }
          th { background: #f9f9f9; color: #666; font-size: 0.85rem; text-transform: uppercase; }
          .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; background: #eee; color: #333; }
          .status.ACTIVE { background: #eaf5f0; color: #008060; }
          .status.DRAFT { background: #fef0cd; color: #8a6100; }
          .btn { display: inline-block; background: #008060; color: white; padding: 0.6rem 1.25rem; text-decoration: none; border-radius: 4px; font-weight: 600; cursor: pointer; }
          .empty-state { padding: 3rem; text-align: center; color: #666; font-style: italic; background: #fdfdfd; border: 1px dashed #ccc; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <a href="/?shop=${shop}" style="color: #008060; text-decoration: none; margin-bottom: 1rem; display: inline-block;">&larr; Back to App</a>
          <h2>Products Retrieved</h2>
          
          <div class="summary">
            <strong>Store:</strong> ${shop} <br/>
            <strong>Query:</strong> <code>${searchQuery}</code> <br/>
            <strong>Local Count:</strong> ${products.length} products
          </div>

          ${products.length === 0 ? `
            <div class="empty-state">0 Products Found</div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Handle</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                ${products.map(({ node }: any) => `
                  <tr>
                    <td><strong>${node.title}</strong></td>
                    <td style="font-size: 0.85rem; color: #666;">${node.id.split('/').pop()}</td>
                    <td><span class="status ${node.status}">${node.status}</span></td>
                    <td style="font-size: 0.85rem; color: #666;">${node.handle}</td>
                    <td style="font-size: 0.85rem; color: #666;">${new Date(node.createdAt).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            ${nextLink}
          `}
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err: any) {
    logger.error({ shop, err: err.message }, 'Unexpected harness execution error.');
    res.status(502).send('Bad Gateway: Execution failed locally.');
  }
});
