import { client, connectXrplClient } from "../testnet";
import { 
  AMMCreate, 
  TxResponse, 
  Amount, 
  Wallet
} from "xrpl";
import * as xrpl from "xrpl";

interface IssuerWallet {
  classicAddress: string;
}

interface CreateAMMResult {
  ammAccount: string;
  currency_a: string;
  currency_b: string;
}

/**
 * Creates an AMM on the XRPL
 * @param treasuryWallet - Treasury Wallet object with .seed
 * @param issuerWallets - Array of issuer wallet(s)
 * @param assetAType - Asset A (e.g., XRP or token code)
 * @param amountA - Amount for asset A
 * @param assetBType - Asset B (e.g., USD, XRP)
 * @param amountB - Amount for asset B
 * @param fee - Trading fee in basis points
 * @returns AMM metadata
 */
export default async function createAMM(
  treasuryWallet: Wallet,
  issuerWallets: IssuerWallet[],
  assetAType: string,
  amountA: string | number,
  assetBType: string,
  amountB: string | number,
  fee: string | number,
): Promise<CreateAMMResult> {
  await connectXrplClient();
  console.log("✅ Preparing AMM creation...");

  const issuerWallet = issuerWallets?.[0];
  if (!issuerWallet) throw new Error("Missing issuer wallet.");

  const parsedAmountA = parseFloat(amountA.toString());
  const parsedAmountB = parseFloat(amountB.toString());
  const tradingFee = parseFloat(fee.toString());

  if (isNaN(parsedAmountA) || parsedAmountA <= 0) {
    throw new Error("Invalid or missing amount for Asset A.");
  }
  if (isNaN(parsedAmountB) || parsedAmountB <= 0) {
    throw new Error("Invalid or missing amount for Asset B.");
  }

  // No need to uppercase, assume assetAType and assetBType are already uppercase currency codes
  const A = assetAType;
  const B = assetBType;

  // Sort currencies alphabetically to ensure consistent ordering
  const currencies = [A, B].sort();

  // Prepare assets for transaction
  const assetA: Amount = A === "XRP"
    ? xrpl.xrpToDrops(parsedAmountA.toString())
    : {
        currency: A,
        issuer: issuerWallet.classicAddress,
        value: parsedAmountA.toString(),
      };

  const assetB: Amount = B === "XRP"
    ? xrpl.xrpToDrops(parsedAmountB.toString())
    : {
        currency: B,
        issuer: issuerWallet.classicAddress,
        value: parsedAmountB.toString(),
      };

  // change the fee (in drops) to create AMM
  const tx: AMMCreate = {
    TransactionType: "AMMCreate",
    Account: treasuryWallet.classicAddress,
    TradingFee: tradingFee,
    Amount: assetA,
    Amount2: assetB,
    Fee: "2000000",
    Flags: 0,
  };

  console.log("📜 AMM Create transaction:", JSON.stringify(tx, null, 2));

  const preparedTx = await client.autofill(tx);
  preparedTx.Fee = "2000000";
  preparedTx.LastLedgerSequence = (preparedTx.LastLedgerSequence || 0) + 50;

  // Submit the transaction
  const signedTx = treasuryWallet.sign(preparedTx);
  const submission: TxResponse = await client.submitAndWait(signedTx.tx_blob);

  // submitAndWait() throws on failure, so if we reach here, it succeeded
  console.log("✅ AMM created successfully!");


  // Search for the AMM account by looking at the transaction metadata
  const txHash = submission.result.hash;
  const txResponse = await client.request({
    command: "tx",
    transaction: txHash,
    ledger_index: "validated"
  });
  
  // Extract AMM account from the transaction metadata
  const meta = txResponse.result.meta as any;
  let ammAccount: string | undefined;
  
  if (meta?.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if (node.CreatedNode?.LedgerEntryType === "AMM") {
        ammAccount = node.CreatedNode.NewFields?.Account;
        break;
      }
    }
  }
  
  if (!ammAccount) {
    throw new Error("Could not find AMM account after creation.");
  }

  // Return the actual AMM account ID
  return {
    ammAccount,
    currency_a: currencies[0],
    currency_b: currencies[1],
  };
}
