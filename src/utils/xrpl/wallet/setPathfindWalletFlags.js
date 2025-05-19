import { client, connectXrplClient } from "../testnet";

export default async function setPathfindWalletFlags(wallet) {
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
  const flags = [];

  for (let i = 0; i < flags.length; i++) {
    const { name, flag, offset } = flags[i];
    console.log(`🔹 Setting ${name} flag for ${wallet.classicAddress}...`);

    const tx = {
      TransactionType: "AccountSet",
      Account: wallet.classicAddress,
      SetFlag: flag,
      LastLedgerSequence: latestLedgerSequence + offset,
      Sequence: sequence + i,
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult !== "tesSUCCESS") {
      console.error(
        `Failed to set ${name}:`,
        result.result.meta.TransactionResult,
      );
      throw new Error(
        `Failed to set ${name} flag: ${result.result.meta.TransactionResult} [setPathfindWalletFlags.js]`,
      );
    }

    console.log(`✅ ${name} flag set for ${wallet.classicAddress}`);
  }
  return;
}
