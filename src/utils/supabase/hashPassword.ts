import bcrypt from "bcryptjs";

/**
 * Hash a password using bcrypt
 * @param password - The plain text password to hash
 * @param saltRounds - The number of salt rounds (default: 12)
 * @returns The hashed password
 */
export async function hashPassword(password: string, saltRounds: number = 12): Promise<string> {
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
 * @param password - The plain text password to verify
 * @param hash - The hash to compare against
 * @returns Whether the password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Error verifying password:", error);
    throw new Error("Failed to verify password");
  }
}
