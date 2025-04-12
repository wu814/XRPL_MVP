// src/client.js
const xrpl = require("xrpl");

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

const connectXrplClient = async () => {
  if (!client.isConnected()) {
    console.log("Connecting to XRPL Testnet...");
    try {
      await client.connect();
      console.log("✅ Connected to XRPL Testnet");
    } catch (error) {
      console.error("❌ Failed to connect to XRPL Testnet:", error);
      throw error;
    }
  }
};

module.exports = { client, connectXrplClient };
