import { client, connectXRPLClient } from "../testnet";
import { Wallet } from "xrpl";

/**
 * Oracle Delete Controller - Delete Price Oracles from XRPL
 * Based on XRPL Commons documentation: https://docs.xrpl-commons.org/xrpl-basics/price-oracles
 */

interface OracleDeleteResult {
  success: boolean;
  transactionHash: string;
  oracleDocumentID: number;
  ledgerIndex: number;
  result: any;
}

/**
 * Delete a Price Oracle from XRPL ledger
 * @param ownerWallet - XRPL wallet object (must be the oracle owner)
 * @param oracleDocumentID - Unique identifier of the oracle to delete
 * @returns Transaction result
 */
export async function oracleDelete(
  ownerWallet: Wallet, 
  oracleDocumentID: number
): Promise<OracleDeleteResult> {
  try {
    await connectXRPLClient();

    console.log(`🗑️ Deleting Price Oracle (ID: ${oracleDocumentID})`);
    console.log(`   👤 Owner: ${ownerWallet.classicAddress}`);

    const oracleDeleteTx = {
      TransactionType: "OracleDelete" as const,
      Account: ownerWallet.classicAddress,
      OracleDocumentID: oracleDocumentID
    };

    console.log(`📜 Submitting OracleDelete transaction...`);

    try {
      const response = await client.submitAndWait(oracleDeleteTx, { 
        autofill: true, 
        wallet: ownerWallet 
      });
      
      console.log("✅ OracleDelete Transaction Result:", response);
      
      if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
        console.log(`🎉 Price Oracle ${oracleDocumentID} deleted successfully!`);
        console.log(`📋 Transaction Hash: ${response.result.hash}`);
        
        return {
          success: true,
          transactionHash: response.result.hash,
          oracleDocumentID: oracleDocumentID,
          ledgerIndex: response.result.ledger_index,
          result: response.result
        };
      } else {
        throw new Error(`Transaction failed: ${(response.result.meta as any).TransactionResult}`);
      }
      
    } catch (error) {
      console.error("❌ Failed to submit OracleDelete transaction:", error);
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error in oracleDelete:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
