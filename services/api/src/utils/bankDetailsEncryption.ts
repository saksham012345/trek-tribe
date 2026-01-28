import crypto from 'crypto';

/**
 * Bank Details Encryption Utility
 * Uses AES-256-GCM for encrypting sensitive bank account information
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Get encryption key from environment or generate a secure one
const getEncryptionKey = (): Buffer => {
    const key = process.env.BANK_DETAILS_ENCRYPTION_KEY;

    if (!key) {
        console.warn('⚠️  BANK_DETAILS_ENCRYPTION_KEY not set in environment variables!');
        console.warn('   Using fallback key - NOT SECURE FOR PRODUCTION!');
        // Fallback key for development only - MUST be set in production
        return crypto.scryptSync('fallback-key-change-in-production', 'salt', 32);
    }

    // Derive a 32-byte key from the environment variable
    return crypto.scryptSync(key, 'trektribe-bank-salt', 32);
};

/**
 * Encrypt sensitive bank details
 * @param plaintext - The sensitive data to encrypt (e.g., account number)
 * @returns Encrypted string in base64 format
 */
export function encryptBankDetail(plaintext: string): string {
    if (!plaintext) {
        return '';
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);

    return result.toString('base64');
}

/**
 * Decrypt bank details
 * @param encryptedData - The encrypted data in base64 format
 * @returns Decrypted plaintext string
 */
export function decryptBankDetail(encryptedData: string): string {
    if (!encryptedData) {
        return '';
    }

    try {
        const key = getEncryptionKey();
        const buffer = Buffer.from(encryptedData, 'base64');

        // Extract components
        const salt = buffer.slice(0, SALT_LENGTH);
        const iv = buffer.slice(SALT_LENGTH, TAG_POSITION);
        const tag = buffer.slice(TAG_POSITION, ENCRYPTED_POSITION);
        const encrypted = buffer.slice(ENCRYPTED_POSITION);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('❌ Error decrypting bank detail:', error);
        throw new Error('Failed to decrypt bank details');
    }
}

/**
 * Mask bank account number for display (show only last 4 digits)
 * @param accountNumber - The account number to mask
 * @returns Masked account number (e.g., "****1234")
 */
export function maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) {
        return '****';
    }

    const lastFour = accountNumber.slice(-4);
    return `****${lastFour}`;
}

/**
 * Validate IFSC code format
 * @param ifscCode - The IFSC code to validate
 * @returns true if valid, false otherwise
 */
export function validateIFSC(ifscCode: string): boolean {
    // IFSC format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifscCode);
}

/**
 * Validate UPI ID format
 * @param upiId - The UPI ID to validate
 * @returns true if valid, false otherwise
 */
export function validateUPI(upiId: string): boolean {
    // UPI format: username@bankname
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    return upiRegex.test(upiId);
}

/**
 * Generate a secure encryption key for environment variable
 * Run this once and store the output in BANK_DETAILS_ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('base64');
}
