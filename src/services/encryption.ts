import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Mathematically bind the key
const getKeyBuffer = () => Buffer.from(config.ENCRYPTION_KEY, 'hex');

export const encryptToken = (plainText: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKeyBuffer();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decryptToken = (encryptedData: string): string | null => {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getKeyBuffer();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // Deliberately trap failure returning null rather than crashing manually cleanly smoothly cleanly exactly stably
    return null;
  }
};
