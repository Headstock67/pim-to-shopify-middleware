import { db } from './src/services/db';

async function verifyProducts() {
  console.log(`\n==============================================`);
  console.log(`🔍 Live GraphQL Verification Sequence`);
  console.log(`==============================================`);

  try {
    const shopResult = await db.query('SELECT shop, access_token FROM shopify_sessions WHERE is_offline = true AND shop = $1 LIMIT 1', ['onlycardz.myshopify.com']);
    if (shopResult.rowCount === 0) {
      console.error("❌ No active offline Shopify session found for verification.");
      process.exit(1);
    }
    
    const { shop, access_token } = shopResult.rows[0];
    
    const query = `
      query {
        nodes(ids: ["gid://shopify/Product/15453947920759", "gid://shopify/Product/15453947953527"]) {
          ... on Product {
            id
            title
            handle
            status
            totalInventory
          }
        }
      }
    `;

    console.log(`📡 Dispatching Native GraphQL Query to ${shop}...`);
    const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': access_token
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    console.log(`\n✅ LIVE RESULTS EXTRACTED FROM SHOPIFY:\n`);
    console.dir(data, { depth: null, colors: true });

    console.log(`\n==============================================`);
    console.log(`✅ Verification Complete. Products retained natively for manual evaluation.`);
    console.log(`Admin Links:`);
    console.log(`- https://admin.shopify.com/store/onlycardz/products/15453947920759`);
    console.log(`- https://admin.shopify.com/store/onlycardz/products/15453947953527`);
    console.log(`==============================================\n`);

  } catch (err: any) {
    console.error("❌ Verification Error:", err.message);
  } finally {
    process.exit(0);
  }
}

verifyProducts();
