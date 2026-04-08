import { randomBytes, createHash } from 'crypto';
import { db } from '../services/db';

/**
 * CLI Tool for creating a new permanent authentication bearer token.
 * Generates an unrecoverable secret, hashes it instantly, and provisions it cleanly.
 * Usage: npx ts-node src/scripts/createToken.ts [userId] [role]
 */
async function main() {
  const userId = process.argv[2] || 'system_admin';
  const role = process.argv[3] || 'admin';

  // 1. Generate strong cryptographic payloads
  const tokenId = randomBytes(8).toString('hex');
  const tokenSecret = randomBytes(32).toString('base64url');
  
  const formattedToken = `${tokenId}.${tokenSecret}`;
  const secretHash = createHash('sha256').update(tokenSecret).digest('hex');

  const query = `
    INSERT INTO api_tokens (token_id, secret_hash, user_id, role)
    VALUES ($1, $2, $3, $4)
  `;

  try {
    // 2. Insert into the database
    await db.query(query, [tokenId, secretHash, userId, role]);
    
    // 3. Print exactly once preventing future retrieval cleanly separating header components
    console.log(`\nToken created successfully!`);
    console.log(`User ID: ${userId}`);
    console.log(`Role:    ${role}`);
    console.log(`\nRaw Token String:`);
    console.log(`${formattedToken}`);
    console.log(`\nAuthorization Header Usage:`);
    console.log(`Bearer ${formattedToken}`);
    console.log(`\n[!] Store this token immediately. The secret cannot be retrieved again.\n`);
  } catch (error: any) {
    console.error('Failed to create token:', error.message);
  } finally {
    // End the pool so the script can exit cleanly without hanging the bash terminal
    await db.end();
  }
}

main();
