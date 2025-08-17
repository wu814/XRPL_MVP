import * as xrpl from "xrpl";
import { Wallet } from "xrpl";
import BigNumber from "bignumber.js";
import { getFormattedAMMInfo, LPToken } from "./ammUtils";
import { client, connectXRPLClient } from "../testnet";

// Type definitions


interface Asset {
  isXRP: boolean;
  currency: string;
  value: string;
  issuer: string | null;
}



interface TransactionResult {
  result: {
    hash: string;
    meta: {
      AffectedNodes: any[];
      TransactionResult: string;
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
      lp_token: LPToken;
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

interface WithdrawResult {
  success: boolean;
  message: string;
  receivedAmountA?: string;
  receivedAmountB?: string;
  currencyA?: string;
  currencyB?: string;
  issuerA?: string | null;
  issuerB?: string | null;
  lpTokensUsed?: string;
  tx_hash: string;
  tx_result: string;
}

interface WithdrawLPTokenResult {
  success: boolean;
  message: string;
  withdrawnAmount: {
    [key: string]: string;
  };
  lpTokensRedeemed: string;
  tx_hash: string;
  tx_result: string;
}

interface WithdrawSingleAssetResult {
  success: boolean;
  message: string;
  receivedAmount: string;
  currency: string;
  issuer: string | null;
  tx_hash: string;
  tx_result: string;
}

interface WithdrawAllSingleAssetResult {
  success: boolean;
  message: string;
  receivedAmount: string;
  currency: string;
  issuer: string | null;
  minimumAmount: string;
  tx_hash: string;
  tx_result: string;
}

interface WithdrawSingleAssetLPTokenResult {
  success: boolean;
  message: string;
  receivedAmount: string;
  currency: string;
  issuer: string | null;
  lpTokensUsed?: string;
  tx_hash: string;
  tx_result: string;
}

function normalizeAsset(asset: any, defaultIssuer: string | null = null): Asset {
  if (typeof asset === "string") {
    // XRP in drops
    return {
      isXRP: true,
      currency: "XRP",
      value: xrpl.dropsToXrp(asset).toString(), // convert to XRP value for math
      issuer: null,
    };
  } else {
    return {
      isXRP: asset.currency === "XRP",
      currency: asset.currency,
      value: asset.value,
      issuer: asset.issuer || defaultIssuer,
    };
  }
}

// Refactored withdrawLiquidityTwoAsset with accurate LP token calculation and minimal object duplication
export async function withdrawLiquidityTwoAsset(
  withdrawerWallet: Wallet,
  ammAccount: string,
  minWithdrawalA: string,
  minWithdrawalB: string,
): Promise<WithdrawResult> {
  try {
    await connectXRPLClient();
    const ammData = await getFormattedAMMInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data for account ${ammAccount}`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const lpToken = ammData.lp_token;

    const totalPoolA = new BigNumber(assetA.value);
    const totalPoolB = new BigNumber(assetB.value);
    const totalLP = new BigNumber(lpToken.value || "0");

    const desiredA = new BigNumber(minWithdrawalA).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    const desiredB = new BigNumber(minWithdrawalB).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );

    const poolARatio = desiredA.dividedBy(totalPoolA);
    const poolBRatio = desiredB.dividedBy(totalPoolB);
    const withdrawalRatio = BigNumber.max(poolARatio, poolBRatio);
    const estimatedLP = totalLP
      .multipliedBy(withdrawalRatio)
      .multipliedBy(1.01)
      .decimalPlaces(6, BigNumber.ROUND_UP);

    console.log(`🔍 AMM Data received:`, JSON.stringify(ammData, null, 2));
    console.log(`Asset A:`, assetA);
    console.log(`Asset B:`, assetB);
    console.log(`Estimated LP token to withdraw: ${estimatedLP.toFixed(6)}`);

    const tx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetA.isXRP
        ? { currency: "XRP", issuer: "" }
        : { currency: assetA.currency, issuer: assetA.issuer! },
      Asset2: assetB.isXRP
        ? { currency: "XRP", issuer: "" }
        : { currency: assetB.currency, issuer: assetB.issuer! },
      Amount: assetA.isXRP
        ? xrpl.xrpToDrops(desiredA.toString())
        : {
            currency: assetA.currency,
            issuer: assetA.issuer!,
            value: desiredA.toString(),
          },
      Amount2: assetB.isXRP
        ? xrpl.xrpToDrops(desiredB.toString())
        : {
            currency: assetB.currency,
            issuer: assetB.issuer!,
            value: desiredB.toString(),
          },
      Flags: 0x00100000,
      AMMAccount: ammAccount,
    };

    const preparedTx: xrpl.Transaction = await client.autofill(tx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
      preparedTx.LastLedgerSequence = currentLedger + 50;

    const signed = withdrawerWallet.sign(preparedTx);
    console.log("🚀 Submitting liquidity withdrawal...");
    const response = await client.submitAndWait(signed.tx_blob);

    const nodes = (response.result.meta as any).AffectedNodes;
    let actualWithdrawnA: { currency: string; value: string } | null = null;
    let actualWithdrawnB: { currency: string; value: string } | null = null;
    let lpTokensUsed = "0.00";

    for (const node of nodes) {
      const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
      if (!entry) continue;

      if (entry.LedgerEntryType === "RippleState") {
        const prev = entry.PreviousFields?.Balance?.value;
        const final = entry.FinalFields?.Balance?.value;
        if (prev && final) {
          const diff = Math.abs(parseFloat(final) - parseFloat(prev));
          const currency = entry.FinalFields.Balance.currency;
          if (currency === assetA.currency && !actualWithdrawnA) {
            actualWithdrawnA = { currency, value: diff.toFixed(6) };
          } else if (currency === assetB.currency && !actualWithdrawnB) {
            actualWithdrawnB = { currency, value: diff.toFixed(6) };
          }
        }
      } else if (entry.LedgerEntryType === "AccountRoot") {
        const prevBal = new BigNumber(entry.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(entry.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal)) {
          const xrpDiff = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          if (assetA.isXRP && !actualWithdrawnA) {
            actualWithdrawnA = { currency: "XRP", value: xrpDiff.toString() };
          } else if (assetB.isXRP && !actualWithdrawnB) {
            actualWithdrawnB = { currency: "XRP", value: xrpDiff.toString() };
          }
        }
      }

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

      if (
        entry.LedgerEntryType === "RippleState" &&
        entry.FinalFields?.Balance?.currency === "LP" &&
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

    let message = `\n===== Transaction Summary =====\n`;
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;
    if (actualWithdrawnA)
      message += `\n📤 Withdrawn A: ${actualWithdrawnA.value} ${actualWithdrawnA.currency}\n`;
    if (actualWithdrawnB)
      message += `📤 Withdrawn B: ${actualWithdrawnB.value} ${actualWithdrawnB.currency}\n`;
    message += `\n🔄 LP Tokens Used: ${lpTokensUsed}\n`;
    if (response.result.tx_json?.Fee)
      message += `\n💸 Fee: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;

    // Update AMM state
    console.log("🔄 Updating AMM data from ledger...");
    try {
      // Get the updated AMM data
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);

      if (updatedAMMData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${updatedAMMData.lp_token}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }
    
    return {
      success: true,
      message,
      receivedAmountA: actualWithdrawnA?.value ? parseFloat(actualWithdrawnA.value).toFixed(6) : undefined,
      receivedAmountB: actualWithdrawnB?.value ? parseFloat(actualWithdrawnB.value).toFixed(6) : undefined,
      currencyA: assetA.currency,
      currencyB: assetB.currency,
      issuerA: assetA.issuer,
      issuerB: assetB.issuer,
      lpTokensUsed: lpTokensUsed ? parseFloat(lpTokensUsed).toFixed(6) : undefined,
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error("❌ Error withdrawing two-asset liquidity:", error.message);
    throw error;
  }
}

// Two-asset withdraw with LP token - withdraw both assets using LP tokens
export async function withdrawLiquidityWithLPToken(
  withdrawerWallet: Wallet,
  ammAccount: string,
  lpTokenAmount: string,
): Promise<WithdrawLPTokenResult> {
  try {
    await connectXRPLClient();

    const ammData = await getFormattedAMMInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data structure.`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const lpToken = ammData.lp_token;

    const totalPoolA = new BigNumber(assetA.value);
    const totalPoolB = new BigNumber(assetB.value);
    const totalLP = new BigNumber(lpToken.value);
    const lpAmount = new BigNumber(lpTokenAmount).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );

    console.log(
      `✅ Withdrawing ${lpAmount.toFixed(6)} LP tokens from AMM at ${ammAccount}`,
    );
    console.log(
      `📊 Current Pool: ${assetA.currency} = ${totalPoolA.toFixed(6)}, ${assetB.currency} = ${totalPoolB.toFixed(6)}, LP = ${totalLP.toFixed(6)}`,
    );

    const expectedA = lpAmount
      .multipliedBy(totalPoolA)
      .dividedBy(totalLP)
      .decimalPlaces(6, BigNumber.ROUND_DOWN);
    const expectedB = lpAmount
      .multipliedBy(totalPoolB)
      .dividedBy(totalLP)
      .decimalPlaces(6, BigNumber.ROUND_DOWN);

    console.log(
      `🔹 Expected Withdrawals: ${expectedA.toFixed(6)} ${assetA.currency}, ${expectedB.toFixed(6)} ${assetB.currency}`,
    );

    const assetObjA = assetA.isXRP
      ? "XRP"
      : { currency: assetA.currency, issuer: assetA.issuer };
    const assetObjB = assetB.isXRP
      ? "XRP"
      : { currency: assetB.currency, issuer: assetB.issuer };

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetObjA === "XRP" ? { currency: "XRP", issuer: "" } : assetObjA,
      Asset2: assetObjB === "XRP" ? { currency: "XRP", issuer: "" } : assetObjB,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6),
      },
      Flags: 65536,
      AMMAccount: ammAccount,
    };

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 50;

    const signedTx = withdrawerWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);

    const nodes = (response.result.meta as any).AffectedNodes;
    let actualWithdrawnA: { currency: string; value: string } | null = null;
    let actualWithdrawnB: { currency: string; value: string } | null = null;

    for (const node of nodes) {
      if (node.ModifiedNode?.LedgerEntryType === "RippleState") {
        const { Balance, currency } =
          node.ModifiedNode.FinalFields?.Balance || {};
        const prevValue = node.ModifiedNode.PreviousFields?.Balance?.value;
        const finalValue = node.ModifiedNode.FinalFields?.Balance?.value;

        if (prevValue && finalValue) {
          const diff = Math.abs(
            parseFloat(finalValue) - parseFloat(prevValue),
          ).toFixed(6);
          if (!actualWithdrawnA && currency === assetA.currency) {
            actualWithdrawnA = { currency, value: diff };
          } else if (!actualWithdrawnB && currency === assetB.currency) {
            actualWithdrawnB = { currency, value: diff };
          }
        }
        // Check if XRP was withdrawn
      } else if (node.ModifiedNode?.LedgerEntryType === "AccountRoot") {
        const state = node.ModifiedNode;
        const prevBal = new BigNumber(state.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(state.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal)) {
          const diffXRP = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP.toString() };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP.toString() };
        }
      }
    }

    let message = `\n===== Transaction Summary =====\n`;
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;
    message += `\n📤 Withdrawn Amounts:\n`;
    message += `   ${actualWithdrawnA?.value ?? `~${expectedA.toFixed(6)}`} ${assetA.currency}\n`;
    message += `   ${actualWithdrawnB?.value ?? `~${expectedB.toFixed(6)}`} ${assetB.currency}\n`;
    message += `\n🔄 LP Tokens Redeemed: ${lpAmount.toFixed(6)}\n`;
    message += `💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;

    try {
      // Get the updated AMM data
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);

      if (updatedAMMData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAMMData.lp_token.value).toFixed(2)}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      withdrawnAmount: {
        [assetA.currency]: actualWithdrawnA?.value ? parseFloat(actualWithdrawnA.value).toFixed(6) : expectedA.toFixed(6),
        [assetB.currency]: actualWithdrawnB?.value ? parseFloat(actualWithdrawnB.value).toFixed(6) : expectedB.toFixed(6),
      },
      lpTokensRedeemed: lpAmount.toFixed(6),
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error("❌ Error withdrawing with LP token:", error.message);
    throw error;
  }
}

export async function withdrawAllLiquidity(
  withdrawerWallet: Wallet,
  ammAccount: string,
): Promise<WithdrawLPTokenResult> {
  try {
    await connectXRPLClient();
    // Fetch current AMM state
    const ammData = await getFormattedAMMInfo(ammAccount);

    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data structure.`);
    }

    // Normalize assets for consistent handling
    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const lpToken = ammData.lp_token;

    console.log(`✅ Withdrawing ALL liquidity from AMM at ${ammAccount}`);

    // Fetch LP token balance for withdrawer wallet
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: withdrawerWallet.classicAddress,
      peer: lpToken.issuer,
    });

    const trustlines = accountLinesResponse.result.lines;
    const lpTrustline = trustlines.find(
      (line: any) => line.currency === lpToken.currency,
    );

    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      throw new Error(
        "❌ No LP tokens found in wallet. Nothing to withdraw.",
      );
    }

    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    console.log(`🔹 Found ${lpBalance.toFixed(6)} LP tokens to withdraw`);

    // Construct asset objects for the transaction
    const assetObjA = assetA.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: assetA.currency, issuer: assetA.issuer! };
    const assetObjB = assetB.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: assetB.currency, issuer: assetB.issuer! };

    // Create AMMWithdraw transaction with tfWithdrawAll flag
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetObjA,
      Asset2: assetObjB,
      Flags: 131072,
      AMMAccount: ammAccount,
    };

    // Autofill and set ledger expiration
    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 50;

    // Sign and submit the transaction
    const signedTx = withdrawerWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);

    // Parse the transaction metadata to extract actual withdrawn amounts
    const nodes = (response.result.meta as any).AffectedNodes;
    let actualWithdrawnA: { currency: string; value: string } | null = null;
    let actualWithdrawnB: { currency: string; value: string } | null = null;

    for (const node of nodes) {
      if (node.ModifiedNode?.LedgerEntryType === "RippleState") {
        const { Balance } = node.ModifiedNode.FinalFields || {};
        const prev = node.ModifiedNode.PreviousFields?.Balance?.value;
        const final = node.ModifiedNode.FinalFields?.Balance?.value;

        if (prev && final) {
          const diff = Math.abs(parseFloat(final) - parseFloat(prev)).toFixed(
            6,
          );
          if (!actualWithdrawnA && Balance.currency === assetA.currency) {
            actualWithdrawnA = { currency: Balance.currency, value: diff };
          } else if (
            !actualWithdrawnB &&
            Balance.currency === assetB.currency
          ) {
            actualWithdrawnB = { currency: Balance.currency, value: diff };
          }
        }
      } else if (node.ModifiedNode?.LedgerEntryType === "AccountRoot") {
        const state = node.ModifiedNode;
        const prevBal = new BigNumber(state.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(state.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal)) {
          const diffXRP = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP.toString() };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP.toString() };
        }
      }
    }

    // Format message for the transaction summary
    let message = `\n===== Transaction Summary =====\n`;
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;
    message += `\n📤 Withdrawn Amounts:\n`;
    message += `   ${actualWithdrawnA?.value ?? `~${new BigNumber(assetA.value).toFixed(6)}`} ${assetA.currency}\n`;
    message += `   ${actualWithdrawnB?.value ?? `~${new BigNumber(assetB.value).toFixed(6)}`} ${assetB.currency}\n`;
    message += `\n🔄 All LP tokens redeemed (${lpBalance} LP tokens)\n`;
    message += `💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;

    // Refresh and log updated AMM pool state
    try {
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);
      if (updatedAMMData) {
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAMMData.lp_token.value).toFixed(2)}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      withdrawnAmount: {
        [assetA.currency]:
          actualWithdrawnA?.value ? parseFloat(actualWithdrawnA.value).toFixed(6) : new BigNumber(assetA.value).toFixed(6),
        [assetB.currency]:
          actualWithdrawnB?.value ? parseFloat(actualWithdrawnB.value).toFixed(6) : new BigNumber(assetB.value).toFixed(6),
      },
      lpTokensRedeemed: parseFloat(lpBalance.toString()).toFixed(6),
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error("❌ Error withdrawing all liquidity:", error.message);
    throw error;
  }
}

export async function withdrawSingleAsset(
  withdrawerWallet: Wallet,
  ammAccount: string,
  assetType: string,
  withdrawAmount: string,
): Promise<WithdrawSingleAssetResult> {
  try {
    await connectXRPLClient();

    // Fetch AMM data
    const ammData = await getFormattedAMMInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data structure.`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const asset =
      assetType === "XRP" || assetType === assetA.currency ? assetA : assetB;
    const otherAsset = asset.currency === assetA.currency ? assetB : assetA;
    const lpToken = ammData.lp_token;

    const withdrawAmountBN = new BigNumber(withdrawAmount).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    const totalAsset = new BigNumber(asset.value);
    const totalLP = new BigNumber(lpToken.value);

    console.log(
      `✅ Withdrawing ${withdrawAmount} ${asset.currency} from AMM at ${ammAccount}`,
    );

    // Fetch withdrawer wallet LP token balance
    const {
      result: { lines: trustlines },
    } = await client.request({
      command: "account_lines",
      account: withdrawerWallet.classicAddress,
      peer: lpToken.issuer,
    });

    const lpTrustline = trustlines.find(
      (line: any) => line.currency === lpToken.currency,
    );
    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      throw new Error(
        "❌ No LP tokens found in wallet. Nothing to withdraw.",
      );
    }

    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    console.log(`✅ wallet LP token balance: ${lpBalance.toFixed(6)}`);

    // Current pool state
    console.log(`\n📊 Current AMM Pool State:`);
    console.log(`   ${asset.currency}: ${asset.value}`);
    console.log(`   ${otherAsset.currency}: ${otherAsset.value}`);
    console.log(`   LP Tokens: ${lpToken.value}`);

    // Estimate LP tokens needed
    const requiredLP = withdrawAmountBN
      .multipliedBy(totalLP)
      .dividedBy(totalAsset)
      .multipliedBy(1.02) // 2% buffer
      .decimalPlaces(6, BigNumber.ROUND_DOWN);

    console.log(`🔹 Estimated LP tokens required: ${requiredLP.toFixed(6)}`);

    // Prepare transaction Asset & Amount
    const assetObj = asset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: asset.currency, issuer: asset.issuer! };

    const amountObj = asset.isXRP
      ? xrpl.xrpToDrops(withdrawAmountBN.toString())
      : {
          currency: asset.currency,
          issuer: asset.issuer!,
          value: withdrawAmountBN.toString(),
        };

    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer! };

    // Build and submit transaction
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetObj,
      Asset2: otherAssetObj,
      Amount: amountObj,
      Flags: 0x00080000, // tfSingleAsset
      AMMAccount: ammAccount,
    };

    console.log("📜 Preparing Single Asset AMMWithdraw transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 50;

    const signedTx = withdrawerWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = (response.result.meta as any).AffectedNodes;
    console.log(
      "🔍 Transaction metadata nodes:",
      JSON.stringify(nodes, null, 2),
    );

    // Parse metadata
    let actualWithdrawn: { currency: string; value: string } | null = null;
    let lpTokensUsed = "0.00";

    for (const node of nodes) {
      console.log("🔍 Processing node:", JSON.stringify(node, null, 2));
      const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
      if (!entry) continue;

      // 1️⃣ Actual asset withdrawn (RippleState or AccountRoot)
      if (entry.LedgerEntryType === "RippleState") {
        const prev = entry.PreviousFields?.Balance?.value;
        const final = entry.FinalFields?.Balance?.value;
        if (
          prev &&
          final &&
          entry.FinalFields.Balance.currency === asset.currency
        ) {
          const diff = Math.abs(parseFloat(final) - parseFloat(prev));
          if (diff > 0) {
            actualWithdrawn = {
              currency: asset.currency,
              value: diff.toFixed(6),
            };
            continue;
          }
        }
      } else if (entry.LedgerEntryType === "AccountRoot") {
        const prevBal = new BigNumber(entry.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(entry.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal)) {
          const diffXRP = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          if (asset.isXRP) {
            actualWithdrawn = { currency: "XRP", value: diffXRP.toString() };
          }
        }
      }

      // 2️⃣ LP token delta from AMM node
      if (entry.LedgerEntryType === "AMM") {
        const prev = entry.PreviousFields?.LPTokenBalance?.value;
        const final = entry.FinalFields?.LPTokenBalance?.value;

        if (prev && final) {
          const delta = new BigNumber(prev).minus(final);
          if (delta.isGreaterThan(0)) {
            lpTokensUsed = delta.toFixed(2);
            console.log(`✅ LP tokens used (from AMM node): ${lpTokensUsed}`);
          }
        }
      }

      // 3️⃣ LP token delta from user trustline (RippleState)
      if (
        entry.LedgerEntryType === "RippleState" &&
        entry.FinalFields?.Balance?.currency === ammData.lp_token.currency &&
        entry.FinalFields?.Balance?.issuer === ammData.lp_token.issuer
      ) {
        const prev = entry.PreviousFields?.Balance?.value;
        const final = entry.FinalFields?.Balance?.value;

        if (prev && final) {
          const delta = new BigNumber(prev).minus(final);
          if (delta.isGreaterThan(0)) {
            const trustlineLPUsed = delta.toFixed(2);

            // Prefer AMM node result if not already set
            if (lpTokensUsed === "0.00" || lpTokensUsed === "0") {
              lpTokensUsed = trustlineLPUsed;
              console.log(
                `✅ LP tokens used (from trustline): ${lpTokensUsed}`,
              );
            } else if (!new BigNumber(lpTokensUsed).eq(trustlineLPUsed)) {
              console.warn(
                `⚠️ Mismatch between AMM node and trustline LP token usage: AMM = ${lpTokensUsed}, Trustline = ${trustlineLPUsed}`,
              );
            }
          }
        }
      }
    }

    // Transaction summary
    let message = "\n===== Transaction Summary =====\n";
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;

    if (actualWithdrawn) {
      message += `\n📤 Actual amount withdrawn:\n   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n   (You requested: ${withdrawAmount} ${asset.currency})\n`;
    } else {
      message += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n   Requested: ${withdrawAmount} ${asset.currency}\n`;
    }
    message += `\n🔄 LP Tokens Redeemed: ${lpTokensUsed}\n`;

    if (response.result.tx_json?.Fee) {
      message += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
    }

    // Update AMM state
    console.log("🔄 Updating AMM data from ledger...");
    try {
      // Get the updated AMM data
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);

      if (updatedAMMData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAMMData.lp_token.value).toFixed(2)}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn ? parseFloat(actualWithdrawn.value).toFixed(6) : parseFloat(withdrawAmount).toFixed(6),
      currency: asset.currency,
      issuer: asset.issuer,
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error("❌ Error withdrawing single asset:", error.message);
    throw error;
  }
}

export async function withdrawAllSingleAsset(
  withdrawerWallet: Wallet,
  ammAccount: string,
  assetType: string,
  desiredAmount: string | null,
): Promise<WithdrawAllSingleAssetResult> {
  try {
    await connectXRPLClient();
    const ammData = await getFormattedAMMInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data for account ${ammAccount}`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const asset =
      assetType === "XRP" || assetType === assetA.currency ? assetA : assetB;
    const otherAsset = asset.currency === assetA.currency ? assetB : assetA;
    const lpToken = ammData.lp_token;

    let amount_BN: BigNumber, withdrawObj: any;

    if (desiredAmount === null) {
      console.log(`✅ True withdraw-all of ${asset.currency}`);
      withdrawObj = asset.isXRP
        ? "0"
        : { currency: asset.currency, issuer: asset.issuer, value: "0" };
      amount_BN = new BigNumber("0");
    } else {
      amount_BN = new BigNumber(desiredAmount).decimalPlaces(
        6,
        BigNumber.ROUND_DOWN,
      );
      if (amount_BN.lt("0.000001")) amount_BN = new BigNumber("0.000001");
      withdrawObj = asset.isXRP
        ? xrpl.xrpToDrops(amount_BN.toFixed(6))
        : {
            currency: asset.currency,
            issuer: asset.issuer!,
            value: amount_BN.toFixed(6),
          };
    }

    const assetObj = asset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: asset.currency, issuer: asset.issuer! };
    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer! };

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetObj,
      Asset2: otherAssetObj,
      Amount: withdrawObj,
      Flags: 0x00040000,
      AMMAccount: ammAccount,
    };

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 50;
    const signedTx = withdrawerWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = (response.result.meta as any).AffectedNodes;
    let actualWithdrawn: { currency: string; value: string } | null = null;
    let lpTokensUsed = "0.00";

    for (const node of nodes) {
      const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
      if (!entry) continue;

      if (entry.LedgerEntryType === "RippleState") {
        const prev = entry.PreviousFields?.Balance?.value;
        const final = entry.FinalFields?.Balance?.value;
        if (
          prev &&
          final &&
          entry.FinalFields.Balance.currency === asset.currency
        ) {
          const diff = Math.abs(parseFloat(final) - parseFloat(prev));
          if (diff > 0) {
            actualWithdrawn = {
              currency: asset.currency,
              value: diff.toFixed(6),
            };
            continue;
          }
        }
      } else if (entry.LedgerEntryType === "AccountRoot") {
        const prevBal = new BigNumber(entry.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(entry.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal) && asset.isXRP) {
          const diffXRP = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          actualWithdrawn = { currency: "XRP", value: diffXRP.toString() };
        }
      }

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

      if (
        entry.LedgerEntryType === "RippleState" &&
        entry.FinalFields?.Balance?.currency === lpToken.currency &&
        entry.FinalFields?.Balance?.issuer === lpToken.issuer
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
                `⚠️ Mismatch between AMM and trustline LP token usage: AMM = ${lpTokensUsed}, Trustline = ${trustlineLPUsed}`,
              );
            }
          }
        }
      }
    }

    let message = `\n===== Transaction Summary =====\n`;
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;

    if (actualWithdrawn) {
      message += `\n📤 Actual amount withdrawn:\n   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n`;
      if (desiredAmount) {
        message += `   (You requested: ${desiredAmount} ${asset.currency})\n`;
      } else {
        message += `   (True withdraw-all operation - no minimum specified)\n`;
      }
    } else {
      message += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n`;
      if (desiredAmount) {
        message += `   Requested: ${desiredAmount} ${asset.currency}\n`;
      } else {
        message += `   True withdraw-all operation completed\n`;
      }
    }

    message += `\n🔄 LP Tokens Redeemed: ${lpTokensUsed}\n`;
    if (response.result.tx_json?.Fee) {
      message += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
    }

    try {
      // Get the updated AMM data
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);

      if (updatedAMMData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAMMData.lp_token.value).toFixed(2)}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn
        ? parseFloat(actualWithdrawn.value).toFixed(6)
        : desiredAmount?.toString() || "0.000000",
      currency: asset.currency,
      issuer: asset.issuer,
      minimumAmount: desiredAmount ? amount_BN.toFixed(6) : "0.000000",
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error("❌ Error withdrawing all single asset:", error.message);
    throw error;
  }
}

export async function withdrawSingleAssetWithLPToken(
  withdrawerWallet: Wallet,
  ammAccount: string,
  assetType: string,
  lpTokenAmount: string,
): Promise<WithdrawSingleAssetLPTokenResult> {
  try {
    await connectXRPLClient();
    const ammData = await getFormattedAMMInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data for account ${ammAccount}`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const asset =
      assetType === "XRP" || assetType === assetA.currency ? assetA : assetB;
    const otherAsset = asset.currency === assetA.currency ? assetB : assetA;
    const lpToken = ammData.lp_token;

    const lpAmount = new BigNumber(lpTokenAmount).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    const totalPool = new BigNumber(asset.value);
    const totalLP = new BigNumber(lpToken.value);
    const expectedAmount = lpAmount
      .multipliedBy(totalPool)
      .dividedBy(totalLP)
      .decimalPlaces(6, BigNumber.ROUND_DOWN);

    const assetObj = asset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: asset.currency, issuer: asset.issuer! };
    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP", issuer: "" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer! };

    const amountObj = asset.isXRP
      ? xrpl.xrpToDrops(expectedAmount.toFixed(6))
      : {
          currency: asset.currency,
          issuer: asset.issuer!,
          value: expectedAmount.toFixed(6),
        };

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw" as const,
      Account: withdrawerWallet.classicAddress,
      Asset: assetObj,
      Asset2: otherAssetObj,
      Amount: amountObj,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6),
      },
      Flags: 0x00200000, // tfOneAssetLPToken
      AMMAccount: ammAccount,
    };

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    (preparedTx as any).LastLedgerSequence = currentLedger + 50;
    const signedTx = withdrawerWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = (response.result.meta as any).AffectedNodes;
    let actualWithdrawn: { currency: string; value: string } | null = null;
    let lpTokensUsed = "0.00";

    for (const node of nodes) {
      const entry = node.ModifiedNode || node.DeletedNode || node.CreatedNode;
      if (!entry) continue;

      if (entry.LedgerEntryType === "RippleState") {
        const prev = entry.PreviousFields?.Balance?.value;
        const final = entry.FinalFields?.Balance?.value;
        if (
          prev &&
          final &&
          entry.FinalFields.Balance.currency === asset.currency
        ) {
          const diff = Math.abs(parseFloat(final) - parseFloat(prev));
          if (diff > 0) {
            actualWithdrawn = {
              currency: asset.currency,
              value: diff.toFixed(6),
            };
            continue;
          }
        }
      } else if (entry.LedgerEntryType === "AccountRoot") {
        const prevBal = new BigNumber(entry.PreviousFields?.Balance || 0);
        const finalBal = new BigNumber(entry.FinalFields?.Balance || 0);
        if (finalBal.isGreaterThan(prevBal) && asset.isXRP) {
          const diffXRP = xrpl.dropsToXrp(finalBal.minus(prevBal).toString());
          actualWithdrawn = { currency: "XRP", value: diffXRP.toString() };
        }
      }

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

      if (
        entry.LedgerEntryType === "RippleState" &&
        entry.FinalFields?.Balance?.currency === lpToken.currency &&
        entry.FinalFields?.Balance?.issuer === lpToken.issuer
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
                `⚠️ Mismatch between AMM and trustline LP token usage: AMM = ${lpTokensUsed}, Trustline = ${trustlineLPUsed}`,
              );
            }
          }
        }
      }
    }

    let message = `\n===== Transaction Summary =====\n`;
    message += `🔹 Transaction Hash: ${response.result.hash}\n`;

    if (actualWithdrawn) {
      message += `\n📤 Actual amount withdrawn:\n   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n`;
    } else {
      message += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n`;
    }

    message += `\n🔄 LP Tokens Used: ${lpTokensUsed}\n`;

    if (response.result.tx_json?.Fee) {
      message += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
    }

    try {
      // Get the updated AMM data
      const updatedAMMData = await getFormattedAMMInfo(ammAccount);

      if (updatedAMMData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAMMData.lp_token.value).toFixed(2)}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount.value).toFixed(8)} ${updatedAMMData.amount.currency}\n`;
        message += `Token balance: ${Number(updatedAMMData.amount2.value).toFixed(8)} ${updatedAMMData.amount2.currency}\n`;
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError: any) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn
        ? parseFloat(actualWithdrawn.value).toFixed(6)
        : parseFloat(expectedAmount.toString()).toFixed(6),
      currency: asset.currency,
      issuer: asset.issuer,
      lpTokensUsed: lpTokensUsed ? parseFloat(lpTokensUsed).toFixed(6) : undefined,
      tx_hash: response.result.hash,
      tx_result: (response.result.meta as any).TransactionResult,
    };
  } catch (error: any) {
    console.error(
      "❌ Error withdrawing single asset with LP token:",
      error.message,
    );
    throw error;
  }
}
