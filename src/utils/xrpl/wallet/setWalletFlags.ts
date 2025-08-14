import { client, connectXrplClient } from "../testnet";
import { AccountSet, Wallet } from "xrpl";
import { isTransactionSuccessful, getTransactionResult } from "../errorHandler";
import { WalletFlagsResult } from "@/types/xrpl/wallet/walletXRPLTypes";

interface FlagConfig {
  name: string;
  flag: number;
  offset: number;
}


/**
 * Set flags for issuer wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setIssuerWalletFlags(wallet: Wallet): Promise<WalletFlagsResult> {
  try {
    // THROW: System validation
    if (!wallet?.classicAddress) {
      throw new Error("⚠️ Wallet is missing or has no classicAddress.");
    }

    // THROW: Infrastructure
    await connectXrplClient();
    
    // THROW: Critical XRPL operation
    const accountInfo = await client.request({
      command: "account_info",
      account: wallet.classicAddress,
      ledger_index: "validated",
    });

    if (!accountInfo.result.account_data) {
      throw new Error("Account not found on XRPL");
    }

    const sequence = accountInfo.result.account_data.Sequence;
    const latestLedgerSequence = accountInfo.result.ledger_index;

    // Define flags to be set with corresponding offsets
    const flags: FlagConfig[] = [
      { name: "asfDisallowXRP", flag: 3, offset: 20 },
      { name: "asfDefaultRipple", flag: 8, offset: 40 },
      { name: "asfAllowTrustLineClawback", flag: 16, offset: 60 },
    ];

    for (let i = 0; i < flags.length; i++) {
      const { name, flag, offset } = flags[i];
      console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

      try {
        const tx: AccountSet = {
          TransactionType: "AccountSet",
          Account: wallet.classicAddress,
          SetFlag: flag,
          LastLedgerSequence: latestLedgerSequence + offset,
          Sequence: sequence + i,
        };

        const prepared = await client.autofill(tx);
        const signed = wallet.sign(prepared);
        const txResult = await client.submitAndWait(signed.tx_blob);

        // RETURN success: false: Expected XRPL business rule violation
        if (!isTransactionSuccessful(txResult)) {
          const errorCode = getTransactionResult(txResult);
          return {
            success: false,
            error: `Failed to set ${name} flag: ${errorCode}`
          };
        }

        console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);

      } catch (flagError) {
        // THROW: Unexpected flag operation failure
        throw new Error(`Unexpected error setting ${name} flag: ${flagError instanceof Error ? flagError.message : 'Unknown error'}`);
      }
    }

    // All flags set successfully
    return { success: true };

  } catch (error) {
    // Re-throw system errors with context
    throw new Error(`Failed to set issuer wallet flags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Set flags for treasury wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setTreasuryWalletFlags(wallet: Wallet): Promise<WalletFlagsResult> {
  try {
    // THROW: System validation
    if (!wallet?.classicAddress) {
      throw new Error("Wallet is missing or has no classicAddress.");
    }

    // THROW: Infrastructure
    await connectXrplClient();
    
    // THROW: Critical XRPL operation
    const accountInfo = await client.request({
      command: "account_info",
      account: wallet.classicAddress,
      ledger_index: "validated",
    });

    if (!accountInfo.result.account_data) {
      throw new Error("Account not found on XRPL");
    }

    const sequence = accountInfo.result.account_data.Sequence;
    const latestLedgerSequence = accountInfo.result.ledger_index;

    // Define flags to be set with corresponding offsets
    const flags: FlagConfig[] = [
      { name: "asfDepositAuth", flag: 9, offset: 20 }
    ];

    for (let i = 0; i < flags.length; i++) {
      const { name, flag, offset } = flags[i];
      console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

      try {
        const tx: AccountSet = {
          TransactionType: "AccountSet",
          Account: wallet.classicAddress,
          SetFlag: flag,
          LastLedgerSequence: latestLedgerSequence + offset,
          Sequence: sequence + i,
        };

        const prepared = await client.autofill(tx);
        const signed = wallet.sign(prepared);
        const txResult = await client.submitAndWait(signed.tx_blob);

        // RETURN success: false: Expected XRPL business rule violation
        if (!isTransactionSuccessful(txResult)) {
          const errorCode = getTransactionResult(txResult);
          return {
            success: false,
            error: `Failed to set ${name} flag: ${errorCode}`
          };
        }

        console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);

      } catch (flagError) {
        // THROW: Unexpected flag operation failure
        throw new Error(`Unexpected error setting ${name} flag: ${flagError instanceof Error ? flagError.message : 'Unknown error'}`);
      }
    }

    // All flags set successfully
    return { success: true };

  } catch (error) {
    // Re-throw system errors with context
    throw new Error(`Failed to set treasury wallet flags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Set flags for pathfind wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setPathfindWalletFlags(wallet: Wallet): Promise<WalletFlagsResult> {
  try {
    // THROW: System validation
    if (!wallet?.classicAddress) {
      throw new Error("Wallet is missing or has no classicAddress.");
    }

    // THROW: Infrastructure
    await connectXrplClient();
    
    // THROW: Critical XRPL operation
    const accountInfo = await client.request({
      command: "account_info",
      account: wallet.classicAddress,
      ledger_index: "validated",
    });

    if (!accountInfo.result.account_data) {
      throw new Error("Account not found on XRPL");
    }

    const sequence = accountInfo.result.account_data.Sequence;
    const latestLedgerSequence = accountInfo.result.ledger_index;

    // Define flags to be set with corresponding offsets
    const flags: FlagConfig[] = [];

    // No flags to set, return success
    if (flags.length === 0) {
      return { success: true };
    }

    for (let i = 0; i < flags.length; i++) {
      const { name, flag, offset } = flags[i];
      console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

      try {
        const tx: AccountSet = {
          TransactionType: "AccountSet",
          Account: wallet.classicAddress,
          SetFlag: flag,
          LastLedgerSequence: latestLedgerSequence + offset,
          Sequence: sequence + i,
        };

        const prepared = await client.autofill(tx);
        const signed = wallet.sign(prepared);
        const txResult = await client.submitAndWait(signed.tx_blob);

        // RETURN success: false: Expected XRPL business rule violation
        if (!isTransactionSuccessful(txResult)) {
          const errorCode = getTransactionResult(txResult);
          return {
            success: false,
            error: `Failed to set ${name} flag: ${errorCode}`
          };
        }

        console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);

      } catch (flagError) {
        // THROW: Unexpected flag operation failure
        throw new Error(`Unexpected error setting ${name} flag: ${flagError instanceof Error ? flagError.message : 'Unknown error'}`);
      }
    }

    // All flags set successfully
    return { success: true };

  } catch (error) {
    // Re-throw system errors with context
    throw new Error(`Failed to set pathfind wallet flags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
