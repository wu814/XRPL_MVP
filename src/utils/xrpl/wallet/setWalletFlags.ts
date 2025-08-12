import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

interface FlagConfig {
  name: string;
  flag: number;
  offset: number;
}

/**
 * Set flags for issuer wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setIssuerWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();
  
  if (!wallet || !wallet.classicAddress) {
    throw new Error("⚠️ Wallet is missing or has no classicAddress.");
  }

  const accountInfo = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
    ledger_index: "validated",
  });

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

    const tx: xrpl.AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.classicAddress,
      SetFlag: flag,
      LastLedgerSequence: latestLedgerSequence + offset,
      Sequence: sequence + i,
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if ((result.result.meta as any).TransactionResult !== "tesSUCCESS") {
      console.error(
        `❌ Failed to set ${name}:`,
        (result.result.meta as any).TransactionResult,
      );
      throw new Error(
        `Failed to set ${name} flag: ${(result.result.meta as any).TransactionResult} [setWalletFlags.ts]`,
      );
    }

    console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);
  }
}

/**
 * Set flags for treasury wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setTreasuryWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();
  
  if (!wallet || !wallet.classicAddress) {
    throw new Error("Wallet is missing or has no classicAddress.");
  }

  const accountInfo = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
    ledger_index: "validated",
  });

  const sequence = accountInfo.result.account_data.Sequence;
  const latestLedgerSequence = accountInfo.result.ledger_index;

  // Define flags to be set with corresponding offsets
  const flags: FlagConfig[] = [
    { name: "asfDepositAuth", flag: 9, offset: 20 }
  ];

  for (let i = 0; i < flags.length; i++) {
    const { name, flag, offset } = flags[i];
    console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

    const tx: xrpl.AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.classicAddress,
      SetFlag: flag,
      LastLedgerSequence: latestLedgerSequence + offset,
      Sequence: sequence + i,
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if ((result.result.meta as any).TransactionResult !== "tesSUCCESS") {
      console.error(
        `Failed to set ${name}:`,
        (result.result.meta as any).TransactionResult,
      );
      throw new Error(
        `Failed to set ${name} flag: ${(result.result.meta as any).TransactionResult} [setWalletFlags.ts]`,
      );
    }

    console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);
  }
}

/**
 * Set flags for pathfind wallet with proper sequence management and offsets
 * @param wallet - XRPL wallet instance
 */
export async function setPathfindWalletFlags(wallet: xrpl.Wallet): Promise<void> {
  await connectXrplClient();
  
  if (!wallet || !wallet.classicAddress) {
    throw new Error("Wallet is missing or has no classicAddress.");
  }

  const accountInfo = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
    ledger_index: "validated",
  });

  const sequence = accountInfo.result.account_data.Sequence;
  const latestLedgerSequence = accountInfo.result.ledger_index;

  // Define flags to be set with corresponding offsets
  const flags: FlagConfig[] = [];

  for (let i = 0; i < flags.length; i++) {
    const { name, flag, offset } = flags[i];
    console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

    const tx: xrpl.AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.classicAddress,
      SetFlag: flag,
      LastLedgerSequence: latestLedgerSequence + offset,
      Sequence: sequence + i,
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if ((result.result.meta as any).TransactionResult !== "tesSUCCESS") {
      console.error(
        `Failed to set ${name}:`,
        (result.result.meta as any).TransactionResult,
      );
      throw new Error(
        `Failed to set ${name} flag: ${(result.result.meta as any).TransactionResult} [setWalletFlags.ts]`,
      );
    }

    console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);
  }
}
