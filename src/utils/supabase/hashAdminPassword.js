const bcrypt = require("bcryptjs");

async function generateHashedPassword() {
  const adminPlaintext = "fullsend"; // Replace with your desired password
  const saltRounds = 12; // Adjust cost factor as needed

  try {
    const hashedPassword = await bcrypt.hash(adminPlaintext, saltRounds);
    console.log("Hashed password:", hashedPassword);
    // You can now copy this hashed password and use it in your INSERT/UPDATE query.
  } catch (error) {
    console.error("Error hashing password:", error);
  }
}

generateHashedPassword();
