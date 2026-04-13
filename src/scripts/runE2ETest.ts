import fs from 'fs';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { db } from '../services/db';

async function runAutonomousE2E() {
  console.log(`\n==============================================`);
  console.log(`🚀 Bootstrapping Autonomous E2E Test Sequence`);
  console.log(`==============================================`);

  let shopUrl = '';
  const testTokenId = `e2e_test_${randomBytes(4).toString('hex')}`;
  const testTokenSecret = randomBytes(16).toString('hex');
  const secretHash = createHash('sha256').update(testTokenSecret).digest('hex');
  const fullToken = `${testTokenId}.${testTokenSecret}`;

  try {
    // 1. Resolve Target Shop natively via project database
    const shopResult = await db.query('SELECT shop FROM shopify_sessions WHERE is_offline = true LIMIT 1');
    if (shopResult.rowCount === 0) {
      console.error("❌ FAILURE: No active offline Shopify session found natively in the database to target.");
      process.exit(1);
    }
    shopUrl = shopResult.rows[0].shop;
    console.log(`✅ Target Shop Resolved cleanly: ${shopUrl}`);

    // 2. Provision Temporary Authenticated Sequence
    await db.query(`
      INSERT INTO api_tokens (token_id, secret_hash, user_id, role)
      VALUES ($1, $2, $3, $4)
    `, [testTokenId, secretHash, 'system-e2e-tester', 'admin']);
    console.log(`✅ Temporary Authorization Token injected locally & securely.`);

  } catch (err: any) {
    console.error("❌ Database Bootstrap Error dynamically:", err.message);
    process.exit(1);
  }

  const endpoint = `http://localhost:4000/api/pim-import/product?shop=${shopUrl}`;
  const files = [
    'ShopifyTestProductWithVariant_DB.json',
    'ShopifyTestProductWithFutureReleaseDate_DB.json'
  ];

  for (const file of files) {
    console.log(`\n--- Starting ingestion test for payload: ${file} ---`);
    const filePath = path.join(__dirname, '../../', file);
    
    try {
      const payloadString = fs.readFileSync(filePath, 'utf8');
      const payload = JSON.parse(payloadString);

      // Core Mitigation: Apply [TEST ONLY] prefix
      if (payload.product && payload.product.title) {
        payload.product.title = `[TEST ONLY] - ${payload.product.title}`;
        console.log(`🔒 Mitigation Applied cleanly: Title revised centrally to prevent namespace overlap.`);
      }

      console.log(`📡 Dispatching POST request to inherently local integration endpoint...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fullToken}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (response.ok) {
         console.log(`✅ SUCCESS [HTTP 200]: Integration executed smoothly natively for ${file}.`);
         console.dir(responseData, { depth: null, colors: true });
      } else {
         console.error(`❌ FAILURE [HTTP ${response.status}]: Structurally rejected mapping for ${file}.`);
         console.error(JSON.stringify(responseData, null, 2));
      }
    } catch (err: any) {
      console.error(`❌ INTERNAL ERROR natively: Could not process structured file: ${file}`);
      console.error(err.message);
    }
  }

  // Teardown Protocol: Eradicate token immediately to keep auth layer secure natively
  try {
    await db.query('DELETE FROM api_tokens WHERE token_id = $1', [testTokenId]);
    console.log(`\n✅ Database Teardown Complete: Temporary auth token removed cleanly from central registry.`);
  } catch(err) {
    console.error(`⚠️ Warning: Failed to securely clean test token dynamically: ${testTokenId}`);
  }

  console.log(`\n==============================================`);
  console.log(`🏁 Execution sequence finalized natively. Proceed to manual product deletion centrally closely securely inside Shopify Admin.`);
  console.log(`==============================================\n`);
  
  process.exit(0);
}

runAutonomousE2E();
