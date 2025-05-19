// src/client.js
import * as xrpl from "xrpl";
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

export { client, connectXrplClient };
