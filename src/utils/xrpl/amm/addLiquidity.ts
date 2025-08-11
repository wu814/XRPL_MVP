import { client, connectXrplClient } from "../testnet";
import { Wallet, IssuedCurrencyAmount } from "xrpl";
import * as xrpl from "xrpl";
import { checkTrustline } from "@/utils/xrpl/trustline/setTrustline";
import BigNumber from "bignumber.js";
import { XRPLErrorHandler } from '../errorHandler';

const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP


interface Asset {
  currency: string;
  issuer?: string;
  value: string;
}


interface TransactionResult {
  result: {
    hash: string;
    meta: {
      AffectedNodes: any[];
    };
    tx_json?: {
      Account: string;
      Fee: string;
    };
    AMMAccount?: string;
  };
}

interface TransactionDetails {
  output: string;
  success: boolean;
}

interface BalanceResponse {
  result: {
    lines: Array<{
      currency: string;
      balance: string;
      account: string;
    }>;
  };
}

interface AccountInfoResponse {
  result: {
    account_data: {
      Balance: string;
      OwnerCount?: number;
    };
  };
}

interface AMMInfoResponse {
  result: {
    amm?: {
      amount: string | { currency: string; issuer: string; value: string };
      amount2: string | { currency: string; issuer: string; value: string };
      lp_token: { currency: string; value: string };
      asset?: { currency: string; issuer: string };
      asset2?: { currency: string; issuer: string };
    };
  };
}

interface LedgerResponse {
  result: {
    ledger_current_index: number;
  };
}

// Extract and display LP tokens received from transaction metadata
export async function extractLPTokensReceived(
  result: TransactionResult,
  providerWallet: Wallet,
  ammAccount: string,
): Promise<IssuedCurrencyAmount | null> {
  // The LPTokenOut is in the AffectedNodes array
  let lpTokensReceived: IssuedCurrencyAmount | null = null;
  const nodes = result.result.meta.AffectedNodes || [];

  // First pass: Look for trustline modifications to find LP token receipt
  for (const node of nodes) {
    // Check for modified trustlines to find LP token change
    if (
      node.ModifiedNode &&
      node.ModifiedNode.LedgerEntryType === "RippleState"
    ) {
      const state = node.ModifiedNode;

      // LP tokens typically have a 40-character currency code
      if (
        !state.FinalFields?.Balance?.currency ||
        state.FinalFields.Balance.currency.length !== 40
      ) {
        continue;
      }

      // Check if this trustline involves the AMM account (issuer of LP tokens)
      const highAccount = state.FinalFields?.HighLimit?.issuer;
      const lowAccount = state.FinalFields?.LowLimit?.issuer;

      // Check if this involves both the wallet and the AMM account
      const involvesWallet =
        highAccount === providerWallet.classicAddress ||
        lowAccount === providerWallet.classicAddress;
      const involvesAMM =
        highAccount === ammAccount || lowAccount === ammAccount;

      if (
        involvesWallet &&
        involvesAMM &&
        state.FinalFields?.Balance &&
        state.PreviousFields?.Balance
      ) {
        const balance = state.FinalFields.Balance;
        const prevBalance = state.PreviousFields.Balance;

        // Calculate the change in token balance from the perspective of the user
        let prevValue = parseFloat(prevBalance.value || "0");
        let finalValue = parseFloat(balance.value || "0");

        // Adjust for balance perspective (RippleState Balance is from LowLimit's perspective)
        const isUserLow = lowAccount === providerWallet.classicAddress;

        // If the user is HighLimit (not LowLimit), we need to negate the balances
        // because the Balance is from LowLimit's perspective
        if (!isUserLow) {
          prevValue = -prevValue;
          finalValue = -finalValue;
        }

        // If final value is higher than previous value, tokens were received
        const diff = finalValue - prevValue;

        if (diff > 0) {
          lpTokensReceived = {
            currency: balance.currency,
            issuer: ammAccount,
            value: diff.toFixed(2),
          };
          break;
        } else {
          console.log(
            `ℹ️ Found LP token entry but balance change was ${diff.toFixed(6)}`,
          );
        }
      }
    }
  }

  // Second pass: Look for created trustlines (for first-time LP token receipts)
  if (!lpTokensReceived) {
    for (const node of nodes) {
      if (
        node.CreatedNode &&
        node.CreatedNode.LedgerEntryType === "RippleState"
      ) {
        const state = node.CreatedNode;

        // LP tokens typically have a 40-character currency code
        if (
          !state.NewFields?.Balance?.currency ||
          state.NewFields.Balance.currency.length !== 40
        ) {
          continue;
        }

        // Check if this involves the AMM account
        const highAccount = state.NewFields?.HighLimit?.issuer;
        const lowAccount = state.NewFields?.LowLimit?.issuer;

        const involvesWallet =
          highAccount === providerWallet.classicAddress ||
          lowAccount === providerWallet.classicAddress;
        const involvesAMM =
          highAccount === ammAccount || lowAccount === ammAccount;

        if (involvesWallet && involvesAMM && state.NewFields?.Balance) {
          const balance = state.NewFields.Balance;
          let value = parseFloat(balance.value || "0");

          // Adjust for balance perspective
          const isUserLow = lowAccount === providerWallet.classicAddress;
          if (!isUserLow) {
            value = -value;
          }

          if (value > 0) {
            console.log(
              `✅ Found newly created LP token trustline: ${value.toFixed(6)} ${balance.currency}`,
            );
            lpTokensReceived = {
              currency: balance.currency,
              issuer: ammAccount,
              value: value.toFixed(6),
            };
            break;
          }
        }
      }
    }
  }

  if (lpTokensReceived) {
    return lpTokensReceived;
  } else {
    // As a fallback, get current LP token balance and report it
    const accountLines = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: ammAccount,
    });

    const lpTokens = accountLines.result.lines.find(
      (line: any) =>
        line.account === ammAccount &&
        line.currency &&
        line.currency.length === 40,
    );

    if (lpTokens) {
      console.log(
        `💰 Current LP Token balance: ${lpTokens.balance} ${lpTokens.currency}`,
      );
      return {
        currency: lpTokens.currency,
        issuer: ammAccount,
        value: parseFloat(lpTokens.balance).toFixed(6),
      };
    } else {
      throw new Error("Could not find any LP token balance.");
    }
  }
}

// Extract the actual assets deposited from transaction metadata
function extractActualAssetsDeposited(result: TransactionResult): Asset[] {
  const nodes = result.result.meta.AffectedNodes || [];
  const assetsDeposited: Asset[] = [];
  // Track assets we've already added to avoid duplicates
  const addedAssets = new Set<string>();

  // Get transaction sender address, make sure this is the exact format result.result.tx_json?.Account
  const senderAddress = result.result.tx_json?.Account;

  // Get AMM account address if present in the transaction
  const ammAccount = result.result.AMMAccount;

  // Look for both token balance changes and XRP balance changes
  for (const node of nodes) {
    // For token deposits (check trustline modifications)
    if (
      node.ModifiedNode &&
      node.ModifiedNode.LedgerEntryType === "RippleState"
    ) {
      const state = node.ModifiedNode;

      if (
        state.FinalFields &&
        state.PreviousFields &&
        state.FinalFields.Balance &&
        state.PreviousFields.Balance
      ) {
        // Get the previous and current balances
        const finalBalance = state.FinalFields.Balance;
        const prevBalance = state.PreviousFields.Balance;

        // Skip if it's not a currency or if it's the LP token (usually has a 40-char currency code)
        if (!finalBalance.currency || finalBalance.currency.length === 40) {
          continue;
        }

        // Skip non-transaction related trustlines
        const highAccount = state.FinalFields.HighLimit?.issuer;
        const lowAccount = state.FinalFields.LowLimit?.issuer;

        // Only process entries where one of the accounts is the sender
        if (highAccount !== senderAddress && lowAccount !== senderAddress) {
          continue;
        }

        // Create a unique key for this asset to avoid duplicates
        // Include the currency and issuer, but not whose perspective the balance is from
        const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
        const assetKey = `${finalBalance.currency}:${issuer}`;

        // Skip if we've already added this asset
        if (addedAssets.has(assetKey)) {
          continue;
        }

        // Check if balance changed
        const prevValue = parseFloat(prevBalance.value || "0");
        const finalValue = parseFloat(finalBalance.value || "0");

        // Determine if this is an incoming or outgoing balance
        // For the sender, a positive value means a decrease in their balance (outgoing/deposit)
        // For the sender, a negative value means an increase in their balance (incoming)
        const isFromSenderPerspective = lowAccount === senderAddress;

        // In RippleState, the Balance field is from LowLimit's perspective
        // So if the sender is LowLimit, a lower final value means they sent funds
        // If the sender is HighLimit, a higher final value means they sent funds
        let diff;
        if (isFromSenderPerspective) {
          diff = prevValue - finalValue; // If positive, sender sent funds
        } else {
          diff = finalValue - prevValue; // If positive, sender sent funds
        }

        // Only add if the sender's balance decreased by a significant amount
        // (i.e., they sent funds)
        if (diff > 0.000001) {
          assetsDeposited.push({
            currency: finalBalance.currency,
            issuer: issuer,
            value: diff.toFixed(6),
          });

          // Mark this asset as processed
          addedAssets.add(assetKey);
        }
      }
    }

    // For XRP deposits (check AccountRoot modifications)
    else if (
      node.ModifiedNode &&
      node.ModifiedNode.LedgerEntryType === "AccountRoot"
    ) {
      const state = node.ModifiedNode;

      // Skip if not the sender's account
      if (state.FinalFields?.Account !== senderAddress) {
        continue;
      }

      if (
        state.FinalFields &&
        state.PreviousFields &&
        state.FinalFields.Balance &&
        state.PreviousFields.Balance
      ) {
        // Calculate the difference in XRP balance (in drops)
        const finalDrops = parseInt(state.FinalFields.Balance);
        const prevDrops = parseInt(state.PreviousFields.Balance);

        // The fee is directly deducted from the account, we need to consider it
        const fee = parseInt(result.result.tx_json?.Fee) || 0;

        // Calculate how much XRP was sent
        const xrpSent = prevDrops - finalDrops - fee;

        // Skip if we've already added XRP
        if (addedAssets.has("XRP")) continue;

        // Only add if a significant amount of XRP was sent (more than just the fee)
        if (xrpSent > 1000) {
          // 1000 drops threshold (0.001 XRP)
          // Convert drops to XRP for display
          const xrpValue = xrpl.dropsToXrp(xrpSent.toString());
          assetsDeposited.push({
            currency: "XRP",
            value: xrpValue.toFixed(6),
          });

          // Mark XRP as processed
          addedAssets.add("XRP");
        }
      }
    }
  }

  // Sort assets by currency
  assetsDeposited.sort((a, b) => a.currency.localeCompare(b.currency));

  if (assetsDeposited.length > 0) {
    return assetsDeposited;
  }

  throw new Error("No assets were detected in the transaction metadata.");
}

function displayTransactionDetails(
  result: TransactionResult, 
  lpTokensReceived: IssuedCurrencyAmount | null, 
  assetsDeposited: Asset[]
): TransactionDetails {
  let output = "\n===== Transaction Details =====\n";

  output += `🔑 Transaction Hash: ${result.result.hash}\n`;

  if (lpTokensReceived) {
    output += `\n📥 LP Tokens Received: ${lpTokensReceived.value}\n   • Token Code: ${lpTokensReceived.currency}\n`;
  }

  if (assetsDeposited && assetsDeposited.length > 0) {
    output += `\n📤 ACTUAL Assets Deposited:\n`;

    const assetsByCurrency: Record<string, Asset[]> = {};
    assetsDeposited.forEach((asset) => {
      const key = asset.currency;
      if (!assetsByCurrency[key]) {
        assetsByCurrency[key] = [];
      }
      assetsByCurrency[key].push(asset);
    });

    Object.entries(assetsByCurrency).forEach(([currency, assets]) => {
      const total = assets.reduce((sum, a) => sum + parseFloat(a.value), 0);
      output += `   • ${total.toFixed(6)} ${currency}\n`;

      const uniqueIssuers = new Set(
        assets.map((a) => a.issuer || "Native XRP"),
      );
      if (uniqueIssuers.size > 1) {
        output += `     Breakdown:\n`;
        assets.forEach((asset) => {
          output += `     - ${asset.value} from issuer: ${asset.issuer || "Native XRP"}\n`;
        });
      }
    });
  } else {
    output += `\n⚠️ No assets were detected as deposited in the transaction metadata.\n`;
  }

  if (result.result.tx_json?.Fee) {
    output += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;
  }

  output += "==============================\n";
  return {
    output,
    success: true,
  };
}

// Double-asset deposit: tfTwoAsset (existing, but now with explicit flag)
export async function addLiquidityTwoAsset(
  providerWallet: Wallet,
  ammAccount: string,
  assetAObj: Asset,
  assetBObj: Asset,
): Promise<TransactionDetails> {
  await connectXrplClient();

  console.log(`✅ Adding liquidity to AMM at ${ammAccount}`);
  console.log(`🔹 Asset A: ${assetAObj.currency} - Amount: ${assetAObj.value}`);
  console.log(`🔹 Asset B: ${assetBObj.currency} - Amount: ${assetBObj.value}`);

  // ========== BALANCE CHECKS ==========

  // Asset A
  if (assetAObj.currency !== "XRP") {
    if (!assetAObj.issuer)
      throw new Error(`Issuer not specified for ${assetAObj.currency}`);

    console.log(`🔍 Checking ${assetAObj.currency} balance...`);
    const balanceResponseA: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetAObj.issuer,
    });

    const assetLineA = balanceResponseA.result.lines.find(
      (line) =>
        line.currency === assetAObj.currency &&
        line.account === assetAObj.issuer,
    );

    if (assetLineA) {
      const balance = new BigNumber(assetLineA.balance);
      const depositAmount = new BigNumber(assetAObj.value);

      if (balance.lt(depositAmount)) {
        throw new Error(`Insufficient ${assetAObj.currency} balance.`);
      }
    } else {
      throw new Error(
        `No trustline found for ${assetAObj.currency} from ${assetAObj.issuer}`,
      );
    }
  } else {
    const accountInfoResponseA: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });

    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponseA.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponseA.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const depositAmount = Number(assetAObj.value);

    if (xrpBalance - reserveXRP < depositAmount) {
      throw new Error(
        `Insufficient XRP balance. Need ${depositAmount + reserveXRP}, have ${xrpBalance}`,
      );
    }
  }

  // Asset B
  if (assetBObj.currency !== "XRP") {
    if (!assetBObj.issuer)
      throw new Error(`Issuer not specified for ${assetBObj.currency}`);

    console.log(`🔍 Checking ${assetBObj.currency} balance...`);
    const balanceResponseB: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetBObj.issuer,
    });

    const assetLineB = balanceResponseB.result.lines.find(
      (line) =>
        line.currency === assetBObj.currency &&
        line.account === assetBObj.issuer,
    );

    if (assetLineB) {
      const balance = new BigNumber(assetLineB.balance);
      const depositAmount = new BigNumber(assetBObj.value);

      if (balance.lt(depositAmount)) {
        throw new Error(`Insufficient ${assetBObj.currency} balance.`);
      }
    } else {
      throw new Error(
        `No trustline found for ${assetBObj.currency} from ${assetBObj.issuer}`,
      );
    }
  } else {
    const accountInfoResponseB: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });

    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponseB.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponseB.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const depositAmount = Number(assetBObj.value);

    if (xrpBalance - reserveXRP < depositAmount) {
      throw new Error(
        `Insufficient XRP balance. Need ${depositAmount + reserveXRP}, have ${xrpBalance}`,
      );
    }
  }

  // ========== BUILD TRANSACTION ==========

  const tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Flags: 0x00100000, // tfTwoAsset
  };

  if (assetAObj.currency === "XRP") {
    tx.Asset = { currency: "XRP" };
    tx.Amount = xrpl.xrpToDrops(assetAObj.value);
  } else {
    tx.Asset = {
      currency: assetAObj.currency,
      issuer: assetAObj.issuer,
    };
    tx.Amount = {
      currency: assetAObj.currency,
      issuer: assetAObj.issuer,
      value: assetAObj.value,
    };
  }

  if (assetBObj.currency === "XRP") {
    tx.Asset2 = { currency: "XRP" };
    tx.Amount2 = xrpl.xrpToDrops(assetBObj.value);
  } else {
    tx.Asset2 = {
      currency: assetBObj.currency,
      issuer: assetBObj.issuer,
      value: assetBObj.value,
    };
  }

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);

  console.log("✍️ Signing transaction...");
  const signed = providerWallet.sign(prepared);

  console.log("⏳ Waiting for transaction validation...");
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  console.log("✅ Successfully added liquidity to AMM");

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );
  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);

  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}

export async function addLiquidityLPToken(
  providerWallet: Wallet,
  ammAccount: string,
  assetAObj: Asset,
  assetBObj: Asset,
  lpTokenOut: IssuedCurrencyAmount,
): Promise<TransactionDetails> {
  await connectXrplClient();
  console.log(`✅ Adding liquidity (LPToken) to AMM at ${ammAccount}`);
  console.log(
    `🔹 Asset A: ${assetAObj.currency} - Max Amount: ${assetAObj.value}`,
  );
  console.log(
    `🔹 Asset B: ${assetBObj.currency} - Max Amount: ${assetBObj.value}`,
  );
  console.log(`🔹 LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });
  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
    throw new Error("Could not retrieve LP token information from AMM");
  }

  // Check asset A
  if (assetAObj.currency !== "XRP") {
    if (!assetAObj.issuer)
      throw new Error(`Issuer not specified for ${assetAObj.currency}`);
    const balanceResponseA: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetAObj.issuer,
    });
    const assetLineA = balanceResponseA.result.lines.find(
      (line) => line.currency === assetAObj.currency,
    );
    if (assetLineA) {
      const balance = new BigNumber(assetLineA.balance);
      const depositBN = new BigNumber(assetAObj.value);
      if (balance.lt(depositBN)) {
        throw new Error(
          `Insufficient balance of ${assetAObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
        );
      }
    } else {
      throw new Error(
        `Cannot find balance information for ${assetAObj.currency}`,
      );
    }
  } else {
    const accountInfoResponseA: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });
    if (!accountInfoResponseA.result?.account_data) {
      throw new Error("Cannot find balance information for XRP");
    }
    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponseA.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponseA.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const depositAmount = parseFloat(assetAObj.value);
    if (xrpBalance - reserveXRP < depositAmount) {
      throw new Error(
        `Insufficient XRP balance. Need ${depositAmount + reserveXRP}, have ${xrpBalance}`,
      );
    }
  }

  // Check asset B
  if (assetBObj.currency !== "XRP") {
    if (!assetBObj.issuer)
      throw new Error(`Issuer not specified for ${assetBObj.currency}`);
    const balanceResponseB: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetBObj.issuer,
    });
    const assetLineB = balanceResponseB.result.lines.find(
      (line) => line.currency === assetBObj.currency,
    );
    if (assetLineB) {
      const balance = new BigNumber(assetLineB.balance);
      const depositBN = new BigNumber(assetBObj.value);
      if (balance.lt(depositBN)) {
        throw new Error(
          `Insufficient balance of ${assetBObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
        );
      }
    } else {
      throw new Error(
        `Cannot find balance information for ${assetBObj.currency}`,
      );
    }
  } else {
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });
    if (!accountInfoResponse.result?.account_data) {
      throw new Error("Cannot find balance information for XRP");
    }
    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponse.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const depositAmount = parseFloat(assetBObj.value);
    if (xrpBalance - reserveXRP < depositAmount) {
      throw new Error(
        `Insufficient XRP balance. Need ${depositAmount + reserveXRP}, have ${xrpBalance}`,
      );
    }
  }

  const poolInfo = ammInfoResponse.result.amm;
  if (!poolInfo) {
    throw new Error("Could not retrieve AMM pool information");
  }

  const isPoolEmpty = poolInfo.amount === "0" || poolInfo.amount2 === "0";
  if (isPoolEmpty) {
    throw new Error(
      "The AMM pool appears to be empty or nearly empty. Use the 'Two Asset If Empty' option instead.",
    );
  }

  const tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Flags: 0x00010000, // tfLPToken
    LPTokenOut: {
      currency: lpTokenOut.currency,
      issuer: lpTokenOut.issuer,
      value: lpTokenOut.value,
    },
  };

  tx.Asset =
    assetAObj.currency === "XRP"
      ? { currency: "XRP" }
      : { currency: assetAObj.currency, issuer: assetAObj.issuer };

  tx.Asset2 =
    assetBObj.currency === "XRP"
      ? { currency: assetBObj.currency, issuer: assetBObj.issuer }
      : { currency: assetBObj.currency, issuer: assetBObj.issuer };

  const asset1Amount =
    typeof poolInfo.amount === "object"
      ? parseFloat(poolInfo.amount.value)
      : xrpl.dropsToXrp(String(poolInfo.amount));

  const asset2Amount =
    typeof poolInfo.amount2 === "object"
      ? parseFloat(poolInfo.amount2.value)
      : xrpl.dropsToXrp(String(poolInfo.amount2));

  const lpTokenSupply = parseFloat(poolInfo.lp_token.value);

  if (lpTokenSupply > 0) {
    const lpTokenRatio = parseFloat(lpTokenOut.value) / lpTokenSupply;
    const requiredAsset1 = asset1Amount * lpTokenRatio;
    const requiredAsset2 = asset2Amount * lpTokenRatio;

    console.log(`💡 Based on the LP token ratio, you need approximately:`);
    console.log(`   - ${requiredAsset1.toFixed(6)} of ${assetAObj.currency}`);
    console.log(`   - ${requiredAsset2.toFixed(6)} of ${assetBObj.currency}`);
    console.log(`   Maximum amounts you're willing to provide:`);
    console.log(`   - ${assetAObj.value} of ${assetAObj.currency}`);
    console.log(`   - ${assetBObj.value} of ${assetBObj.currency}`);

    const asset1Sufficient = new BigNumber(assetAObj.value)
      .decimalPlaces(6)
      .gte(new BigNumber(requiredAsset1.toString()).decimalPlaces(6));
    const asset2Sufficient = new BigNumber(assetBObj.value)
      .decimalPlaces(6)
      .gte(new BigNumber(requiredAsset2.toString()).decimalPlaces(6));

    if (!asset1Sufficient || !asset2Sufficient) {
      console.log(
        "⚠️ Warning: The maximum amounts you're providing may not be sufficient for the requested LP tokens.",
      );
    }
  }

  console.log(
    "📃 Transaction fields (LPToken):",
    JSON.stringify(
      {
        TransactionType: tx.TransactionType,
        Asset: tx.Asset,
        Asset2: tx.Asset2,
        LPTokenOut: tx.LPTokenOut,
        AMMAccount: tx.AMMAccount,
        Flags: tx.Flags,
      },
      null,
      2,
    ),
  );

  const prepared = await client.autofill(tx);
  console.log("🔄 Transaction prepared, signing...");
  const signed = providerWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  console.log("✅ Successfully added liquidity to AMM (LPToken)");

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );
  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);

  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}

export async function addLiquidityIfEmpty(
  providerWallet: Wallet,
  ammAccount: string,
  assetAObj: Asset,
  assetBObj: Asset,
): Promise<TransactionDetails> {
  await connectXrplClient();
  console.log(`✅ Adding liquidity (IfEmpty) to AMM at ${ammAccount}`);

  // Check AMM status
  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });

  if (ammInfoResponse.result && ammInfoResponse.result.amm) {
    const ammInfo = ammInfoResponse.result.amm;
    const asset1 = ammInfo.amount && typeof ammInfo.amount === 'object' && 'currency' in ammInfo.amount
      ? ammInfo.amount
      : { value: xrpl.dropsToXrp(String(ammInfo.amount)) };
    const asset2 = ammInfo.amount2 && typeof ammInfo.amount2 === 'object' && 'currency' in ammInfo.amount2
      ? ammInfo.amount2
      : { value: xrpl.dropsToXrp(String(ammInfo.amount2)) };

    const hasLiquidity =
      (('currency' in asset1 && parseFloat(String(asset1.value)) > 0) ||
        (!('currency' in asset1) && parseFloat(String(asset1.value)) > 0)) &&
      (('currency' in asset2 && parseFloat(String(asset2.value)) > 0) ||
        (!('currency' in asset2) && parseFloat(String(asset2.value)) > 0));

    if (hasLiquidity) {
      console.log(
        "⚠️ The AMM pool already has liquidity. The 'IfEmpty' option is designed for empty pools.",
      );
      console.log(
        `   Current pool balances: ${asset1.value} ${('currency' in asset1) ? asset1.currency : "XRP"}, ${asset2.value} ${('currency' in asset2) ? asset2.currency : "XRP"}`,
      );
      console.log(
        "   You can still proceed, but the 'Two Asset Quantity' option might be more appropriate.",
      );
    }
  }

  let amount1: any, amount2: any;

  if (assetAObj.currency === "XRP") {
    amount1 = xrpl.xrpToDrops(assetAObj.value);
    console.log(`🔹 Asset A: XRP - Amount: ${assetAObj.value}`);
  } else {
    amount1 = {
      currency: assetAObj.currency,
      issuer: assetAObj.issuer,
      value: assetAObj.value,
    };
    console.log(
      `🔹 Asset A: ${assetAObj.currency} - Amount: ${assetAObj.value} - Issuer: ${assetAObj.issuer}`,
    );
  }

  if (assetBObj.currency === "XRP") {
    amount2 = xrpl.xrpToDrops(assetBObj.value);
    console.log(`🔹 Asset B: XRP - Amount: ${assetBObj.value}`);
  } else {
    amount2 = {
      currency: assetBObj.currency,
      issuer: assetBObj.issuer,
      value: assetBObj.value,
    };
    console.log(
      `🔹 Asset B: ${assetBObj.currency} - Amount: ${assetBObj.value} - Issuer: ${assetBObj.issuer}`,
    );
  }

  // Asset A balance check
  if (assetAObj.currency !== "XRP") {
    const balanceResponseA: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetAObj.issuer!,
    });
    const assetLineA = balanceResponseA.result.lines.find(
      (line) => line.currency === assetAObj.currency,
    );
    if (!assetLineA) {
      throw new Error(`No trustline found for ${assetAObj.currency}`);
    }
    const balance = parseFloat(assetLineA.balance);
    const deposit = parseFloat(assetAObj.value);
    if (balance < deposit) {
      throw new Error(
        `Insufficient balance of ${assetAObj.currency}. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)}`,
      );
    }
  } else {
    const accountInfoResponseA: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });
    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponseA.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponseA.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const deposit = parseFloat(assetAObj.value);
    if (xrpBalance - reserveXRP < deposit) {
      throw new Error(
        `Insufficient balance of XRP. Have: ${xrpBalance.toFixed(6)}, Need: ${deposit.toFixed(6)} + reserve`,
      );
    }
  }

  // Asset B balance check
  if (assetBObj.currency !== "XRP") {
    const balanceResponseB: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetBObj.issuer!,
    });
    const assetLineB = balanceResponseB.result.lines.find(
      (line) => line.currency === assetBObj.currency,
    );
    if (!assetLineB) {
      throw new Error(`No trustline found for ${assetBObj.currency}`);
    }
    const balance = parseFloat(assetLineB.balance);
    const deposit = parseFloat(assetBObj.value);
    if (balance < deposit) {
      throw new Error(
        `Insufficient balance of ${assetBObj.currency}. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)}`,
      );
    }
  } else {
    const accountInfoResponseB: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });
    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponseB.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponseB.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const deposit = parseFloat(assetBObj.value);
    if (xrpBalance - reserveXRP < deposit) {
      throw new Error(
        `Insufficient balance of XRP. Have: ${xrpBalance.toFixed(6)}, Need: ${deposit.toFixed(6)} + reserve`,
      );
    }
  }

  const tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Flags: 0x00080000, // tfTwoAssetIfEmpty
    Amount: amount1,
    Amount2: amount2,
  };

  console.log(
    "📃 Transaction fields (IfEmpty):",
    JSON.stringify(
      {
        TransactionType: tx.TransactionType,
        Amount: tx.Amount,
        Amount2: tx.Amount2,
        AMMAccount: tx.AMMAccount,
        Flags: tx.Flags,
      },
      null,
      2,
    ),
  );

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = providerWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  console.log("✅ Successfully added liquidity to AMM (IfEmpty)");

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );
  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);

  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}

export async function addLiquiditySingleAsset(
  providerWallet: Wallet,
  ammAccount: string,
  assetObj: Asset,
): Promise<TransactionDetails> {
  await connectXrplClient();
  console.log(`✅ Adding single-asset liquidity to AMM at ${ammAccount}`);
  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });
  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
    throw new Error("Could not retrieve LP token information from AMM");
  }

  // ========== BALANCE CHECKS ==========
  if (assetObj.currency !== "XRP") {
    if (!assetObj.issuer) {
      throw new Error(`Issuer not specified for ${assetObj.currency}`);
    }
    const balanceResponse: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetObj.issuer,
    });
    const assetLine = balanceResponse.result.lines.find(
      (line) => line.currency === assetObj.currency,
    );
    if (assetLine) {
      const balance = new BigNumber(assetLine.balance);
      const depositBN = new BigNumber(assetObj.value);
      console.log(
        `💰 Current ${assetObj.currency} balance: ${balance.toFixed(6)}`,
      );
      console.log(
        `📊 Required ${assetObj.currency} amount: ${depositBN.toFixed(6)}`,
      );
      if (balance.lt(depositBN)) {
        throw new Error(
          `Insufficient balance of ${assetObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
        );
      }
      console.log(`✅ Sufficient ${assetObj.currency} balance confirmed.`);
    } else {
      throw new Error(
        `Cannot find balance information for ${assetObj.currency}`,
      );
    }
  } else {
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });
    if (accountInfoResponse.result && accountInfoResponse.result.account_data) {
      const xrpBalance = xrpl.dropsToXrp(
        accountInfoResponse.result.account_data.Balance,
      );
      const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
      const reserveXRP =  BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
      const deposit = parseFloat(assetObj.value);
      console.log(`💰 Current XRP balance: ${xrpBalance.toFixed(6)}`);
      console.log(
        `📊 Required XRP amount: ${deposit.toFixed(6)} + ${reserveXRP.toFixed(6)} reserve`,
      );
      if (xrpBalance - reserveXRP < deposit) {
        throw new Error(
          `Insufficient balance of XRP. Have: ${xrpBalance.toFixed(6)}, Need: ${deposit.toFixed(6)} + reserve`,
        );
      }
      console.log(`✅ Sufficient XRP balance confirmed.`);
    } else {
      throw new Error("Cannot find balance information for XRP");
    }
  }
  const tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Flags: 0x00080000,
  };
  console.log("📊 Fetching AMM info to identify both assets in the pair...");
  const pairAmmInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });
  if (!pairAmmInfoResponse.result.amm) {
    throw new Error("Could not fetch AMM information");
  }
  const ammInfo = pairAmmInfoResponse.result.amm;
  let asset1: any, asset2: any;
  if (ammInfo.asset && ammInfo.asset.currency) {
    asset1 =
      ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
  } else if (ammInfo.amount) {
    asset1 =
      typeof ammInfo.amount === "object" && ammInfo.amount.currency
        ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine first asset in the AMM pool");
  }
  if (ammInfo.asset2 && ammInfo.asset2.currency) {
    asset2 =
      ammInfo.asset2.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset2;
  } else if (ammInfo.amount2) {
    asset2 =
      typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
        ? {
            currency: ammInfo.amount2.currency,
            issuer: ammInfo.amount2.issuer,
          }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine second asset in the AMM pool");
  }
  console.log(`🔹 AMM Assets: ${asset1.currency}/${asset2.currency}`);
  let isFirstAsset = false;
  if (
    asset1.currency === assetObj.currency &&
    (asset1.currency === "XRP" ||
      (asset1.issuer && asset1.issuer === assetObj.issuer))
  ) {
    isFirstAsset = true;
  }
  let isSecondAsset = false;
  if (
    asset2.currency === assetObj.currency &&
    (asset2.currency === "XRP" ||
      (asset2.issuer && asset2.issuer === assetObj.issuer))
  ) {
    isSecondAsset = true;
  }
  if (!isFirstAsset && !isSecondAsset) {
    throw new Error(
      `Selected asset ${assetObj.currency} does not match any asset in this AMM pool.`,
    );
  }
  if (assetObj.currency === "XRP") {
    tx.Asset = { currency: "XRP" };
    tx.Amount = xrpl.xrpToDrops(assetObj.value);
  } else {
    tx.Asset = {
      currency: assetObj.currency,
      issuer: assetObj.issuer,
    };
    tx.Amount = {
      currency: assetObj.currency,
      issuer: assetObj.issuer,
      value: assetObj.value,
    };
  }
  const otherAsset = isFirstAsset ? asset2 : asset1;
  if (otherAsset.currency === "XRP") {
    tx.Asset2 = { currency: "XRP" };
  } else {
    tx.Asset2 = {
      currency: otherAsset.currency,
      issuer: otherAsset.issuer,
    };
  }
  console.log(
    "📃 Transaction fields (SingleAsset):",
    JSON.stringify(
      {
        TransactionType: tx.TransactionType,
        Asset: tx.Asset,
        Asset2: tx.Asset2,
        Amount: tx.Amount,
        AMMAccount: tx.AMMAccount,
        Flags: tx.Flags,
      },
      null,
      2,
    ),
  );
  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  const ledgerResponse: LedgerResponse = await client.request({ command: "ledger_current" });
  const currentLedger = ledgerResponse.result.ledger_current_index;
  prepared.LastLedgerSequence = currentLedger + 50;
  console.log("✍️ Signing transaction...");
  const signed = providerWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  console.log("✅ Successfully added single-asset liquidity to AMM");

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );
  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);
  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}

export async function addLiquidityOneAssetLPToken(
  providerWallet: Wallet,
  ammAccount: string,
  assetObj: Asset,
  lpTokenOut: IssuedCurrencyAmount,
): Promise<TransactionDetails> {
  await connectXrplClient();
  console.log(`✅ Adding one-asset LPToken liquidity to AMM at ${ammAccount}`);
  console.log(
    `🔹 Asset: ${assetObj.currency} - Max Amount: ${assetObj.value} - Issuer: ${assetObj.issuer || "XRP"}`,
  );
  console.log(`🔹 LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

  if (assetObj.currency !== "XRP") {
    const balanceResponse: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetObj.issuer!,
    });

    const assetLine = balanceResponse.result.lines.find(
      (line) =>
        line.currency === assetObj.currency && line.account === assetObj.issuer,
    );

    if (!assetLine) {
      throw new Error(
        `Could not find trustline for ${assetObj.currency} issued by ${assetObj.issuer}.`,
      );
    }

    if (parseFloat(assetLine.balance) < parseFloat(assetObj.value)) {
      throw new Error(
        `Insufficient ${assetObj.currency} balance. Need: ${assetObj.value}, Have: ${assetLine.balance}`,
      );
    }
  } else {
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });

    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponse.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
    const reserveXRP = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const depositAmount = parseFloat(assetObj.value);

    if (xrpBalance - reserveXRP < depositAmount) {
      throw new Error(
        `Insufficient XRP balance. Need ${depositAmount + reserveXRP}, have ${xrpBalance}`,
      );
    }
  }

  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });

  if (!ammInfoResponse.result.amm) {
    throw new Error(`Could not retrieve AMM information for ${ammAccount}`);
  }

  const ammInfo = ammInfoResponse.result.amm;

  let asset1: any, asset2: any;

  if (ammInfo.asset && ammInfo.asset.currency) {
    asset1 =
      ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
  } else if (ammInfo.amount) {
    asset1 =
      typeof ammInfo.amount === "object" && ammInfo.amount.currency
        ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine first asset in the AMM pool");
  }

  if (ammInfo.asset2 && ammInfo.asset2.currency) {
    asset2 =
      ammInfo.asset2.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset2;
  } else if (ammInfo.amount2) {
    asset2 =
      typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
        ? {
            currency: ammInfo.amount2.currency,
            issuer: ammInfo.amount2.issuer,
          }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine second asset in the AMM pool");
  }

  let tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Asset: asset1,
    Asset2: asset2,
    Flags: 0x00200000, // tfOneAssetLPToken
    LPTokenOut: {
      currency: lpTokenOut.currency,
      issuer: lpTokenOut.issuer,
      value: lpTokenOut.value,
    },
  };

  const isFirstAsset =
    asset1.currency === assetObj.currency &&
    (asset1.currency === "XRP" ||
      (asset1.issuer && asset1.issuer === assetObj.issuer));

  const isSecondAsset =
    asset2.currency === assetObj.currency &&
    (asset2.currency === "XRP" ||
      (asset2.issuer && asset2.issuer === assetObj.issuer));

  if (!isFirstAsset && !isSecondAsset) {
    throw new Error(
      `Selected asset ${assetObj.currency} does not match any asset in this AMM pool.`,
    );
  }

  tx.Amount =
    assetObj.currency === "XRP"
      ? xrpl.xrpToDrops(assetObj.value)
      : {
          currency: assetObj.currency,
          issuer: assetObj.issuer,
          value: assetObj.value,
        };

  const asset1Amount =
    typeof ammInfo.amount === "object"
      ? parseFloat(ammInfo.amount.value)
      : xrpl.dropsToXrp(String(ammInfo.amount));

  const asset2Amount =
    typeof ammInfo.amount2 === "object"
      ? parseFloat(ammInfo.amount2.value)
      : xrpl.dropsToXrp(String(ammInfo.amount2));

  const lpTokenSupply = parseFloat(ammInfo.lp_token.value);

  if (lpTokenSupply > 0) {
    const lpTokenRatio = parseFloat(lpTokenOut.value) / lpTokenSupply;
    const selectedAssetAmount = isFirstAsset ? asset1Amount : asset2Amount;
    const requiredAssetAmount = selectedAssetAmount * lpTokenRatio;

    const assetSufficient = new BigNumber(assetObj.value)
      .decimalPlaces(6)
      .gte(new BigNumber(requiredAssetAmount.toString()).decimalPlaces(6));

    if (!assetSufficient) {
      console.warn(
        `⚠️ Warning: The maximum amount you're providing may not be sufficient for the requested LP tokens.`,
      );
    }

    const lpPercentage = (parseFloat(lpTokenOut.value) / lpTokenSupply) * 100;

    if (lpPercentage > 20) {
      console.warn(
        `⚠️ Warning: You're requesting ${lpPercentage.toFixed(2)}% of the total LP token supply.`,
      );
    }
  }

  const prepared = await client.autofill(tx);
  const signed = providerWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );

  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);

  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}

export async function addLiquidityLimitLPToken(
  providerWallet: Wallet,
  ammAccount: string,
  assetObj: Asset,
  ePrice: string,
): Promise<TransactionDetails> {
  await connectXrplClient();
  console.log(`✅ Adding limit LPToken liquidity to AMM at ${ammAccount}`);

  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });

  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
    throw new Error("Could not retrieve LP token information from AMM");
  }

  const lpToken = ammInfoResponse.result.amm.lp_token;
  const lpTokenIssuer = ammAccount;

  const hasLPTrustline = await checkTrustline(
    providerWallet,
    lpTokenIssuer,
    lpToken.currency,
  );

  if (!hasLPTrustline) {
    throw new Error(
      `Trustline for LP token (${lpToken.currency}) with issuer (${lpTokenIssuer}) not found.`,
    );
  }

  // Balance checks
  if (assetObj.currency !== "XRP") {
    if (!assetObj.issuer) {
      throw new Error(`Issuer not specified for ${assetObj.currency}`);
    }

    const balanceResponse: BalanceResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: assetObj.issuer,
    });

    const assetLine = balanceResponse.result.lines.find(
      (line) => line.currency === assetObj.currency,
    );

    if (!assetLine) {
      throw new Error(
        `Cannot find balance information for ${assetObj.currency}`,
      );
    }

    const balance = new BigNumber(assetLine.balance);
    const depositBN = new BigNumber(assetObj.value);

    if (balance.lt(depositBN)) {
      throw new Error(
        `Insufficient balance of ${assetObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
      );
    }
  } else {
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerWallet.classicAddress,
      ledger_index: "validated",
    });

    if (!accountInfoResponse.result.account_data) {
      throw new Error("Cannot find balance information for XRP");
    }

    const xrpBalance = xrpl.dropsToXrp(
      accountInfoResponse.result.account_data.Balance,
    );
    const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
    const reserveXRP = new BigNumber(
      BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount,
    );
    const balance = new BigNumber(xrpBalance);
    const depositBN = new BigNumber(assetObj.value);

    if (balance.minus(reserveXRP).lt(depositBN)) {
      throw new Error(
        `Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)} + 10 XRP reserve`,
      );
    }
  }

  // Prepare the transaction
  const tx: any = {
    TransactionType: "AMMDeposit",
    Account: providerWallet.classicAddress,
    AMMAccount: ammAccount,
    Flags: 0x00400000, // tfLimitLPToken
    EPrice: ePrice,
  };

  const pairAmmInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });

  if (!pairAmmInfoResponse.result.amm) {
    throw new Error("Could not fetch AMM information");
  }

  const ammInfo = pairAmmInfoResponse.result.amm;

  let asset1: any, asset2: any;

  if (ammInfo.asset && ammInfo.asset.currency) {
    asset1 =
      ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
  } else if (ammInfo.amount) {
    asset1 =
      typeof ammInfo.amount === "object" && ammInfo.amount.currency
        ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine first asset in the AMM pool");
  }

  if (ammInfo.asset2 && ammInfo.asset2.currency) {
    asset2 =
      ammInfo.asset2.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset2;
  } else if (ammInfo.amount2) {
    asset2 =
      typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
        ? {
            currency: ammInfo.amount2.currency,
            issuer: ammInfo.asset2.issuer,
          }
        : { currency: "XRP" };
  } else {
    throw new Error("Cannot determine second asset in the AMM pool");
  }

  const isFirstAsset =
    asset1.currency === assetObj.currency &&
    (asset1.currency === "XRP" ||
      (asset1.issuer && asset1.issuer === assetObj.issuer));

  const isSecondAsset =
    asset2.currency === assetObj.currency &&
    (asset2.currency === "XRP" ||
      (asset2.issuer && asset2.issuer === assetObj.issuer));

  if (!isFirstAsset && !isSecondAsset) {
    throw new Error(`Asset ${assetObj.currency} is not part of this AMM pair.`);
  }

  // Add Asset and Amount fields
  if (assetObj.currency === "XRP") {
    tx.Asset = { currency: "XRP" };
    tx.Amount = xrpl.xrpToDrops(assetObj.value);
  } else {
    tx.Asset = {
      currency: assetObj.currency,
      issuer: assetObj.issuer,
    };
    tx.Amount = {
      currency: assetObj.currency,
      issuer: assetObj.issuer,
      value: assetObj.value,
    };
  }

  const otherAsset = isFirstAsset ? asset2 : asset1;
  tx.Asset2 =
    otherAsset.currency === "XRP"
      ? { currency: "XRP" }
      : {
          currency: otherAsset.currency,
          issuer: otherAsset.issuer,
        };

  const prepared = await client.autofill(tx);
  const signed = providerWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  // Handle any AMM deposit errors
  try {
    XRPLErrorHandler.handleAMMDepositError(result);
  } catch (error: any) {
    console.error(`❌ AMM Deposit error: ${error.message}`);
  }

  const lpTokensReceived = await extractLPTokensReceived(
    result as TransactionResult,
    providerWallet,
    ammAccount,
  );

  const assetsDeposited = extractActualAssetsDeposited(result as TransactionResult);

  return displayTransactionDetails(result as TransactionResult, lpTokensReceived, assetsDeposited);
}
