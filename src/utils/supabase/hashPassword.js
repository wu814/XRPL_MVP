const bcrypt = require("bcryptjs");

/**
 * Hash a password using bcrypt
 * @param {string} password - The plain text password to hash
 * @param {number} saltRounds - The number of salt rounds (default: 12)
 * @returns {Promise<string>} - The hashed password
 */
export async function hashPassword(password, saltRounds = 12) {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Verify a password against a hash
 * @param {string} password - The plain text password to verify
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>} - Whether the password matches
 */
export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Error verifying password:", error);
    throw new Error("Failed to verify password");
  }
}
