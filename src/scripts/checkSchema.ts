import { db } from '../db';
import { decryptToken } from '../encryption';

async function getShopifyToken(): Promise<{ shop: string, token: string } | null> {
  const result = await db.query('SELECT shop, access_token FROM shopify_sessions WHERE is_offline = true LIMIT 1');
  if (result.rowCount === 0) return null;
  return { shop: result.rows[0].shop, token: decryptToken(result.rows[0].access_token) };
}

async function run() {
  const session = await getShopifyToken();
  if (!session) {
    console.log("No token");
    return;
  }

  const endpoint = `https://${session.shop}/admin/api/2024-10/graphql.json`;
  const query = `
    query {
      __type(name: "ProductSetInput") {
        inputFields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': session.token
      },
      body: JSON.stringify({ query })
    });

    const json = await response.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
