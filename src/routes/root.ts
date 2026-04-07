import { Router, Request, Response } from 'express';
import { logger } from '../logging';
import { tokenStore } from '../services/store';

export const rootRouter = Router();

rootRouter.get('/', (req: Request, res: Response) => {
  const shop = req.query.shop as string | undefined;
  const hasToken = shop ? tokenStore.has(shop) : false;

  logger.info({ context: { shop, hasToken } }, 'Evaluating securely dynamic entry routing');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Pendulum Ops - Shopify Integration</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 2rem; background: #fafafa; color: #333; }
        .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; text-align: center; }
        h1 { color: ${hasToken ? '#008060' : '#2c3e50'}; font-size: 1.5rem; border-bottom: 2px solid ${hasToken ? '#eaf5f0' : '#eee'}; padding-bottom: 0.5rem; margin-top: 0; }
        p { color: #666; margin-bottom: 2rem; }
        .btn { display: inline-block; background: #008060; color: white; padding: 0.8rem 1.75rem; text-decoration: none; border-radius: 4px; font-weight: 600; cursor: pointer; border: none; font-size: 1rem; }
        .btn:hover { background: #004c3f; }
        .success-box { padding: 1rem; background: #eaf5f0; color: #008060; border-radius: 4px; border: 1px solid #c2e2d9; margin-top: 1rem; margin-bottom: 1.5rem; text-align: left; }
        .error-msg { background: #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 4px; }
        
        /* Form styling */
        .harness-form { text-align: left; background: #fdfdfd; padding: 1.5rem; border: 1px solid #ddd; border-radius: 4px; margin-top: 1rem; }
        .harness-form h3 { margin-top: 0; color: #333; }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 0.4rem; color: #555; font-size: 0.9rem; }
        .form-group select, .form-group input { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .form-row { display: flex; gap: 1rem; }
        .form-row > .form-group { flex: 1; }
        .divider { text-align: center; margin: 10px 0; color: #999; font-size: 0.9rem; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        ${hasToken ? `
          <h1>🟢 Integration Verified</h1>
          <div class="success-box">
            <strong>Connected Store:</strong> ${shop}<br/>
            An offline access token safely maps to this domain in transient memory.
          </div>

          <div class="harness-form">
            <h3>Retrieve Products Harness</h3>
            <form action="/api/products/harness" method="GET">
              <input type="hidden" name="shop" value="${shop}">
              
              <div class="form-group">
                <label for="preset">Preset Range</label>
                <select name="preset" id="preset">
                  <option value="7">Last 7 Days</option>
                  <option value="30" selected>Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="180">Last 180 Days</option>
                  <option value="365">Last 365 Days</option>
                  <option value="custom">Custom Date Range Below</option>
                </select>
              </div>

              <div class="divider">OR</div>

              <div class="form-row">
                <div class="form-group">
                  <label for="dateFrom">Explicit From Date</label>
                  <input type="date" name="dateFrom" id="dateFrom">
                </div>
                <div class="form-group">
                  <label for="dateTo">Explicit To Date</label>
                  <input type="date" name="dateTo" id="dateTo">
                </div>
              </div>

              <div class="form-group" style="margin-top: 1.5rem;">
                <button type="submit" class="btn" style="width: 100%;">Fetch Graphql Products</button>
              </div>
            </form>
          </div>
        ` : `
          <h1>App Integration Requires Validation</h1>
          <p>We cleanly detected <b>${shop || 'an unknown store'}</b> structurally. No offline token bounds mapped securely currently natively.</p>
          ${shop 
            ? `<a href="/api/auth/start?shop=${shop}" class="btn">Initiate Shopify OAuth Handshake</a>`
            : `<div class="error-msg">Missing strictly required <b>shop</b> parameter cleanly natively. Cannot effectively manually initiate.</div>`
          }
        `}
      </div>
      <script>
        // Simple logic to clear Custom Dates if a Preset is chosen, and vice versa
        document.getElementById('preset')?.addEventListener('change', function(e) {
          if (e.target.value !== 'custom') {
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
          }
        });

        document.getElementById('dateFrom')?.addEventListener('change', function(e) {
          if (e.target.value) document.getElementById('preset').value = 'custom';
        });

        document.getElementById('dateTo')?.addEventListener('change', function(e) {
          if (e.target.value) document.getElementById('preset').value = 'custom';
        });
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});
