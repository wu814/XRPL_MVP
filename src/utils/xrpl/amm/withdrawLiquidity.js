import * as xrpl from "xrpl";
import BigNumber from "bignumber.js";

import getAmmInfo from "./getAmmInfo";
import { client, connectXrplClient } from "../testnet"; // or adjust to "../../client" if needed
import { checkTrustline } from "@/utils/xrpl/trustline/setTrustline";
import { type } from "os";
import { stringify } from "querystring";

function normalizeAsset(asset, defaultIssuer = null) {
  if (typeof asset === "string") {
    // XRP in drops
    return {
      isXRP: true,
      currency: "XRP",
      value: xrpl.dropsToXrp(asset), // convert to XRP value for math
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
  standbyWallet,
  ammAccount,
  minWithdrawalA,
  minWithdrawalB,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data for account ${ammAccount}`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const lpToken = ammData.lp_token;

    const totalPoolA = new BigNumber(assetA.value);
    const totalPoolB = new BigNumber(assetB.value);
    const totalLP = new BigNumber(lpToken.value);

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
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetA.isXRP
        ? { currency: "XRP" }
        : { currency: assetA.currency, issuer: assetA.issuer },
      Asset2: assetB.isXRP
        ? { currency: "XRP" }
        : { currency: assetB.currency, issuer: assetB.issuer },
      Amount: assetA.isXRP
        ? xrpl.xrpToDrops(desiredA.toFixed(6))
        : {
            currency: assetA.currency,
            issuer: assetA.issuer,
            value: desiredA.toFixed(6),
          },
      Amount2: assetB.isXRP
        ? xrpl.xrpToDrops(desiredB.toFixed(6))
        : {
            currency: assetB.currency,
            issuer: assetB.issuer,
            value: desiredB.toFixed(6),
          },
      Flags: 0x00100000,
      AMMAccount: ammAccount,
    };

    const preparedTx = await client.autofill(tx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;

    const signed = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting liquidity withdrawal...");
    const response = await client.submitAndWait(signed.tx_blob);
    const fee = new BigNumber(response.result.tx_json?.Fee);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `Withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    const nodes = response.result.meta.AffectedNodes;
    let actualWithdrawnA = null;
    let actualWithdrawnB = null;
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
          const xrpDiff = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (assetA.isXRP && !actualWithdrawnA) {
            actualWithdrawnA = { currency: "XRP", value: xrpDiff };
          } else if (assetB.isXRP && !actualWithdrawnB) {
            actualWithdrawnB = { currency: "XRP", value: xrpDiff };
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
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }
    return {
      success: true,
      message,
      receivedAmountA: actualWithdrawnA?.value,
      receivedAmountB: actualWithdrawnB?.value,
      currencyA: assetA.currency,
      currencyB: assetB.currency,
      issuerA: assetA.issuer,
      issuerB: assetB.issuer,
      lpTokensUsed,
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error("❌ Error withdrawing two-asset liquidity:", error.message);
    throw error;
  }
}

// Two-asset withdraw with LP token - withdraw both assets using LP tokens
export async function withdrawLiquidityWithLPToken(
  standbyWallet,
  ammAccount,
  lpTokenAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();

    const ammData = await getAmmInfo(ammAccount);
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
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObjA === "XRP" ? { currency: "XRP" } : assetObjA,
      Asset2: assetObjB === "XRP" ? { currency: "XRP" } : assetObjB,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6),
      },
      Flags: 65536,
      AMMAccount: ammAccount,
      ...(operationalWalletInfo?.destTag && {
        DestinationTag: operationalWalletInfo.destTag,
      }),
    };

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;

    const signedTx = standbyWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `❌ Withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    const nodes = response.result.meta.AffectedNodes;
    let actualWithdrawnA = null;
    let actualWithdrawnB = null;

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
          const diffXRP = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP };
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
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      withdrawnAmount: {
        [assetA.currency]: actualWithdrawnA?.value ?? expectedA.toFixed(6),
        [assetB.currency]: actualWithdrawnB?.value ?? expectedB.toFixed(6),
      },
      lpTokensRedeemed: lpAmount.toFixed(6),
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error("❌ Error withdrawing with LP token:", error.message);
    throw error;
  }
}

// Withdraw all liquidity from the AMM
export async function withdrawAllLiquidity(standbyWallet, ammAccount) {
  try {
    await connectXrplClient();
    // Fetch current AMM state
    const ammData = await getAmmInfo(ammAccount);

    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data structure.`);
    }

    // Normalize assets for consistent handling
    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const lpToken = ammData.lp_token;

    console.log(`✅ Withdrawing ALL liquidity from AMM at ${ammAccount}`);

    // Fetch LP token balance for standby wallet
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: standbyWallet.classicAddress,
      peer: lpToken.issuer,
    });

    const trustlines = accountLinesResponse.result.lines;
    const lpTrustline = trustlines.find(
      (line) => line.currency === lpToken.currency,
    );

    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      throw new Error(
        "❌ No LP tokens found in standby wallet. Nothing to withdraw.",
      );
    }

    const lpBalance = new BigNumber(lpTrustline.balance).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    console.log(`🔹 Found ${lpBalance.toFixed(6)} LP tokens to withdraw`);

    // Construct asset objects for the transaction
    const assetObjA = assetA.isXRP
      ? { currency: "XRP" }
      : { currency: assetA.currency, issuer: assetA.issuer };
    const assetObjB = assetB.isXRP
      ? { currency: "XRP" }
      : { currency: assetB.currency, issuer: assetB.issuer };

    // Create AMMWithdraw transaction with tfWithdrawAll flag
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObjA,
      Asset2: assetObjB,
      Flags: 131072,
      AMMAccount: ammAccount,
    };

    // Autofill and set ledger expiration
    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;

    // Sign and submit the transaction
    const signedTx = standbyWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `❌ AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    // Parse the transaction metadata to extract actual withdrawn amounts
    const nodes = response.result.meta.AffectedNodes;
    let actualWithdrawnA = null;
    let actualWithdrawnB = null;

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
          const diffXRP = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP };
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
      const updatedAmmData = await getAmmInfo(ammAccount);
      if (updatedAmmData) {
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      withdrawnAmount: {
        [assetA.currency]:
          actualWithdrawnA?.value ?? new BigNumber(assetA.value).toFixed(6),
        [assetB.currency]:
          actualWithdrawnB?.value ?? new BigNumber(assetB.value).toFixed(6),
      },
      lpTokensRedeemed: lpBalance.toFixed(6),
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error("❌ Error withdrawing all liquidity:", error.message);
    throw error;
  }
}

// Single asset withdrawal - withdraw just one asset
export async function withdrawSingleAsset(
  standbyWallet,
  ammAccount,
  assetType,
  withdrawAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();

    // Fetch AMM data
    const ammData = await getAmmInfo(ammAccount);
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

    // Fetch standby wallet LP token balance
    const {
      result: { lines: trustlines },
    } = await client.request({
      command: "account_lines",
      account: standbyWallet.classicAddress,
      peer: lpToken.issuer,
    });

    const lpTrustline = trustlines.find(
      (line) => line.currency === lpToken.currency,
    );
    if (!lpTrustline || new BigNumber(lpTrustline.balance).isZero()) {
      throw new Error(
        "❌ No LP tokens found in standby wallet. Nothing to withdraw.",
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
      ? { currency: "XRP" }
      : { currency: asset.currency, issuer: asset.issuer };

    const amountObj = asset.isXRP
      ? xrpl.xrpToDrops(withdrawAmountBN.toFixed(6))
      : {
          currency: asset.currency,
          issuer: asset.issuer,
          value: withdrawAmountBN.toFixed(6),
        };

    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer };

    // Build and submit transaction
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
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
    preparedTx.LastLedgerSequence = currentLedger + 50;

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = response.result.meta.AffectedNodes;
    console.log(
      "🔍 Transaction metadata nodes:",
      JSON.stringify(nodes, null, 2),
    );

    // Parse metadata
    let actualWithdrawn = null;
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
          const diffXRP = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (asset.isXRP) {
            actualWithdrawn = { currency: "XRP", value: diffXRP };
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
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn ? actualWithdrawn.value : withdrawAmount,
      currency: asset.currency,
      issuer: asset.issuer,
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error("❌ Error withdrawing single asset:", error.message);
    throw error;
  }
}

// Updated withdrawAllSingleAsset using normalizeAsset and improved LP token tracking
export async function withdrawAllSingleAsset(
  standbyWallet,
  ammAccount,
  assetType,
  desiredAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData || !ammData.amount || !ammData.amount2 || !ammData.lp_token) {
      throw new Error(`❌ Invalid AMM data for account ${ammAccount}`);
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);
    const asset =
      assetType === "XRP" || assetType === assetA.currency ? assetA : assetB;
    const otherAsset = asset.currency === assetA.currency ? assetB : assetA;
    const lpToken = ammData.lp_token;

    let amount_BN, withdrawObj;

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
            issuer: asset.issuer,
            value: amount_BN.toFixed(6),
          };
    }

    const assetObj = asset.isXRP
      ? { currency: "XRP" }
      : { currency: asset.currency, issuer: asset.issuer };
    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer };

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObj,
      Asset2: otherAssetObj,
      Amount: withdrawObj,
      Flags: 0x00040000,
      AMMAccount: ammAccount,
    };

    const preparedTx = await client.autofill(ammWithdrawTx);
    const currentLedger = (await client.request({ command: "ledger_current" }))
      .result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;
    const signedTx = standbyWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = response.result.meta.AffectedNodes;
    let actualWithdrawn = null;
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
          const diffXRP = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          actualWithdrawn = { currency: "XRP", value: diffXRP };
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
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn
        ? actualWithdrawn.value
        : desiredAmount?.toFixed(6) || "0",
      currency: asset.currency,
      issuer: asset.issuer || null,
      minimumAmount: desiredAmount ? amount_BN.toFixed(6) : "0",
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error("❌ Error withdrawing all single asset:", error.message);
    throw error;
  }
}

// Updated withdrawSingleAssetWithLPToken using normalizeAsset and improved LP token usage tracking
export async function withdrawSingleAssetWithLPToken(
  standbyWallet,
  ammAccount,
  assetType,
  lpTokenAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    const ammData = await getAmmInfo(ammAccount);
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
      ? { currency: "XRP" }
      : { currency: asset.currency, issuer: asset.issuer };
    const otherAssetObj = otherAsset.isXRP
      ? { currency: "XRP" }
      : { currency: otherAsset.currency, issuer: otherAsset.issuer };

    const amountObj = asset.isXRP
      ? xrpl.xrpToDrops(expectedAmount.toFixed(6))
      : {
          currency: asset.currency,
          issuer: asset.issuer,
          value: expectedAmount.toFixed(6),
        };

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
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
    preparedTx.LastLedgerSequence = currentLedger + 50;
    const signedTx = standbyWallet.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult !== "tesSUCCESS") {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }

    const fee = new BigNumber(response.result.tx_json?.Fee);
    const nodes = response.result.meta.AffectedNodes;
    let actualWithdrawn = null;
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
          const diffXRP = finalBal
            .minus(prevBal)
            .dividedBy(1_000_000)
            .toFixed(6);
          actualWithdrawn = { currency: "XRP", value: diffXRP };
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
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        message += "\n===== Updated AMM Pool State =====\n";
        message += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          message += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          message += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        message += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      message += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      message,
      receivedAmount: actualWithdrawn
        ? actualWithdrawn.value
        : expectedAmount.toFixed(6),
      currency: asset.currency,
      issuer: asset.issuer || null,
      lpTokensUsed: lpTokensUsed,
      tx_hash: response.result.hash,
      tx_result: response.result.meta.TransactionResult,
    };
  } catch (error) {
    console.error(
      "❌ Error withdrawing single asset with LP token:",
      error.message,
    );
    throw error;
  }
}
