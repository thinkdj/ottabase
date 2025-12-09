import { createHash } from 'crypto';

/**
 * Generate a SHA-256 checksum for migration content
 * This is used to verify that migrations haven't been modified after being applied
 */
export function generateChecksum(content: string): string {
  return createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

/**
 * Verify that a migration's content matches its recorded checksum
 */
export function verifyChecksum(content: string, expectedChecksum: string): boolean {
  const actualChecksum = generateChecksum(content);
  return actualChecksum === expectedChecksum;
}
