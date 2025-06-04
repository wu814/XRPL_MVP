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

// Two-asset withdraw - withdraw both assets specifying minimum amounts
export async function withdrawLiquidityTwoAsset(
  standbyWallet,
  ammAccount,
  minWithdrawalA,
  minWithdrawalB,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    console.log(`🔍 Getting AMM data for account: ${ammAccount}`);
    const ammData = await getAmmInfo(ammAccount);

    console.log(`🔍 AMM Data received:`, JSON.stringify(ammData, null, 2));

    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }

    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(
        `❌ Error: Invalid AMM data structure - missing asset information`,
      );
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }

    const assetA = normalizeAsset(ammData.amount);
    const assetB = normalizeAsset(ammData.amount2);

    // Add better validation and logging for asset objects
    console.log(`Asset A details:`, JSON.stringify(assetA, null, 2));
    console.log(`Asset B details:`, JSON.stringify(assetB, null, 2));

    if (!assetA.currency || !assetB.currency) {
      console.error(
        `❌ Error: Missing currency information for one or both assets`,
      );
      return false;
    }

    // Log detection of asset types to help debug
    console.log(
      `🔍 Detected asset types: Asset A = ${assetA.isXRP ? "XRP" : assetA.currency}, Asset B = ${assetB.isXRP ? "XRP" : assetB.currency}`,
    );

    // Verify that we have valid LP token data
    if (!ammData.lp_token) {
      console.error(
        `❌ Error: Invalid AMM data structure - missing LP token information`,
      );
      return false;
    }

    const lpToken = ammData.lp_token;

    console.log(
      `✅ Withdrawing liquidity from AMM at ${ammAccount} with minimum amounts: ${assetA.currency}=${minWithdrawalA}, ${assetB.currency}=${minWithdrawalB}`,
    );

    // Convert pool and desired amounts to BigNumber with 6 decimals (round down).
    const totalPoolA = new BigNumber(assetA.value || 0);
    const totalPoolB = new BigNumber(assetB.value || 0);
    const totalLP = new BigNumber(lpToken.value || 0);

    // Store original input amounts for return values
    const originalMinA = minWithdrawalA;
    const originalMinB = minWithdrawalB;

    // Define desiredA and desiredB variables that will be used by both paths
    let desiredA = new BigNumber(minWithdrawalA).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    let desiredB = new BigNumber(minWithdrawalB).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );
    let requiredLP = "0";

    // Check if we're dealing with a minimal withdrawal
    const isMinimalWithdrawal =
      new BigNumber(minWithdrawalA).isLessThanOrEqualTo(2) &&
      new BigNumber(minWithdrawalB).isLessThanOrEqualTo(2);

    // For minimal withdrawals, calculate exact proportional LP tokens needed
    if (isMinimalWithdrawal) {
      console.log(
        `ℹ️ Detected minimal withdrawal amounts (${minWithdrawalA}, ${minWithdrawalB})`,
      );

      // Calculate the exact proportion of the pool being withdrawn
      const poolARatio = desiredA.dividedBy(totalPoolA);
      const poolBRatio = desiredB.dividedBy(totalPoolB);

      // Use the larger ratio to ensure both minimum amounts are met
      const withdrawalRatio = BigNumber.max(poolARatio, poolBRatio);

      // Calculate LP tokens needed - with minimal buffer (1%)
      const proportionalLPAmount = totalLP
        .multipliedBy(withdrawalRatio)
        .multipliedBy(1.01)
        .decimalPlaces(6, BigNumber.ROUND_UP);

      // For transparency, display exactly what's happening
      console.log(`🧮 Withdrawal calculation:`);
      console.log(
        `   • You are withdrawing ${desiredA.toFixed(6)} ${assetA.currency} of ${totalPoolA.toFixed(6)} total (${poolARatio.multipliedBy(100).toFixed(4)}%)`,
      );
      console.log(
        `   • You are withdrawing ${desiredB.toFixed(6)} ${assetB.currency} of ${totalPoolB.toFixed(6)} total (${poolBRatio.multipliedBy(100).toFixed(4)}%)`,
      );
      console.log(
        `   • Using the larger percentage: ${withdrawalRatio.multipliedBy(100).toFixed(4)}%`,
      );
      console.log(
        `   • ${withdrawalRatio.multipliedBy(100).toFixed(4)}% of ${totalLP.toFixed(6)} LP tokens = ${totalLP.multipliedBy(withdrawalRatio).toFixed(6)}`,
      );
      console.log(
        `   • Adding 1% buffer for slippage = ${proportionalLPAmount.toFixed(6)}`,
      );

      // Use this exact LP token amount directly
      requiredLP = proportionalLPAmount.toFixed(6);

      console.log(
        `🔹 Using ${requiredLP} LP tokens for withdrawal (${withdrawalRatio.multipliedBy(100).toFixed(2)}% of pool + 1% buffer)`,
      );
    } else {
      // Calculate the required LP tokens to redeem:
      // requiredLP_A = (desiredA * totalLP) / totalPoolA
      // requiredLP_B = (desiredB * totalLP) / totalPoolB
      // Use the maximum so that both minimums are met.
      // Add validation to prevent NaN values
      let requiredLP_A = new BigNumber(0);
      let requiredLP_B = new BigNumber(0);

      try {
        if (!totalPoolA.isZero() && !totalLP.isZero()) {
          requiredLP_A = desiredA.multipliedBy(totalLP).dividedBy(totalPoolA);
          console.log(
            `Calculated LP tokens from Asset A: ${requiredLP_A.toFixed(6)}`,
          );
        }

        if (!totalPoolB.isZero() && !totalLP.isZero()) {
          requiredLP_B = desiredB.multipliedBy(totalLP).dividedBy(totalPoolB);
          console.log(
            `Calculated LP tokens from Asset B: ${requiredLP_B.toFixed(6)}`,
          );
        }

        // Check if any value is NaN or infinity
        if (
          requiredLP_A.isNaN() ||
          requiredLP_A.isNegative() ||
          !requiredLP_A.isFinite()
        ) {
          console.warn(
            `⚠️ Invalid requiredLP_A value, using fallback calculation`,
          );
          requiredLP_A = new BigNumber(0);
        }

        if (
          requiredLP_B.isNaN() ||
          requiredLP_B.isNegative() ||
          !requiredLP_B.isFinite()
        ) {
          console.warn(
            `⚠️ Invalid requiredLP_B value, using fallback calculation`,
          );
          requiredLP_B = new BigNumber(0);
        }

        // Use maximum of the two values that are valid
        if (requiredLP_A.isZero() && requiredLP_B.isZero()) {
          // If both are zero, use a small default value (0.1% of total LP tokens)
          requiredLP = totalLP
            .multipliedBy(0.001)
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed(6);
          console.warn(
            `⚠️ Both LP token calculations resulted in zero, using 0.1% of total LP supply: ${requiredLP}`,
          );
        } else if (requiredLP_A.isZero()) {
          requiredLP = requiredLP_B
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed(6);
        } else if (requiredLP_B.isZero()) {
          requiredLP = requiredLP_A
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed(6);
        } else {
          requiredLP = BigNumber.maximum(requiredLP_A, requiredLP_B)
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed(6);
        }

        // If the calculated LP token amount is unreasonably high compared to the minimum withdrawal amounts,
        // it probably means we're dealing with a small withdrawal from a large pool
        if (
          new BigNumber(requiredLP).isGreaterThan(totalLP.multipliedBy(0.01))
        ) {
          console.log(
            `⚠️ Calculated LP token amount (${requiredLP}) seems high compared to totalLP (${totalLP.toString()})`,
          );
          console.log(`⚠️ Restricting to a maximum of 1% of total LP tokens`);
          requiredLP = totalLP
            .multipliedBy(0.01)
            .decimalPlaces(6, BigNumber.ROUND_DOWN)
            .toFixed(6);
        }
      } catch (err) {
        // Fallback in case of any calculation error
        console.error(
          `❌ Error calculating required LP tokens: ${err.message}`,
        );
        requiredLP = totalLP
          .multipliedBy(0.001)
          .decimalPlaces(6, BigNumber.ROUND_DOWN)
          .toFixed(6);
        console.warn(
          `⚠️ Using fallback LP token amount of 0.1% of total LP supply: ${requiredLP}`,
        );
      }

      console.log(`🔹 Calculated required LP tokens to redeem: ${requiredLP}`);
    }

    // Create assets with special handling for XRP
    let assetObjA, assetObjB, amountObjA, amountObjB;

    // Handle Asset A
    if (assetA.isXRP) {
      console.log(`Asset A is XRP`);
      assetObjA = "XRP";
      amountObjA = xrpl.xrpToDrops(desiredA.toFixed(6));
    } else {
      console.log(`Asset A is token ${assetA.currency}`);
      assetObjA = {
        currency: assetA.currency,
        issuer: assetA.issuer,
      };
      amountObjA = {
        currency: assetA.currency,
        issuer: assetA.issuer,
        value: desiredA.toFixed(6),
      };
    }

    // Handle Asset B
    if (assetB.isXRP) {
      console.log(`Asset B is XRP`);
      assetObjB = "XRP";
      amountObjB = xrpl.xrpToDrops(desiredB.toFixed(6));
    } else {
      console.log(`Asset B is token ${assetB.currency}`);
      assetObjB = {
        currency: assetB.currency,
        issuer: assetB.issuer,
      };
      amountObjB = {
        currency: assetB.currency,
        issuer: assetB.issuer,
        value: desiredB.toFixed(6),
      };
    }

    // Additional validation before constructing transaction
    if (!assetObjA) {
      throw new Error("Asset A object is undefined or null");
    }
    if (!assetObjB) {
      throw new Error("Asset B object is undefined or null");
    }

    console.log(`Final Asset Objects:`);
    console.log(`Asset A:`, JSON.stringify(assetObjA, null, 2));
    console.log(`Asset B:`, JSON.stringify(assetObjB, null, 2));

    // Add debugging
    console.log("🔍 Asset Object A:", JSON.stringify(assetObjA, null, 2));
    console.log("🔍 Asset Object B:", JSON.stringify(assetObjB, null, 2));

    // Build the AMMWithdraw transaction.
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset:
        assetObjA === "XRP"
          ? { currency: "XRP" }
          : { currency: assetA.currency, issuer: assetA.issuer },
      Asset2:
        assetObjB === "XRP"
          ? { currency: "XRP" }
          : { currency: assetB.currency, issuer: assetB.issuer },
      Amount: amountObjA,
      Amount2: amountObjB,
      // Use the tfTwoAsset flag (0x00100000 = 1048576) to indicate a two-asset withdrawal.
      Flags: 1048576,
      AMMAccount: ammAccount,
    };

    console.log("📜 Preparing AMMWithdraw transaction...");
    console.log(
      "📜 Transaction details:",
      JSON.stringify(ammWithdrawTx, null, 2),
    );

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;

    const preparedTx = await client.autofill(ammWithdrawTx);
    preparedTx.LastLedgerSequence = currentLedger + 50;

    console.log(
      "📜 Prepared AMMWithdraw transaction:",
      JSON.stringify(preparedTx, null, 2),
    );

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting liquidity withdrawal...");

    const response = await client.submitAndWait(signedTx.tx_blob);

    const fee = new BigNumber(response.result.tx_json?.Fee || 0);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      // Format LP token amount with proper precision
      const formattedLP = new BigNumber(requiredLP).toFixed(6);
      const lpUnit = formattedLP === "1.000000" ? "LP token" : "LP tokens";
      console.log(
        `✅ Liquidity withdrawn successfully! Redeemed ${formattedLP} ${lpUnit}.`,
      );

      // Extract the actual amounts withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawnA = null;
      let actualWithdrawnB = null;

      // Find the RippleState nodes that reflect the change in balances for tokens
      // and AccountRoot changes for XRP
      for (const node of nodes) {
        // Check for token changes (RippleState)
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
            // Check for Asset A (if it's a token)
            if (
              !actualWithdrawnA &&
              typeof assetA === "object" &&
              state.FinalFields.Balance.currency === assetA.currency
            ) {
              // Calculate the change in balance
              const prevBalance = parseFloat(
                state.PreviousFields.Balance.value,
              );
              const finalBalance = parseFloat(state.FinalFields.Balance.value);

              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnA = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6),
                };
              }
            }

            // Check for Asset B (if it's a token)
            if (
              !actualWithdrawnB &&
              typeof assetB === "object" &&
              state.FinalFields.Balance.currency === assetB.currency
            ) {
              // Calculate the change in balance
              const prevBalance = parseFloat(
                state.PreviousFields.Balance.value,
              );
              const finalBalance = parseFloat(state.FinalFields.Balance.value);

              // If the balance decreased (became more negative), that's what was withdrawn
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawnB = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6),
                };
              }
            }
          }
        }

        // Check for XRP changes (AccountRoot)
        else if (
          node.ModifiedNode &&
          node.ModifiedNode.LedgerEntryType === "AccountRoot"
        ) {
          const state = node.ModifiedNode;
          if (
            state.FinalFields &&
            state.PreviousFields &&
            state.FinalFields.Account === standbyWallet.classicAddress
          ) {
            // Check if this is the wallet's XRP balance change
            if (state.FinalFields.Balance && state.PreviousFields.Balance) {
              const prevBalance = new BigNumber(state.PreviousFields.Balance);
              const finalBalance = new BigNumber(state.FinalFields.Balance);

              // If the balance increased, that's XRP being withdrawn from AMM
              if (finalBalance.isGreaterThan(prevBalance)) {
                const xrpDiff = finalBalance.minus(prevBalance).minus(fee);
                const xrpAmount = xrpDiff.dividedBy(1000000).toFixed(6); // Convert drops to XRP

                // Check if this is Asset A or Asset B
                if (assetA.isXRP && !actualWithdrawnA) {
                  actualWithdrawnA = {
                    currency: "XRP",
                    value: xrpAmount,
                  };
                } else if (assetB.isXRP && !actualWithdrawnB) {
                  actualWithdrawnB = {
                    currency: "XRP",
                    value: xrpAmount,
                  };
                }
              }
            }
          }
        }
      }

      let output = "\n===== Transaction Summary =====\n";
      output += `🔹 Transaction Hash: ${response.result.hash}\n\n`;

      output += `📤 Withdrawn Amounts:\n`;

      if (actualWithdrawnA) {
        output += `   ${actualWithdrawnA.value} ${actualWithdrawnA.currency}\n`;
        output += `   (Minimum requested: ${originalMinA.toString()} ${assetA.currency})\n`;
      } else {
        output += `   At least ${originalMinA.toString()} ${assetA.currency}\n`;
      }

      if (actualWithdrawnB) {
        output += `   ${actualWithdrawnB.value} ${actualWithdrawnB.currency}\n`;
        output += `   (Minimum requested: ${originalMinB.toString()} ${assetB.currency})\n`;
      } else {
        output += `   At least ${originalMinB.toString()} ${assetB.currency}\n`;
      }

      if (response.result.tx_json?.Fee) {
        output += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
      }
      output += `\n🔄 LP Tokens Redeemed: ${formattedLP}\n`;

      // Refresh the AMM data after the operation completes
      console.log("🔄 Updating AMM data from ledger...");
      try {
        // Get the updated AMM data
        const updatedAmmData = await getAmmInfo(ammAccount);

        if (updatedAmmData) {
          // Log updated pool balances
          output += "\n===== Updated AMM Pool State =====\n";
          output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
          if (assetA.isXRP) {
            output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
            output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
          } else if (assetB.isXRP) {
            output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
            output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
          } else {
            output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
            output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
          }
        } else {
          output += "⚠️ Could not retrieve updated AMM data\n";
        }
      } catch (updateError) {
        output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
      }

      return {
        success: true,
        output,
        receivedAmountA: actualWithdrawnA
          ? actualWithdrawnA.value
          : originalMinA.toString(),
        receivedAmountB: actualWithdrawnB
          ? actualWithdrawnB.value
          : originalMinB.toString(),
        currencyA: assetA.currency,
        currencyB: assetB.currency,
        issuerA: assetA.issuer,
        issuerB: assetB.issuer,
        lpTokensRedeemed: requiredLP,
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
      };
    } else {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error withdrawing liquidity:", error.message);
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
            .minus(fee)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP };
        }
      }
    }

    let output = `\n===== Transaction Summary =====\n`;
    output += `🔹 Transaction Hash: ${response.result.hash}\n`;
    output += `\n📤 Withdrawn Amounts:\n`;
    output += `   ${actualWithdrawnA?.value ?? `~${expectedA.toFixed(6)}`} ${assetA.currency}\n`;
    output += `   ${actualWithdrawnB?.value ?? `~${expectedB.toFixed(6)}`} ${assetB.currency}\n`;
    output += `\n🔄 LP Tokens Redeemed: ${lpAmount.toFixed(6)}\n`;
    output += `💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;

    try {
      // Get the updated AMM data
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        output += "\n===== Updated AMM Pool State =====\n";
        output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        output += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      output,
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
            .minus(fee)
            .dividedBy(1_000_000)
            .toFixed(6);
          if (assetA.isXRP && !actualWithdrawnA)
            actualWithdrawnA = { currency: "XRP", value: diffXRP };
          else if (assetB.isXRP && !actualWithdrawnB)
            actualWithdrawnB = { currency: "XRP", value: diffXRP };
        }
      }
    }

    // Format output for the transaction summary
    let output = `\n===== Transaction Summary =====\n`;
    output += `🔹 Transaction Hash: ${response.result.hash}\n`;
    output += `\n📤 Withdrawn Amounts:\n`;
    output += `   ${actualWithdrawnA?.value ?? `~${new BigNumber(assetA.value).toFixed(6)}`} ${assetA.currency}\n`;
    output += `   ${actualWithdrawnB?.value ?? `~${new BigNumber(assetB.value).toFixed(6)}`} ${assetB.currency}\n`;
    output += `\n🔄 All LP tokens redeemed (${lpBalance} LP tokens)\n`;
    output += `💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;

    // Refresh and log updated AMM pool state
    try {
      const updatedAmmData = await getAmmInfo(ammAccount);
      if (updatedAmmData) {
        output += "\n===== Updated AMM Pool State =====\n";
        output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        output += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      output,
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
            .minus(fee)
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
    let output = "\n===== Transaction Summary =====\n";
    output += `🔹 Transaction Hash: ${response.result.hash}\n`;

    if (actualWithdrawn) {
      output += `\n📤 Actual amount withdrawn:\n   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n   (You requested: ${withdrawAmount} ${asset.currency})\n`;
    } else {
      output += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n   Requested: ${withdrawAmount} ${asset.currency}\n`;
    }
    output += `\n🔄 LP Tokens Redeemed: ${lpTokensUsed}\n`;

    if (response.result.tx_json?.Fee) {
      output += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
    }

    // Update AMM state
    console.log("🔄 Updating AMM data from ledger...");
    try {
      // Get the updated AMM data
      const updatedAmmData = await getAmmInfo(ammAccount);

      if (updatedAmmData) {
        // Log updated pool balances
        output += "\n===== Updated AMM Pool State =====\n";
        output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
        if (assetA.isXRP) {
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount)).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        } else if (assetB.isXRP) {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${xrpl.dropsToXrp(Number(updatedAmmData.amount2)).toFixed(8)} ${assetB.currency}\n`;
        } else {
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} ${assetA.currency}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} ${assetB.currency}\n`;
        }
      } else {
        output += "⚠️ Could not retrieve updated AMM data\n";
      }
    } catch (updateError) {
      output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
    }

    return {
      success: true,
      output,
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

// Single asset withdraw all - withdraw one asset by redeeming all LP tokens
export async function withdrawAllSingleAsset(
  standbyWallet,
  ammAccount,
  assetType,
  desiredAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }

    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(
        `❌ Error: Invalid AMM data structure - missing asset information`,
      );
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }

    let asset;
    let otherAsset;
    if (assetType === "XRP") {
      asset =
        typeof ammData.amount === "string" ? ammData.amount : ammData.amount2;
      otherAsset =
        typeof ammData.amount === "string" ? ammData.amount2 : ammData.amount;
    } else {
      asset =
        assetType === ammData.amount.currency
          ? ammData.amount
          : ammData.amount2;
      otherAsset =
        assetType === ammData.amount.currency
          ? ammData.amount2
          : ammData.amount;
    }
    const lpToken = ammData.lp_token;

    console.log(
      `✅ Withdrawing all of ${asset.currency} from AMM at ${ammAccount}`,
    );

    // Convert desired amount to BigNumber with 6 decimals precision
    // If desiredAmount is null, this is a true withdraw-all operation
    let amount_BN, withdrawObj;

    if (desiredAmount === null) {
      // True withdraw-all - set amount to 0 as per XRPL docs
      console.log(`--- True Withdraw All Information ---`);
      console.log(`Asset to withdraw: ${asset.currency}`);
      console.log(
        `Operation: Withdraw ALL LP tokens for maximum ${asset.currency}`,
      );
      console.log(
        `\nℹ️ Note: Withdraw All will redeem ALL your LP tokens for the maximum available amount of ${asset.currency}.`,
      );
      console.log(`   Setting Amount to 0 as per XRPL protocol requirements.`);

      // For true withdraw-all, set amount to 0 (minimum to succeed)
      if (asset.currency === "XRP") {
        withdrawObj = "0"; // 0 drops for XRP
      } else {
        withdrawObj = {
          currency: asset.currency,
          issuer: asset.issuer,
          value: "0",
        };
      }
      amount_BN = new BigNumber("0");
    } else {
      // Legacy mode with specified amount
      amount_BN = new BigNumber(desiredAmount).decimalPlaces(
        6,
        BigNumber.ROUND_DOWN,
      );

      // Check for sane minimum
      const minAmount = new BigNumber("0.000001");
      if (amount_BN.lt(minAmount)) {
        console.log(
          `❌ Warning: Minimum amount is too small. Using ${minAmount.toFixed(6)} instead.`,
        );
        amount_BN = minAmount;
      }

      // Create withdrawal object
      if (asset.currency === "XRP") {
        withdrawObj = xrpl.xrpToDrops(amount_BN.toFixed(6));
      } else {
        withdrawObj = {
          currency: asset.currency,
          issuer: asset.issuer,
          value: amount_BN.toFixed(6),
        };
      }

      console.log(`--- Withdrawal Information ---`);
      console.log(`Asset to withdraw: ${asset.currency}`);
      console.log(`Requested amount: ${desiredAmount} ${asset.currency}`);
      console.log(
        `\nℹ️ Note: Withdraw All will redeem ALL your LP tokens for the maximum available amount of ${asset.currency}.`,
      );
      console.log(
        `   The requested amount is used as a minimum threshold, but you may receive more.`,
      );
      console.log(
        `   This is particularly useful when you want to exit a position entirely.`,
      );
    }

    // Create asset objects with special handling for XRP
    // Both Asset and Asset2 are required to identify the AMM pool, even for single asset withdrawals
    let assetObj, otherAssetObj;

    if (asset.currency === "XRP") {
      assetObj = { currency: "XRP" };
    } else {
      assetObj = {
        currency: asset.currency,
        issuer: asset.issuer,
      };
    }

    // Handle other asset (also required to identify the AMM pool)
    if (otherAsset.currency === "XRP") {
      otherAssetObj = { currency: "XRP" };
    } else {
      otherAssetObj = {
        currency: otherAsset.currency,
        issuer: otherAsset.issuer,
      };
    }

    // DEBUG: Log the asset objects to see what we have
    console.log("🔍 DEBUG - Asset objects created:");
    console.log("   assetObj:", JSON.stringify(assetObj, null, 2));
    console.log("   otherAssetObj:", JSON.stringify(otherAssetObj, null, 2));
    console.log("   asset.currency:", asset.currency);
    console.log("   otherAsset.currency:", otherAsset.currency);

    // Build the AMMWithdraw transaction
    // Both Asset and Asset2 are required to identify the AMM pool
    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      Asset: assetObj, // The asset we want to withdraw
      Asset2: otherAssetObj, // The other asset in the pool (required to identify AMM)
      Amount: withdrawObj, // Always include Amount field (0 for true withdraw-all)
      // Use only tfOneAssetWithdrawAll (0x00040000 = 262144)
      Flags: 262144,
      AMMAccount: ammAccount,
    };

    console.log("📜 Preparing Single Asset Withdraw All transaction...");
    console.log(
      "Transaction BEFORE autofill:",
      JSON.stringify(ammWithdrawTx, null, 4),
    );

    // Autofill the transaction (Fee, Sequence, etc.)
    const preparedTx = await client.autofill(ammWithdrawTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang - increased buffer for timing
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50; // Increased from 10 to 50

    console.log(
      "📜 Prepared transaction AFTER autofill:",
      JSON.stringify(preparedTx, null, 4),
    );

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset withdraw all transaction...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Single asset withdraw all successful!");

      // Extract the actual amount withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawn = null;

      // Find the RippleState node that reflects the change in the withdrawn currency balance
      for (const node of nodes) {
        if (
          node.ModifiedNode &&
          node.ModifiedNode.LedgerEntryType === "RippleState"
        ) {
          const state = node.ModifiedNode;
          if (
            state.FinalFields &&
            state.PreviousFields &&
            state.FinalFields.Balance &&
            state.PreviousFields.Balance &&
            state.FinalFields.Balance.currency === asset.currency
          ) {
            // Calculate the change in balance
            const prevBalance = parseFloat(state.PreviousFields.Balance.value);
            const finalBalance = parseFloat(state.FinalFields.Balance.value);

            // If the balance decreased (became more negative), that's what was withdrawn
            const diff = Math.abs(finalBalance - prevBalance);
            if (diff > 0) {
              actualWithdrawn = {
                currency: state.FinalFields.Balance.currency,
                value: diff.toFixed(6),
              };
              break;
            }
          }
        }
      }

      let output = "";

      output += "\n===== Transaction Summary =====\n";
      output += `🔹 Transaction Hash: ${response.result.hash}\n`;

      if (actualWithdrawn) {
        output += `\n📤 Actual amount withdrawn:\n`;
        output += `   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n`;

        if (desiredAmount) {
          output += `   (You requested: ${desiredAmount} ${asset.currency})\n`;

          if (parseFloat(actualWithdrawn.value) > parseFloat(desiredAmount)) {
            output += `\nℹ️ Note: You received more than requested because this was a withdraw-all operation\n`;
            output += `   which redeems all your LP tokens for the selected asset.\n`;
          }
        } else {
          output += `   (True withdraw-all operation - no minimum specified)\n`;
        }
      } else {
        output += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n`;

        if (desiredAmount) {
          output += `   Requested: ${desiredAmount} ${asset.currency}\n`;
        } else {
          output += `   True withdraw-all operation completed\n`;
        }

        if (response.result.tx_json?.Fee) {
          output += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
        }
      }

      // Refresh the AMM data after the operation completes
      console.log("🔄 Updating AMM data from ledger...");
      try {
        // Get the updated AMM data
        const updatedAmmData = await getAmmInfo(ammAccount);

        if (updatedAmmData) {
          // Log updated pool balances
          output += "\n===== Updated AMM Pool State =====\n";
          output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} (${updatedAmmData.amount.currency})\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} (${updatedAmmData.amount2.currency})\n`;
        } else {
          output += "⚠️ Could not retrieve updated AMM data\n";
        }
      } catch (updateError) {
        output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
      }

      // Return more detailed information for operational wallet handling
      return {
        success: true,
        output,
        receivedAmount: actualWithdrawn
          ? actualWithdrawn.value
          : desiredAmount
            ? desiredAmount.toFixed(6)
            : "0",
        currency: asset.currency,
        issuer: asset.issuer || null, // null for XRP
        minimumAmount: desiredAmount ? amount_BN.toFixed(6) : "0",
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
      };
    } else {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error("❌ Error withdrawing all single asset:", error.message);
    throw error;
  }
}

// Single asset withdraw with LP token amount
export async function withdrawSingleAssetWithLPToken(
  standbyWallet,
  ammAccount,
  assetType,
  lpTokenAmount,
  operationalWalletInfo = null,
) {
  try {
    await connectXrplClient();
    // Fix: Pass ammAccount as the first parameter to query by AMM account directly
    const ammData = await getAmmInfo(ammAccount);
    if (!ammData) {
      console.error(`❌ Error: AMM data not found for account ${ammAccount}`);
      return false;
    }

    // Verify that amount and amount2 exist in the AMM data
    if (!ammData.amount || !ammData.amount2) {
      console.error(
        `❌ Error: Invalid AMM data structure - missing asset information`,
      );
      console.log("AMM Data received:", JSON.stringify(ammData, null, 2));
      return false;
    }

    let asset;
    let otherAsset;
    if (assetType === "XRP") {
      asset =
        typeof ammData.amount === "string" ? ammData.amount : ammData.amount2;
      otherAsset =
        typeof ammData.amount === "string" ? ammData.amount2 : ammData.amount;
    } else {
      asset =
        assetType === ammData.amount.currency
          ? ammData.amount
          : ammData.amount2;
      otherAsset =
        assetType === ammData.amount.currency
          ? ammData.amount2
          : ammData.amount;
    }
    const lpToken = ammData.lp_token;

    console.log(
      `✅ Withdrawing specific LP amount as single asset (${asset.currency})`,
    );

    // Convert to BigNumber with 6 decimals precision
    const lpAmount = new BigNumber(lpTokenAmount).decimalPlaces(
      6,
      BigNumber.ROUND_DOWN,
    );

    // Calculate expected withdrawal amount (estimation)
    const totalPoolAsset = new BigNumber(
      assetType === "A" ? ammData.amount.value : ammData.amount2.value,
    );
    const totalLP = new BigNumber(lpToken.value);

    const expectedAmount = lpAmount
      .multipliedBy(totalPoolAsset)
      .dividedBy(totalLP)
      .decimalPlaces(6, BigNumber.ROUND_DOWN);

    // Create assets with special handling for XRP
    let assetObj, otherAssetObj, amountObj;

    // Handle primary asset (the one being withdrawn)
    if (typeof asset === "string" || asset.currency === "XRP") {
      assetObj = { currency: "XRP" };
      // Convert XRP to drops for the blockchain transaction
      amountObj = xrpl.xrpToDrops(expectedAmount.toFixed(6));
      console.log(
        `🔹 Converting ${expectedAmount.toFixed(6)} XRP to ${amountObj} drops for blockchain transaction`,
      );
    } else {
      assetObj = {
        currency: asset.currency,
        issuer: asset.issuer,
      };
      amountObj = {
        currency: asset.currency,
        issuer: asset.issuer,
        value: expectedAmount.toFixed(6),
      };
    }

    // Handle other asset
    if (typeof otherAsset === "string" || otherAsset.currency === "XRP") {
      otherAssetObj = { currency: "XRP" };
    } else {
      otherAssetObj = {
        currency: otherAsset.currency,
        issuer: otherAsset.issuer,
      };
    }

    const ammWithdrawTx = {
      TransactionType: "AMMWithdraw",
      Account: standbyWallet.classicAddress,
      // Use the correct asset as the primary asset (the one we want to withdraw)
      Asset: asset.currency === "XRP" ? { currency: "XRP" } : assetObj,
      Asset2:
        otherAsset.currency === "XRP" ? { currency: "XRP" } : otherAssetObj,
      Amount: amountObj,
      LPTokenIn: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpAmount.toFixed(6),
      },
      // Use tfOneAssetLPToken (0x00200000)
      Flags: 2097152,
      AMMAccount: ammAccount,
    };

    console.log("📜 Preparing Single Asset LP Token withdrawal transaction...");
    console.log("Transaction:", JSON.stringify(ammWithdrawTx, null, 4));

    const preparedTx = await client.autofill(ammWithdrawTx);

    // Set LastLedgerSequence to ensure transaction doesn't hang
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    preparedTx.LastLedgerSequence = currentLedger + 50;

    const signedTx = standbyWallet.sign(preparedTx);
    console.log("🚀 Submitting single asset LP token withdrawal...");
    const response = await client.submitAndWait(signedTx.tx_blob);

    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Single asset withdraw with LP token successful!");

      // Extract the actual amount withdrawn from the transaction metadata
      const nodes = response.result.meta.AffectedNodes;
      let actualWithdrawn = null;

      // Find the RippleState node that shows the change in the wallet's balance for the withdrawn asset
      for (const node of nodes) {
        if (
          node.ModifiedNode &&
          node.ModifiedNode.LedgerEntryType === "RippleState"
        ) {
          const state = node.ModifiedNode;
          if (
            state.FinalFields &&
            state.PreviousFields &&
            state.FinalFields.Balance &&
            state.PreviousFields.Balance &&
            typeof state.FinalFields.Balance === "object" &&
            typeof state.PreviousFields.Balance === "object"
          ) {
            // Check if this RippleState involves our wallet and the asset we're withdrawing
            const isOurWallet =
              (state.FinalFields.HighLimit &&
                state.FinalFields.HighLimit.issuer ===
                  standbyWallet.classicAddress) ||
              (state.FinalFields.LowLimit &&
                state.FinalFields.LowLimit.issuer ===
                  standbyWallet.classicAddress);

            // Check if this is for the asset we're withdrawing
            const isCorrectAsset =
              state.FinalFields.Balance.currency === asset.currency;

            if (isOurWallet && isCorrectAsset) {
              // Calculate the change in balance (withdrawal increases the absolute value of negative balance)
              const prevBalance = parseFloat(
                state.PreviousFields.Balance.value,
              );
              const finalBalance = parseFloat(state.FinalFields.Balance.value);

              // For withdrawals, the balance becomes more negative, so we calculate the absolute difference
              const diff = Math.abs(finalBalance - prevBalance);
              if (diff > 0) {
                actualWithdrawn = {
                  currency: state.FinalFields.Balance.currency,
                  value: diff.toFixed(6),
                };
                break;
              }
            }
          }
        }
      }

      let output = "";

      output += "\n===== Transaction Summary =====\n";
      output += `🔹 Transaction Hash: ${response.result.hash}\n`;

      if (actualWithdrawn) {
        output += `\n📤 Actual amount withdrawn:\n`;
        output += `   ${actualWithdrawn.value} ${actualWithdrawn.currency}\n`;
        output += `\n🔄 LP Tokens Used: ${lpTokenAmount}\n`;
        output += `\n📊 Expected amount: ${expectedAmount.toFixed(6)} ${asset.currency}\n`;

        const difference = Math.abs(
          parseFloat(actualWithdrawn.value) -
            parseFloat(expectedAmount.toFixed(6)),
        );

        output += `📊 Difference from estimate: ${difference.toFixed(6)} ${asset.currency}\n`;
      } else {
        output += `\n⚠️ Could not determine exact amount withdrawn from transaction metadata\n`;
        output += `\n🔄 LP Tokens Used: ${lpTokenAmount}\n`;
        output += `\n📊 Expected amount: ${expectedAmount.toFixed(6)} ${asset.currency}\n`;
      }

      if (response.result.tx_json?.Fee) {
        output += `\n💸 Transaction Cost: ${xrpl.dropsToXrp(response.result.tx_json?.Fee)} XRP\n`;
      }

      // Refresh the AMM data after the operation completes
      console.log("🔄 Updating AMM data from ledger...");
      try {
        // Get the updated AMM data
        const updatedAmmData = await getAmmInfo(ammAccount);

        if (updatedAmmData) {
          // Log updated pool balances
          output += "\n===== Updated AMM Pool State =====\n";
          output += `LP tokens balance: ${Number(updatedAmmData.lp_token.value).toFixed(2)}\n`;
          output += `Token balance: ${Number(updatedAmmData.amount.value).toFixed(8)} (${updatedAmmData.amount.currency})\n`;
          output += `Token balance: ${Number(updatedAmmData.amount2.value).toFixed(8)} (${updatedAmmData.amount2.currency})\n`;
        } else {
          output += "⚠️ Could not retrieve updated AMM data\n";
        }
      } catch (updateError) {
        output += `⚠️ Error refreshing AMM data: ${updateError.message}\n`;
      }

      // Return more detailed information for operational wallet handling
      return {
        success: true,
        output,
        receivedAmount: actualWithdrawn
          ? actualWithdrawn.value
          : expectedAmount.toFixed(6),
        currency: asset.currency,
        issuer: asset.issuer || null, // null for XRP
        lpTokensUsed: lpTokenAmount,
        tx_hash: response.result.hash,
        tx_result: response.result.meta.TransactionResult,
      };
    } else {
      throw new Error(
        `AMM withdrawal failed: ${response.result.meta.TransactionResult}`,
      );
    }
  } catch (error) {
    console.error(
      "❌ Error withdrawing single asset with LP token:",
      error.message,
    );
    throw error;
  }
}
