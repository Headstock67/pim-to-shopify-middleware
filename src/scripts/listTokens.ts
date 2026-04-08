import { db } from '../services/db';

/**
 * CLI Tool for listing all authentication tokens.
 * Explicitly avoids selecting the secret_hash column to prevent sensitive data exposure.
 * Usage: npx ts-node src/scripts/listTokens.ts
 */
async function main() {
  const query = `
    SELECT token_id, user_id, role, created_at, revoked_at 
    FROM api_tokens
    ORDER BY created_at DESC
  `;

  try {
    const result = await db.query(query);
    console.log(`\nFound ${result.rowCount} tokens:\n`);
    console.table(result.rows);
  } catch (error: any) {
    console.error('Failed to list tokens:', error.message);
  } finally {
    await db.end();
  }
}

main();
