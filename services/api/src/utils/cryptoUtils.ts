import crypto from 'crypto';

/**
 * Generate a cryptographically secure random salt
 */
export const generateSalt = (length: number = 16): string => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash data with a salt using SHA-256
 */
export const hashWithSalt = (data: string, salt: string): string => {
    const hash = crypto.createHash('sha256');
    hash.update(data + salt);
    return hash.digest('hex');
};

/**
 * Verify if data matches a given hash and salt
 */
export const verifyHash = (data: string, salt: string, originalHash: string): boolean => {
    const newHash = hashWithSalt(data, salt);
    return newHash === originalHash;
};
