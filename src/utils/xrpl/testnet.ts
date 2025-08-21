// src/utils/xrpl/testnet.ts
import * as xrpl from "xrpl";

export const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");

export const connectXRPLClient = async (): Promise<void> => {
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
