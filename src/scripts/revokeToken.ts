import { db } from '../services/db';

/**
 * CLI Tool for revoking an assigned token by its ID.
 * Updates the 'revoked_at' flag rendering it permanently invalid.
 * Usage: npx ts-node src/scripts/revokeToken.ts <token_id>
 */
async function main() {
  const tokenId = process.argv[2];

  if (!tokenId) {
    console.error('Usage: npx ts-node src/scripts/revokeToken.ts <token_id>');
    process.exit(1);
  }

  const query = `
    UPDATE api_tokens 
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_id = $1
    RETURNING token_id, revoked_at
  `;

  try {
    const result = await db.query(query, [tokenId]);
    if (result.rowCount === 0) {
      console.error(`Token ID '${tokenId}' not found in the database.`);
    } else {
      console.log(`Successfully revoked token '${tokenId}' at ${result.rows[0].revoked_at}`);
    }
  } catch (error: any) {
    console.error('Failed to revoke token:', error.message);
  } finally {
    // End the pool so the script can exit cleanly without hanging
    await db.end();
  }
}

main();
