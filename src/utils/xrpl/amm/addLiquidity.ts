import { client, connectXRPLClient } from "../testnet";
import { 
  Wallet, 
  IssuedCurrencyAmount, 
  AccountLinesResponse, 
  dropsToXrp, 
  AccountInfoResponse, 
  AMMDeposit,
  TxResponse } from "xrpl";
import BigNumber from "bignumber.js";
import { handleTransactionError, isTypedTransactionSuccessful } from '../errorHandler';
import { AddLiquidityResult, AddLiquidityTwoAssetParams, AddLiquidityLPTokenParams, AddLiquiditySingleAssetParams, AddLiquidityOneAssetLPTokenParams } from "@/types/xrpl/ammXRPLTypes";
import { formatAmountForXRPL } from "@/utils/assetUtils";
import { formatCurrencyForXRPL } from "@/utils/currencyUtils";

const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

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

/**
 * Helper function to check if a wallet has sufficient balance for adding liquidity
 * @param providerWallet - The wallet providing liquidity
 * @param amount - The asset to check balance for
 * @returns Promise<boolean> - Returns true if sufficient balance, false otherwise
 */
export async function checkAssetBalanceForAddLiquidity(
  providerXRPLWallet: Wallet,
  amount: IssuedCurrencyAmount
): Promise<boolean> {
  if (amount.currency !== "XRP") {
    if (!amount.issuer) {
      throw new Error(`Issuer not specified for ${amount.currency}`);
    }

    console.log(`🔍 Checking ${amount.currency} balance...`);
    const balanceResponse: AccountLinesResponse = await client.request({
      command: "account_lines",
      account: providerXRPLWallet.classicAddress,
      peer: amount.issuer,
    });

    const assetLine = balanceResponse.result.lines.find(
      (line) =>
        line.currency === amount.currency &&
        line.account === amount.issuer,
    );

    if (assetLine) {
      const balance = new BigNumber(assetLine.balance);
      const depositAmount = new BigNumber(amount.value);

      if (balance.lt(depositAmount)) {
        console.log(`❌ Insufficient ${amount.currency} balance. Have: ${balance.toFixed(6)}, Need: ${depositAmount.toFixed(6)}`);
        return false;
      }
      
      console.log(`✅ Sufficient ${amount.currency} balance confirmed.`);
      return true;
    } else {
      console.log(`❌ No trustline found for ${amount.currency} from ${amount.issuer}`);
      return false;
    }
  } else {
    console.log(`🔍 Checking XRP balance...`);
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: providerXRPLWallet.classicAddress,
      ledger_index: "validated",
    });

    const xrpBalance = new BigNumber(dropsToXrp(
      accountInfoResponse.result.account_data.Balance,
    ));
    const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
    const reserveXRP = new BigNumber(BASE_RESERVE_XRP).plus(new BigNumber(OWNER_RESERVE_XRP).times(ownerCount));
    const depositAmount = new BigNumber(amount.value);

    if (xrpBalance.minus(reserveXRP).lt(depositAmount)) {
      console.log(`❌ Insufficient XRP balance. Need: ${depositAmount.plus(reserveXRP).toFixed(6)} (${depositAmount.toFixed(6)} + ${reserveXRP.toFixed(6)} reserve), Have: ${xrpBalance.toFixed(6)}`);
      return false;
    }
    
    console.log(`✅ Sufficient XRP balance confirmed.`);
    return true;
  }
}

// Extract and display LP tokens received from transaction metadata
export async function extractLPTokensReceived(
  result: TxResponse<AMMDeposit>,
  providerWallet: Wallet,
  ammAccount: string,
): Promise<IssuedCurrencyAmount | null> {
  // The LPTokenOut is in the AffectedNodes array
  let lpTokensReceived: IssuedCurrencyAmount | null = null;
  if (typeof result.result.meta === "string") { // If the transaction is not successful, the meta is a string
    return null;
  }
  const nodes = result.result.meta.AffectedNodes || [];

  // First pass: Look for trustline modifications to find LP token receipt
  for (const node of nodes) {
    // Check for modified trustlines to find LP token change
    if (
      'ModifiedNode' in node &&
      node.ModifiedNode.LedgerEntryType === "RippleState"
    ) {
      const state = node.ModifiedNode;

      // LP tokens typically have a 40-character currency code
      if (
        !(state.FinalFields?.Balance as any)?.currency ||
        (state.FinalFields?.Balance as any)?.currency?.length !== 40
      ) {
        continue;
      }

      // Check if this trustline involves the AMM account (issuer of LP tokens)
      const highAccount = (state.FinalFields?.HighLimit as any)?.issuer;
      const lowAccount = (state.FinalFields?.LowLimit as any)?.issuer;

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
        let prevValue = parseFloat((prevBalance as any)?.value || "0");
        let finalValue = parseFloat((balance as any)?.value || "0");

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
            currency: (balance as any).currency,
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
        'CreatedNode' in node &&
        node.CreatedNode.LedgerEntryType === "RippleState"
      ) {
        const state = node.CreatedNode;

        // LP tokens typically have a 40-character currency code
        if (
          !(state.NewFields?.Balance as any)?.currency ||
          (state.NewFields?.Balance as any)?.currency?.length !== 40
        ) {
          continue;
        }

        // Check if this involves the AMM account
        const highAccount = (state.NewFields?.HighLimit as any)?.issuer;
        const lowAccount = (state.NewFields?.LowLimit as any)?.issuer;

        const involvesWallet =
          highAccount === providerWallet.classicAddress ||
          lowAccount === providerWallet.classicAddress;
        const involvesAMM =
          highAccount === ammAccount || lowAccount === ammAccount;

        if (involvesWallet && involvesAMM && state.NewFields?.Balance) {
          const balance = state.NewFields.Balance;
          let value = parseFloat((balance as any)?.value || "0");

          // Adjust for balance perspective
          const isUserLow = lowAccount === providerWallet.classicAddress;
          if (!isUserLow) {
            value = -value;
          }

          if (value > 0) {
            console.log(
              `✅ Found newly created LP token trustline: ${value.toFixed(6)} ${(balance as any).currency}`,
            );
            lpTokensReceived = {
              currency: (balance as any).currency,
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
    console.warn("Could not extract LP tokens from transaction metadata");
    return null;
  }
}

// Extract the actual assets deposited from transaction metadata
function extractActualAssetsDeposited(result: TxResponse<AMMDeposit>): IssuedCurrencyAmount[] {
  // Type guard to ensure meta is not a string, string meta means the transaction is not successful
  if (typeof result.result.meta === 'string') {
    return [];
  }
  
  const nodes = result.result.meta.AffectedNodes || [];
  const assetsDeposited: IssuedCurrencyAmount[] = [];
  // Track assets we've already added to avoid duplicates
  const addedAssets = new Set<string>();

  // Get transaction sender address, make sure this is the exact format result.result.tx_json?.Account
  const senderAddress = result.result.tx_json?.Account;

  // Look for both token balance changes and XRP balance changes
  for (const node of nodes) {
    // For token deposits (check trustline modifications)
    if (
      'ModifiedNode' in node &&
      node.ModifiedNode.LedgerEntryType === "RippleState"
    ) {
      const state = node.ModifiedNode;

      if (
        state.FinalFields &&
        state.PreviousFields &&
        state.FinalFields.Balance &&
        state.PreviousFields.Balance
      ) {
        // Skip non-transaction related trustlines
        const highAccount = (state.FinalFields.HighLimit as any)?.issuer;
        const lowAccount = (state.FinalFields.LowLimit as any)?.issuer;

        // Only process entries where one of the accounts is the sender
        if (highAccount !== senderAddress && lowAccount !== senderAddress) {
          continue;
        }

        // Create a unique key for this asset to avoid duplicates
        // Include the currency and issuer, but not whose perspective the balance is from
        const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
        const assetKey = `${(state.FinalFields.Balance as any).currency}:${issuer}`;

        // Skip if we've already added this asset
        if (addedAssets.has(assetKey)) {
          continue;
        }

        // Check if balance changed
        const prevValue = new BigNumber((state.PreviousFields.Balance as any)?.value || "0");
        const finalValue = new BigNumber((state.FinalFields.Balance as any)?.value || "0");

        // Determine if this is an incoming or outgoing balance
        // For the sender, a positive value means a decrease in their balance (outgoing/deposit)
        // For the sender, a negative value means an increase in their balance (incoming)
        const isFromSenderPerspective = lowAccount === senderAddress;

        // In RippleState, the Balance field is from LowLimit's perspective
        // So if the sender is LowLimit, a lower final value means they sent funds
        // If the sender is HighLimit, a higher final value means they sent funds
        let diff: BigNumber;
        if (isFromSenderPerspective) {
          diff = prevValue.minus(finalValue); // If positive, sender sent funds
        } else {
          diff = finalValue.minus(prevValue); // If positive, sender sent funds
        }

        // Only add if the sender's balance decreased by a significant amount
        // (i.e., they sent funds)
        if (diff.gt(0.000001)) {
          assetsDeposited.push({
            currency: (state.FinalFields.Balance as any).currency,
            issuer: issuer,
            value: diff.toString(),
          });

          // Mark this asset as processed
          addedAssets.add(assetKey);
        }
      }
    }

    // For XRP deposits (check AccountRoot modifications)
    else if (
      'ModifiedNode' in node &&
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
        const finalDrops = new BigNumber((state.FinalFields.Balance as any) || "0");
        const prevDrops = new BigNumber((state.PreviousFields.Balance as any) || "0");

        // The fee is directly deducted from the account, we need to consider it
        const fee = parseInt(result.result.tx_json?.Fee) || 0;

        // Calculate how much XRP was sent
        const xrpSent = prevDrops.minus(finalDrops).minus(fee);

        // Use consistent key format for XRP
        const xrpKey = "XRP:";

        // Skip if we've already added XRP
        if (addedAssets.has(xrpKey)) continue;

        // Only add if a significant amount of XRP was sent (more than just the fee)
        if (xrpSent.gt(1000)) {
          // 1000 drops threshold (0.001 XRP)
          // Convert drops to XRP for display
          const xrpValue = dropsToXrp(xrpSent.toString());
          assetsDeposited.push({
            currency: "XRP", 
            issuer: "", // Empty string for XRP as per your convention
            value: xrpValue.toString(),
          });

          // Mark XRP as processed using consistent key format
          addedAssets.add(xrpKey);
        }
      }
    }
  }

  // Sort assets by currency
  assetsDeposited.sort((a, b) => a.currency.localeCompare(b.currency));

  if (assetsDeposited.length > 0) {
    return assetsDeposited;
  }

  return [];
}

function displayTransactionDetails(
  result: TxResponse<AMMDeposit>, 
  lpTokensReceived: IssuedCurrencyAmount | null, 
  assetsDeposited: IssuedCurrencyAmount[]
): string {
  let output = "\n===== Transaction Details =====\n";

  output += `🔑 Transaction Hash: ${result.result.hash}\n`;

  if (lpTokensReceived) {
    output += `\n📥 LP Tokens Received: ${lpTokensReceived.value}\n   • Token Code: ${lpTokensReceived.currency}\n`;
  }

  if (assetsDeposited && assetsDeposited.length > 0) {
    output += `\n📤 ACTUAL Assets Deposited:\n`;

    const assetsByCurrency: Record<string, IssuedCurrencyAmount[]> = {};
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

      // Handle empty issuer for XRP consistently
      const uniqueIssuers = new Set(
        assets.map((a) => a.issuer === "" ? "Native XRP" : a.issuer),
      );
      if (uniqueIssuers.size > 1) {
        output += `     Breakdown:\n`;
        assets.forEach((asset) => {
          const issuerDisplay = asset.issuer === "" ? "Native XRP" : asset.issuer;
          output += `     - ${asset.value} from issuer: ${issuerDisplay}\n`;
        });
      }
    });
  } else {
    output += `\n⚠️ No assets were detected as deposited in the transaction metadata.\n`;
  }

  if (result.result.tx_json?.Fee) {
    output += `\n💸 Transaction Cost: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;
  }

  output += "==============================\n";
  return output;
}

// Double-asset deposit: tfTwoAsset (existing, but now with explicit flag)
export async function addLiquidityTwoAsset(
  { providerXRPLWallet, ammAccount, formattedAmount1, formattedAmount2 }: AddLiquidityTwoAssetParams
): Promise<AddLiquidityResult> {
  await connectXRPLClient();

  console.log(`✅ Adding liquidity to AMM at ${ammAccount}`);
  console.log(`🔹 Asset A: ${formattedAmount1.currency} - Amount: ${formattedAmount1.value}`);
  console.log(`🔹 Asset B: ${formattedAmount2.currency} - Amount: ${formattedAmount2.value}`);

  // ========== BALANCE CHECKS ==========

  // Asset 1
  const asset1BalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount1);
  if (!asset1BalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount1.currency} balance.`,
      }
    };
  }

  // Asset 2
  const asset2BalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount2);
  if (!asset2BalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount2.currency} balance.`,
      }
    };
  }

  // ========== BUILD TRANSACTION ==========

  const amount1 = formatAmountForXRPL(formattedAmount1);
  const amount2 = formatAmountForXRPL(formattedAmount2);
  const asset1 = formatCurrencyForXRPL(formattedAmount1.currency, formattedAmount1.issuer);
  const asset2 = formatCurrencyForXRPL(formattedAmount2.currency, formattedAmount2.issuer);

  const tx: AMMDeposit = {
    TransactionType: "AMMDeposit",
    Account: providerXRPLWallet.classicAddress,
    Flags: 0x00100000, // tfTwoAsset
    Amount: amount1,
    Amount2: amount2,
    Asset: asset1,
    Asset2: asset2,
  };

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = providerXRPLWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "addLiquidityTwoAsset");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }

  console.log("✅ Successfully added liquidity to AMM");

  // ========== EXTRACT RESULTS ==========
  const lpTokensReceived = await extractLPTokensReceived(result, providerXRPLWallet, ammAccount);
  if (!lpTokensReceived) {
    return {
      success: false,
      error: {
        code: "LP_TOKEN_EXTRACTION_FAILED",
        message: "Could not determine LP tokens received from transaction"
      }
    };
  }
  const assetsDeposited = extractActualAssetsDeposited(result);
  if (assetsDeposited.length === 0) {
    return {
      success: false,
      error: {
        code: "ASSETS_EXTRACTION_FAILED",
        message: "Could not determine assets deposited from transaction"
      }
    };
  }
  const output = displayTransactionDetails(result, lpTokensReceived, assetsDeposited);
  return {
    success: true,
    message: output
  };
}

export async function addLiquidityTwoAssetLPToken(
  { providerXRPLWallet, ammAccount, formattedAmount1, formattedAmount2, lpTokenOut }: AddLiquidityLPTokenParams
): Promise<AddLiquidityResult> {
  await connectXRPLClient();
  console.log(`✅ Adding liquidity (LPToken) to AMM at ${ammAccount}`);
  console.log(
    `🔹 Asset A: ${formattedAmount1.currency} - Max Amount: ${formattedAmount1.value}`,
  );
  console.log(
    `🔹 Asset B: ${formattedAmount2.currency} - Max Amount: ${formattedAmount2.value}`,
  );
  console.log(`🔹 LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });
  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
    return {
      success: false,
      error: {
        code: "AMM_INFO_ERROR",
        message: "Could not retrieve LP token information from AMM"
      }
    };
  }

  // ========== BALANCE CHECKS ==========
  // Check asset A
  const assetABalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount1);
  if (!assetABalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount1.currency} balance.`
      }
    };
  }

  // Check asset B
  const assetBBalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount2);
  if (!assetBBalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount2.currency} balance.`
      }
    };
  }

  // ========== BUILD TRANSACTION ==========
  const amount1 = formatAmountForXRPL(formattedAmount1);
  const amount2 = formatAmountForXRPL(formattedAmount2);
  const asset1 = formatCurrencyForXRPL(formattedAmount1.currency, formattedAmount1.issuer);
  const asset2 = formatCurrencyForXRPL(formattedAmount2.currency, formattedAmount2.issuer);

  const tx: AMMDeposit = {
    TransactionType: "AMMDeposit",
    Account: providerXRPLWallet.classicAddress,
    Flags: 0x00010000, // tfLPToken
    Asset: asset1,
    Asset2: asset2,
    LPTokenOut: lpTokenOut,
  };

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = providerXRPLWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "addLiquidityTwoAssetLPToken");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }

  // ========== EXTRACT RESULTS ==========
  const lpTokensReceived = await extractLPTokensReceived(result, providerXRPLWallet, ammAccount);
  if (!lpTokensReceived) {
    return {
      success: false,
      error: {
        code: "LP_TOKENS_EXTRACTION_FAILED",
        message: "Could not determine LP tokens received from transaction"
      }
    };
  }

  const assetsDeposited = extractActualAssetsDeposited(result);
  if (assetsDeposited.length === 0) {
    return {
      success: false,
      error: {
        code: "ASSETS_EXTRACTION_FAILED",
        message: "Could not determine assets deposited from transaction"
      }
    };
  }

  const output = displayTransactionDetails(result, lpTokensReceived, assetsDeposited);
  return {
    success: true,
    message: output
  };
}

export async function addLiquiditySingleAsset(
  { providerXRPLWallet, ammAccount, formattedAmount, emptyAmount }: AddLiquiditySingleAssetParams
): Promise<AddLiquidityResult> {
  await connectXRPLClient();
  console.log(`✅ Adding single-asset liquidity to AMM at ${ammAccount}`);
  
  const ammInfoResponse: AMMInfoResponse = await client.request({
    command: "amm_info",
    amm_account: ammAccount,
    ledger_index: "validated",
  });
  if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
    return {
      success: false,
      error: {
        code: "AMM_INFO_ERROR",
        message: "Could not retrieve LP token information from AMM"
      }
    };
  }

  // ========== BALANCE CHECKS ==========
  const assetBalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount);
  if (!assetBalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount.currency} balance.`
      }
    };
  }

  // ========== BUILD TRANSACTION ==========
  const tx: AMMDeposit = {
    TransactionType: "AMMDeposit",
    Account: providerXRPLWallet.classicAddress,
    Flags: 0x00080000, // tfSingleAsset
    Asset: formatCurrencyForXRPL(formattedAmount.currency, formattedAmount.issuer),
    Asset2: formatCurrencyForXRPL(emptyAmount.currency, emptyAmount.issuer),
    Amount: formatAmountForXRPL(formattedAmount),
  };

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = providerXRPLWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "addLiquiditySingleAsset");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }

  // ========== EXTRACT RESULTS ==========
  const lpTokensReceived = await extractLPTokensReceived(result, providerXRPLWallet, ammAccount);
  if (!lpTokensReceived) {
    return {
      success: false,
      error: {
        code: "LP_TOKENS_EXTRACTION_FAILED",
        message: "Could not determine LP tokens received from transaction"
      }
    };
  }

  const assetsDeposited = extractActualAssetsDeposited(result);
  if (assetsDeposited.length === 0) {
    return {
      success: false,
      error: {
        code: "ASSETS_EXTRACTION_FAILED",
        message: "Could not determine assets deposited from transaction"
      }
    };
  }

  const output = displayTransactionDetails(result, lpTokensReceived, assetsDeposited);
  return {
    success: true,
    message: output
  };
}

export async function addLiquidityOneAssetLPToken(
  { providerXRPLWallet, ammAccount, formattedAmount, emptyAmount, lpTokenOut }: AddLiquidityOneAssetLPTokenParams
): Promise<AddLiquidityResult> {
  await connectXRPLClient();
  console.log(`✅ Adding one-asset LPToken liquidity to AMM at ${ammAccount}`);
  console.log(`🔹 Asset to deposit: ${formattedAmount.currency} - Amount: ${formattedAmount.value}`);
  console.log(`🔹 Other asset in pool: ${emptyAmount.currency} - Amount: ${emptyAmount.value}`);
  console.log(` LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

  // Validate that only one asset has a non-zero value
  if (parseFloat(formattedAmount.value) <= 0) {
    return {
      success: false,
      error: {
        code: "INVALID_AMOUNTS",
        message: "At least one asset must have a non-zero value"
      }
    };
  }
  

  // ========== BALANCE CHECKS ==========
  // Only check balance for the asset that has a non-zero value
  const assetBalanceSufficient = await checkAssetBalanceForAddLiquidity(providerXRPLWallet, formattedAmount);
  if (!assetBalanceSufficient) {
    return {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: `Insufficient ${formattedAmount.currency} balance.`
      }
    };
  }

  // ========== BUILD TRANSACTION ==========
  const tx: AMMDeposit = {
    TransactionType: "AMMDeposit",
    Account: providerXRPLWallet.classicAddress,
    Flags: 0x00200000, // tfOneAssetLPToken
    Asset: formatCurrencyForXRPL(formattedAmount.currency, formattedAmount.issuer),
    Asset2: formatCurrencyForXRPL(emptyAmount.currency, emptyAmount.issuer),
    Amount: formatAmountForXRPL(formattedAmount),
    LPTokenOut: lpTokenOut,
  };

  console.log("🔄 Preparing transaction...");
  const prepared = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = providerXRPLWallet.sign(prepared);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "addLiquidityOneAssetLPToken");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }

  // ========== EXTRACT RESULTS ==========
  const lpTokensReceived = await extractLPTokensReceived(result, providerXRPLWallet, ammAccount);
  if (!lpTokensReceived) {
    return {
      success: false,
      error: {
        code: "LP_TOKENS_EXTRACTION_FAILED",
        message: "Could not determine LP tokens received from transaction"
      }
    };
  }

  const assetsDeposited = extractActualAssetsDeposited(result);
  if (assetsDeposited.length === 0) {
    return {
      success: false,
      error: {
        code: "ASSETS_EXTRACTION_FAILED",
        message: "Could not determine assets deposited from transaction"
      }
    };
  }

  const output = displayTransactionDetails(result, lpTokensReceived, assetsDeposited);
  return {
    success: true,
    message: output
  };
}
