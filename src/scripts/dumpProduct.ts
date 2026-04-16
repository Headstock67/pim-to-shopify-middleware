import { executeShopifyGraphQL, getShopifyToken } from '../services/shopify/productSync';
require('dotenv').config();

async function run() {
  const shop = "onlycardz.myshopify.com";
  const token = await getShopifyToken(shop);
  const query = `
    query {
      product(id: "gid://shopify/Product/15453947953527") {
        id
        status
        publishedAt
        isPublished
        category { id name }
        tags
        metafields(first: 50) {
          edges { node { namespace key value type } }
        }
      }
    }
  `;
  const result = await executeShopifyGraphQL(shop, token!, query, {}, "dump-123");
  console.log(JSON.stringify(result, null, 2));
}
run().catch(console.error);
