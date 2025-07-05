import { client, connectXrplClient } from "../testnet";

/**
 * Oracle Delete Controller - Delete Price Oracles from XRPL
 * Based on XRPL Commons documentation: https://docs.xrpl-commons.org/xrpl-basics/price-oracles
 */


/**
 * Delete a Price Oracle from XRPL ledger
 * @param {Wallet} ownerWallet - XRPL wallet object (must be the oracle owner)
 * @param {number} oracleDocumentID - Unique identifier of the oracle to delete
 * @returns {Promise<object>} Transaction result
 */
export async function oracleDelete(ownerWallet, oracleDocumentID) {
  try {
    await connectXrplClient();

    console.log(`🗑️ Deleting Price Oracle (ID: ${oracleDocumentID})`);
    console.log(`   👤 Owner: ${ownerWallet.classicAddress}`);

    const oracleDeleteTx = {
      TransactionType: "OracleDelete",
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
      
      if (response.result.meta.TransactionResult === "tesSUCCESS") {
        console.log(`🎉 Price Oracle ${oracleDocumentID} deleted successfully!`);
        console.log(`📋 Transaction Hash: ${response.result.hash}`);
        
        return {
          success: true,
          transactionHash: response.result.hash,
          oracleDocumentID: oracleDocumentID,
          ledgerIndex: response.result.ledger_index,
          fee: response.result.Fee,
          result: response.result
        };
      } else {
        throw new Error(`Transaction failed: ${response.result.meta.TransactionResult}`);
      }
      
    } catch (error) {
      console.error("❌ Failed to submit OracleDelete transaction:", error);
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error in oracleDelete:`, error.message);
    throw error;
  }
};