import { AMMWithdraw, Wallet, Currency, dropsToXrp, xrpToDrops } from "xrpl";
import BigNumber from "bignumber.js";
import { getFormattedAMMInfo } from "./ammUtils";
import { client, connectXRPLClient } from "../testnet";
import { FormattedAMMInfo, WithdrawLiquidityResult } from "@/types/xrpl/ammXRPLTypes";
import { formatCurrencyForXRPL } from "@/utils/currencyUtils";
import { formatAmountForXRPL } from "@/utils/assetUtils";
import { handleTransactionError, isTypedTransactionSuccessful } from "../errorHandler";

// Helper function to extract actual withdrawn amounts from transaction metadata
export function extractActualWithdrawnAmounts(
  nodes: any[],
  currency1: string,
  currency2: string,
): {
  actualWithdrawValue1: string | null;
  actualWithdrawValue2: string | null;
} {
  let actualWithdrawValue1: string | null = null;
  let actualWithdrawValue2: string | null = null;

  for (const node of nodes) {
    const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
    if (!entry) continue;

    // Handle RippleState (IOU tokens)
    if (entry.LedgerEntryType === "RippleState") {
      const prev = entry.PreviousFields?.Balance?.value;
      const final = entry.FinalFields?.Balance?.value;
      if (prev && final) {
        const diff = Math.abs(parseFloat(final) - parseFloat(prev));
        const currency = entry.FinalFields.Balance.currency;
        
        if (currency === currency1 && !actualWithdrawValue1) {
          actualWithdrawValue1 = diff.toFixed(8);
        } else if (currency === currency2 && !actualWithdrawValue2) {
          actualWithdrawValue2 = diff.toFixed(8);
        }
      }
    } 
    // Handle AccountRoot (XRP)
    else if (entry.LedgerEntryType === "AccountRoot") {
      const prevBal = new BigNumber(entry.PreviousFields?.Balance || 0);
      const finalBal = new BigNumber(entry.FinalFields?.Balance || 0);
      if (finalBal.isGreaterThan(prevBal)) {
        const xrpDiff = dropsToXrp(finalBal.minus(prevBal).toString());
        if (currency1 === "XRP" && !actualWithdrawValue1) {
          actualWithdrawValue1 = xrpDiff.toString();
        } else if (currency2 === "XRP" && !actualWithdrawValue2) {
          actualWithdrawValue2 = xrpDiff.toString();
        }
      }
    }
  }

  return { actualWithdrawValue1, actualWithdrawValue2 };
}

// Helper function to extract LP tokens used from transaction metadata
export function extractLPTokensUsed(
  nodes: any[],
  ammAccount: string,
  lpTokenCurrency: string
): string {
  let lpTokensUsed = "0.00";

  for (const node of nodes) {
    const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
    if (!entry) continue;

    // Check AMM node for LP token balance change
    if (entry.LedgerEntryType === "AMM") {
      const prev = entry.PreviousFields?.LPTokenBalance?.value;
      const final = entry.FinalFields?.LPTokenBalance?.value;
      if (prev && final) {
        const delta = new BigNumber(prev).minus(final);
        if (delta.isGreaterThan(0)) {
          lpTokensUsed = delta.toFixed(2);
        }
      }
    }

    // Check trustline for LP token balance change
    if (
      entry.LedgerEntryType === "RippleState" &&
      entry.FinalFields?.Balance?.currency === lpTokenCurrency &&
      entry.FinalFields?.Balance?.issuer === ammAccount
    ) {
      const prev = entry.PreviousFields?.Balance?.value;
      const final = entry.FinalFields?.Balance?.value;
      if (prev && final) {
        const delta = new BigNumber(prev).minus(final);
        if (delta.isGreaterThan(0)) {
          const trustlineLPUsed = delta.toFixed(2);
          if (lpTokensUsed === "0.00" || lpTokensUsed === "0") {
            lpTokensUsed = trustlineLPUsed;
          } else if (!new BigNumber(lpTokensUsed).eq(trustlineLPUsed)) {
            console.warn(
              `⚠️ Mismatch: AMM = ${lpTokensUsed}, Trustline = ${trustlineLPUsed}`,
            );
          }
        }
      }
    }
  }

  return lpTokensUsed;
}

// Refactored withdrawLiquidityTwoAsset with accurate LP token calculation and minimal object duplication
export async function withdrawLiquidityTwoAsset(
  withdrawerXRPLWallet: Wallet,
  withdrawValue1: string,
  withdrawValue2: string,
  ammInfo: FormattedAMMInfo,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  const asset1 = formatCurrencyForXRPL(ammInfo.formattedAmount1.currency, ammInfo.formattedAmount1.issuer);
  const asset2 = formatCurrencyForXRPL(ammInfo.formattedAmount2.currency, ammInfo.formattedAmount2.issuer);

  const amount1 = formatAmountForXRPL({currency: ammInfo.formattedAmount1.currency, issuer: ammInfo.formattedAmount1.issuer, value: withdrawValue1});
  const amount2 = formatAmountForXRPL({currency: ammInfo.formattedAmount2.currency, issuer: ammInfo.formattedAmount2.issuer, value: withdrawValue2});

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    Amount: amount1,
    Amount2: amount2,
    Flags: 0x00100000,
  };

  console.log("🔄 Preparing transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawLiquidityTwoAsset");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Use helper function to extract actual withdrawn amounts
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    ammInfo.formattedAmount1.currency,  // Pass the currency string
    ammInfo.formattedAmount2.currency   // Pass the currency string
  );
  
  // Use helper function to extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Transaction Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  if (actualWithdrawValue1)
    message += `\n📤 Withdrawn 1: ${actualWithdrawValue1} ${ammInfo.formattedAmount1.currency}\n`;
  if (actualWithdrawValue2)
    message += `📤 Withdrawn 2: ${actualWithdrawValue2} ${ammInfo.formattedAmount2.currency}\n`;
  message += `\n🔄 LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  // Get the updated AMM data
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    // Log updated pool balances
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}

// Two-asset withdraw with LP token - withdraw both assets using LP tokens
export async function withdrawLiquidityWithLPToken(
  withdrawerXRPLWallet: Wallet,
  ammInfo: FormattedAMMInfo,
  lpTokenValue: string,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  // Format assets for XRPL
  const asset1 = formatCurrencyForXRPL(ammInfo.formattedAmount1.currency, ammInfo.formattedAmount1.issuer);
  const asset2 = formatCurrencyForXRPL(ammInfo.formattedAmount2.currency, ammInfo.formattedAmount2.issuer);

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    LPTokenIn: {
      currency: ammInfo.lpToken.currency,
      issuer: ammInfo.lpToken.issuer,
      value: lpTokenValue
    },
    Flags: 0x00010000, // tfLPToken
  };

  console.log(" Preparing withdraw liquidity with LP token transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawLiquidityWithLPToken");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Extract actual withdrawn amounts using the helper function
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    ammInfo.formattedAmount1.currency,
    ammInfo.formattedAmount2.currency
  );
  
  // Extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Withdraw Liquidity with LP Token Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  if (actualWithdrawValue1)
    message += `\n📤 Withdrawn 1: ${actualWithdrawValue1} ${ammInfo.formattedAmount1.currency}\n`;
  if (actualWithdrawValue2)
    message += `📤 Withdrawn 2: ${actualWithdrawValue2} ${ammInfo.formattedAmount2.currency}\n`;
  message += `\n LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}

export async function withdrawAllLiquidity(
  withdrawerXRPLWallet: Wallet,
  ammInfo: FormattedAMMInfo,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  // Format assets for XRPL
  const asset1 = formatCurrencyForXRPL(ammInfo.formattedAmount1.currency, ammInfo.formattedAmount1.issuer);
  const asset2 = formatCurrencyForXRPL(ammInfo.formattedAmount2.currency, ammInfo.formattedAmount2.issuer);

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    Flags: 0x00020000, // tfWithdrawAll
  };

  console.log("�� Preparing withdraw all liquidity transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawAllLiquidity");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Extract actual withdrawn amounts using the helper function
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    ammInfo.formattedAmount1.currency,
    ammInfo.formattedAmount2.currency
  );
  
  // Extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Withdraw All Liquidity Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  if (actualWithdrawValue1)
    message += `\n📤 Withdrawn 1: ${actualWithdrawValue1} ${ammInfo.formattedAmount1.currency}\n`;
  if (actualWithdrawValue2)
    message += `📤 Withdrawn 2: ${actualWithdrawValue2} ${ammInfo.formattedAmount2.currency}\n`;
  message += `\n🔄 LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}

export async function withdrawSingleAsset(
  withdrawerXRPLWallet: Wallet,
  ammInfo: FormattedAMMInfo,
  withdrawCurrency: string,
  withdrawValue: string,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  // Determine which asset to withdraw and which is the other asset
  const isAsset1 = withdrawCurrency === ammInfo.formattedAmount1.currency;
  const isAsset2 = withdrawCurrency === ammInfo.formattedAmount2.currency;
  
  if (!isAsset1 && !isAsset2) {
    return {
      success: false,
      error: {
        code: "INVALID_CURRENCY",
        message: `Currency ${withdrawCurrency} not found in AMM pool`,
      }
    };
  }

  const withdrawAsset = isAsset1 ? ammInfo.formattedAmount1 : ammInfo.formattedAmount2;
  const otherAsset = isAsset1 ? ammInfo.formattedAmount2 : ammInfo.formattedAmount1;

  // Format assets for XRPL
  const asset1 = formatCurrencyForXRPL(withdrawAsset.currency, withdrawAsset.issuer);
  const asset2 = formatCurrencyForXRPL(otherAsset.currency, otherAsset.issuer);

  // Format amount for XRPL
  const amount = formatAmountForXRPL({
    currency: withdrawAsset.currency, 
    issuer: withdrawAsset.issuer, 
    value: withdrawValue
  });

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    Amount: amount,
    Flags: 0x00080000, // tfSingleAsset
  };

  console.log("🔄 Preparing single asset withdrawal transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawSingleAsset");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Extract actual withdrawn amount (only one asset is withdrawn)
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    withdrawAsset.currency,
    otherAsset.currency
  );
  
  // Extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Single Asset Withdrawal Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  message += `📤 Withdrawn: ${actualWithdrawValue1} ${withdrawAsset.currency}\n`;
  message += ` LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}

export async function withdrawAllSingleAsset(
  withdrawerXRPLWallet: Wallet,
  ammInfo: FormattedAMMInfo,
  withdrawCurrency: string,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  // Determine which asset to withdraw and which is the other asset
  const isAsset1 = withdrawCurrency === ammInfo.formattedAmount1.currency;
  const isAsset2 = withdrawCurrency === ammInfo.formattedAmount2.currency;
  
  if (!isAsset1 && !isAsset2) {
    return {
      success: false,
      error: {
        code: "INVALID_CURRENCY",
        message: `Currency ${withdrawCurrency} not found in AMM pool`,
      }
    };
  }

  const withdrawAsset = isAsset1 ? ammInfo.formattedAmount1 : ammInfo.formattedAmount2;
  const otherAsset = isAsset1 ? ammInfo.formattedAmount2 : ammInfo.formattedAmount1;

  // Format assets for XRPL
  const asset1 = formatCurrencyForXRPL(withdrawAsset.currency, withdrawAsset.issuer);
  const asset2 = formatCurrencyForXRPL(otherAsset.currency, otherAsset.issuer);

  // For withdraw all single asset, we set Amount to "0" to indicate withdraw all
  const amount = withdrawAsset.currency === "XRP" 
    ? "0" 
    : { currency: withdrawAsset.currency, issuer: withdrawAsset.issuer, value: "0" };

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    Amount: amount,
    Flags: 0x00040000, // tfWithdrawAllSingleAsset
  };

  console.log(" Preparing withdraw all single asset transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawAllSingleAsset");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Extract actual withdrawn amount (only one asset is withdrawn)
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    withdrawAsset.currency,
    otherAsset.currency
  );
  
  // Extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Withdraw All Single Asset Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  message += `📤 Asset Withdrawn: ${withdrawAsset.currency}\n`;
  message += `📤 Amount Withdrawn: ${actualWithdrawValue1} ${withdrawAsset.currency}\n`;
  message += `\n LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}

export async function withdrawSingleAssetWithLPToken(
  withdrawerXRPLWallet: Wallet,
  ammInfo: FormattedAMMInfo,
  withdrawCurrency: string,
  lpTokenValue: string,
): Promise<WithdrawLiquidityResult> {
  await connectXRPLClient();

  // Determine which asset to withdraw and which is the other asset
  const isAsset1 = withdrawCurrency === ammInfo.formattedAmount1.currency;
  const isAsset2 = withdrawCurrency === ammInfo.formattedAmount2.currency;
  
  if (!isAsset1 && !isAsset2) {
    return {
      success: false,
      error: {
        code: "INVALID_CURRENCY",
        message: `Currency ${withdrawCurrency} not found in AMM pool`,
      }
    };
  }

  const withdrawAsset = isAsset1 ? ammInfo.formattedAmount1 : ammInfo.formattedAmount2;
  const otherAsset = isAsset1 ? ammInfo.formattedAmount2 : ammInfo.formattedAmount1;

  // Format assets for XRPL
  const asset1 = formatCurrencyForXRPL(withdrawAsset.currency, withdrawAsset.issuer);
  const asset2 = formatCurrencyForXRPL(otherAsset.currency, otherAsset.issuer);

  // For single asset withdrawal with LP token, you need both Amount and LPTokenIn
  const amount = withdrawAsset.currency === "XRP" 
    ? "0" 
    : { currency: withdrawAsset.currency, issuer: withdrawAsset.issuer, value: "0" };


  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: withdrawerXRPLWallet.classicAddress,
    Asset: asset1,
    Asset2: asset2,
    Amount: amount,
    LPTokenIn: {
      currency: ammInfo.lpToken.currency,
      issuer: ammInfo.lpToken.issuer,
      value: lpTokenValue
    },
    Flags: 0x00200000, // tfOneAssetLPToken
  };

  console.log(" Preparing single asset withdrawal with LP token transaction...");
  const preparedTx = await client.autofill(tx);
  console.log("✍️ Signing transaction...");
  const signed = withdrawerXRPLWallet.sign(preparedTx);
  console.log("⏳ Submitting transaction and waiting for validation...");
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "withdrawSingleAssetWithLPToken");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      }
    };
  }
  
  const nodes = (result.result.meta as any).AffectedNodes;
  
  // Extract actual withdrawn amount (only one asset is withdrawn)
  const { actualWithdrawValue1, actualWithdrawValue2 } = extractActualWithdrawnAmounts(
    nodes,
    withdrawAsset.currency,
    otherAsset.currency
  );
  
  // Extract LP tokens used
  const ammAccount = ammInfo.account;
  const lpTokensUsed = extractLPTokensUsed(nodes, ammAccount, ammInfo.lpToken.currency);

  let message = `\n===== Single Asset Withdrawal with LP Token Summary =====\n`;
  message += `🔹 Transaction Hash: ${result.result.hash}\n`;
  message += `📤 Asset Withdrawn: ${withdrawAsset.currency}\n`;
  message += `📤 Amount Withdrawn: ${actualWithdrawValue1} ${withdrawAsset.currency}\n`;
  message += `\n LP Tokens Used: ${lpTokensUsed}\n`;
  if (result.result.tx_json?.Fee)
    message += `\n💸 Fee: ${dropsToXrp(result.result.tx_json?.Fee)} XRP\n`;

  // Update AMM state
  console.log("🔄 Updating AMM data from ledger...");  
  const updatedAMMData = await getFormattedAMMInfo(ammAccount);

  if (updatedAMMData) {
    message += "\n===== Updated AMM Pool State =====\n";
    message += `LP tokens balance: ${Number(updatedAMMData.lpToken.value).toFixed(2)}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount1.value).toFixed(8)} ${updatedAMMData.formattedAmount1.currency}\n`;
    message += `Token balance: ${Number(updatedAMMData.formattedAmount2.value).toFixed(8)} ${updatedAMMData.formattedAmount2.currency}\n`;
  } else {
    message += "⚠️ Could not retrieve updated AMM data\n";
  }
  
  return {
    success: true,
    message
  };
}
