import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";
import { checkTrustline } from "@/utils/xrpl/wallet/setTrustline";
import BigNumber from "bignumber.js";

// Extract and display LP tokens received from transaction metadata
export async function extractLPTokensReceived(
  result,
  providerWallet,
  ammAccount,
) {
  try {
    // The LPTokenOut is in the AffectedNodes array
    let lpTokensReceived = null;
    const nodes = result.result.meta.AffectedNodes || [];

    console.log(`🔍 Searching for LP token changes in transaction metadata...`);
    console.log(`   AMM Account: ${ammAccount}`);
    console.log(`   User Account: ${providerWallet.classicAddress}`);

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
            console.log(
              `✅ Found LP token change in metadata: ${diff.toFixed(6)} ${balance.currency}`,
            );
            lpTokensReceived = {
              currency: balance.currency,
              issuer: ammAccount,
              value: diff.toFixed(6),
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
                value: value,
              };
              break;
            }
          }
        }
      }
    }

    if (lpTokensReceived) {
      console.log(
        `💰 LP Tokens received: ${lpTokensReceived.value} ${lpTokensReceived.currency}`,
      );
      return lpTokensReceived;
    } else {
      console.log(
        "⚠️ Could not determine exact LP tokens received from transaction metadata",
      );

      // As a fallback, get current LP token balance and report it
      try {
        // Get the latest LP token balance as a fallback
        const accountLines = await client.request({
          command: "account_lines",
          account: providerWallet.classicAddress,
          peer: ammAccount,
        });

        const lpTokens = accountLines.result.lines.find(
          (line) =>
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
            value: lpTokens.balance.toFixed(6),
          };
        } else {
          console.log("❌ Could not find any LP token balance");
        }
      } catch (error) {
        console.log(
          "❌ Error retrieving current LP token balance:",
          error.message,
        );
      }
    }
  } catch (err) {
    console.log("⚠️ Error extracting LP token information:", err.message);
    console.error(err);
  }
  return null;
}

// Extract the actual assets deposited from transaction metadata
const extractActualAssetsDeposited = (result) => {
  try {
    const nodes = result.result.meta.AffectedNodes || [];
    const assetsDeposited = [];
    // Track assets we've already added to avoid duplicates
    const addedAssets = new Set();

    // Get transaction sender address
    const senderAddress = result.result.Account;

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
          const issuer =
            lowAccount === senderAddress ? highAccount : lowAccount;
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
          const fee = parseInt(result.result.Fee) || 0;

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
  } catch (err) {
    console.log("⚠️ Error extracting assets deposited:", err.message);
  }

  return null;
};

// Display transaction details
const displayTransactionDetails = (
  result,
  lpTokensReceived,
  assetsDeposited,
) => {
  console.log("\n===== Transaction Details =====");

  // Display transaction hash and result
  console.log(`🔑 Transaction Hash: ${result.result.hash}`);
  console.log(`🎯 Result: ${result.result.meta.TransactionResult}`);

  // Display LP tokens received
  if (lpTokensReceived) {
    console.log(
      `\n📥 LP Tokens Received: ${lpTokensReceived.value} ${lpTokensReceived.currency}`,
    );
  }

  // Display assets deposited - group by currency
  if (assetsDeposited && assetsDeposited.length > 0) {
    console.log(`\n📤 ACTUAL Assets Deposited:`);

    // Group assets by currency
    const assetsByCurrency = {};

    assetsDeposited.forEach((asset) => {
      const key = asset.currency;
      if (!assetsByCurrency[key]) {
        assetsByCurrency[key] = [];
      }
      assetsByCurrency[key].push(asset);
    });

    // Display each currency group
    Object.entries(assetsByCurrency).forEach(([currency, assets]) => {
      // Calculate total for this currency
      const total = assets.reduce(
        (sum, asset) => sum + parseFloat(asset.value),
        0,
      );

      // Display total for this currency
      console.log(`   • ${total.toFixed(6)} ${currency}`);

      // If there are multiple assets with the same currency but different issuers,
      // show the breakdown
      if (assets.length > 1) {
        console.log(`     Breakdown:`);
        assets.forEach((asset) => {
          console.log(
            `     - ${asset.value} from issuer: ${asset.issuer || "Native XRP"}`,
          );
        });
      }
    });

    // Calculate and display the exchange rate for LP tokens
    if (lpTokensReceived && assetsDeposited.length === 1) {
      // For single asset deposits, show the exchange rate
      const assetDeposited = assetsDeposited[0];
      const lpAmount = parseFloat(lpTokensReceived.value);
      const assetAmount = parseFloat(assetDeposited.value);

      if (lpAmount > 0 && assetAmount > 0) {
        const assetPerLP = assetAmount / lpAmount;
        console.log(`\n📊 Exchange Rate:`);
        console.log(
          `   • ${assetPerLP.toFixed(6)} ${assetDeposited.currency} per LP Token`,
        );
        console.log(
          `   • ${(1 / assetPerLP).toFixed(6)} LP Tokens per ${assetDeposited.currency}`,
        );
      }
    } else if (lpTokensReceived && assetsDeposited.length === 2) {
      // For two asset deposits, show the total value contributed
      console.log(
        `\n📊 Assets Contributed for ${lpTokensReceived.value} LP Tokens:`,
      );
      Object.entries(assetsByCurrency).forEach(([currency, assets]) => {
        const total = assets.reduce(
          (sum, asset) => sum + parseFloat(asset.value),
          0,
        );
        console.log(`   • ${total.toFixed(6)} ${currency}`);
      });
    }
  } else {
    console.log(
      `\n⚠️ No assets were detected as deposited in the transaction metadata.`,
    );
    console.log(
      `   This might be due to limitations in metadata parsing or transaction structure.`,
    );
  }

  // Display transaction cost
  if (result.result.Fee) {
    console.log(
      `\n💸 Transaction Cost: ${xrpl.dropsToXrp(result.result.Fee)} XRP`,
    );
  }

  console.log("==============================\n");
};

// Double-asset deposit: tfTwoAsset (existing, but now with explicit flag)
export async function addLiquidityTwoAsset(
  providerWallet,
  ammAccount,
  assetAObj,
  assetBObj,
) {
  try {
    await connectXrplClient();

    console.log(`✅ Adding liquidity to AMM at ${ammAccount}`);
    console.log(
      `🔹 Asset A: ${assetAObj.currency} - Amount: ${assetAObj.value}`,
    );
    console.log(
      `🔹 Asset B: ${assetBObj.currency} - Amount: ${assetBObj.value}`,
    );

    // Check LP trustline
    // First get LP token information from the AMM
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });

    if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
      console.error("❌ Could not retrieve LP token information from AMM");
      return false;
    }

    const lpToken = ammInfoResponse.result.amm.lp_token;
    const lpTokenIssuer = ammAccount; // The LP token issuer is always the AMM account

    // Check if the wallet has a trustline for the LP token
    const hasLPTrustline = await checkTrustline(
      providerWallet,
      lpTokenIssuer,
      lpToken.currency,
    );
    if (!hasLPTrustline) {
      console.log(
        `❌ Trustline for LP token (${lpToken.currency}) with issuer (${lpTokenIssuer}) not found.`,
      );
      console.log(
        "Please set up the LP trustline first using the 'Setup LP Trustline' option.",
      );
      return false;
    }
    console.log(
      `✅ LP Trustline verified for ${providerWallet.classicAddress}`,
    );

    // Check balances for assets
    try {
      // Check Asset A balance
      if (assetAObj.currency !== "XRP") {
        // IOU balance check
        if (!assetAObj.issuer) {
          console.log(`❌ Issuer not specified for ${assetAObj.currency}`);
          return false;
        }

        console.log(`🔍 Checking ${assetAObj.currency} balance...`);
        const balanceResponseA = await client.request({
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

          console.log(
            `💰 Current ${assetAObj.currency} balance: ${balance.toFixed(6)}`,
          );
          console.log(
            `📊 Required ${assetAObj.currency} amount: ${depositAmount.toFixed(6)}`,
          );

          if (balance.lt(depositAmount)) {
            console.log(`❌ Insufficient ${assetAObj.currency} balance.`);
            return false;
          }
          console.log(`✅ Sufficient ${assetAObj.currency} balance confirmed.`);
        } else {
          console.log(
            `❌ No trustline found for ${assetAObj.currency} from ${assetAObj.issuer}`,
          );
          return false;
        }
      } else {
        // XRP balance check
        console.log(`🔍 Checking XRP balance...`);
        const accountInfoResponseA = await client.request({
          command: "account_info",
          account: providerWallet.classicAddress,
          ledger_index: "validated",
        });

        if (
          accountInfoResponseA.result &&
          accountInfoResponseA.result.account_data
        ) {
          const xrpBalance = xrpl.dropsToXrp(
            accountInfoResponseA.result.account_data.Balance,
          );
          const balance = new BigNumber(xrpBalance);
          const depositAmount = new BigNumber(assetAObj.value);
          const reserveXRP = new BigNumber(10); // Reserve requirement for the account

          console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
          console.log(
            `📊 Required XRP amount: ${depositAmount.toFixed(6)} + ${reserveXRP.toFixed()} reserve`,
          );

          if (balance.minus(reserveXRP).lt(depositAmount)) {
            console.log(
              `❌ Insufficient XRP balance. Need ${depositAmount.plus(reserveXRP).toFixed(6)}, have ${balance.toFixed(6)}`,
            );
            return false;
          }
          console.log(`✅ Sufficient XRP balance confirmed.`);
        } else {
          console.log("❌ Failed to retrieve account information");
          return false;
        }
      }

      // Check Asset B balance
      if (assetBObj.currency !== "XRP") {
        // IOU balance check
        if (!assetBObj.issuer) {
          console.log(`❌ Issuer not specified for ${assetBObj.currency}`);
          return false;
        }

        console.log(`🔍 Checking ${assetBObj.currency} balance...`);
        const balanceResponseB = await client.request({
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

          console.log(
            `💰 Current ${assetBObj.currency} balance: ${balance.toFixed(6)}`,
          );
          console.log(
            `📊 Required ${assetBObj.currency} amount: ${depositAmount.toFixed(6)}`,
          );

          if (balance.lt(depositAmount)) {
            console.log(`❌ Insufficient ${assetBObj.currency} balance.`);
            return false;
          }
          console.log(`✅ Sufficient ${assetBObj.currency} balance confirmed.`);
        } else {
          console.log(
            `❌ No trustline found for ${assetBObj.currency} from ${assetBObj.issuer}`,
          );
          return false;
        }
      } else {
        // XRP balance check (if not already checked above)
        if (assetAObj.currency !== "XRP") {
          console.log(`🔍 Checking XRP balance...`);
          const accountInfoResponseB = await client.request({
            command: "account_info",
            account: providerWallet.classicAddress,
            ledger_index: "validated",
          });

          if (
            accountInfoResponseB.result &&
            accountInfoResponseB.result.account_data
          ) {
            const xrpBalance = xrpl.dropsToXrp(
              accountInfoResponseB.result.account_data.Balance,
            );
            const balance = new BigNumber(xrpBalance);
            const depositAmount = new BigNumber(assetBObj.value);
            const reserveXRP = new BigNumber(10); // Reserve requirement for the account

            console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
            console.log(
              `📊 Required XRP amount: ${depositAmount.toFixed(6)} + ${reserveXRP.toFixed()} reserve`,
            );

            if (balance.minus(reserveXRP).lt(depositAmount)) {
              console.log(
                `❌ Insufficient XRP balance. Need ${depositAmount.plus(reserveXRP).toFixed(6)}, have ${balance.toFixed(6)}`,
              );
              return false;
            }
            console.log(`✅ Sufficient XRP balance confirmed.`);
          } else {
            console.log("❌ Failed to retrieve account information");
            return false;
          }
        }
        // If assetA was also XRP, we've already checked the balance above
        // and don't need to check again
      }
    } catch (error) {
      console.error(`❌ Error checking balances: ${error.message}`);
      return false;
    }

    // Prepare transaction with proper flags
    const tx = {
      TransactionType: "AMMDeposit",
      Account: providerWallet.classicAddress,
      AMMAccount: ammAccount,
      Flags: 0x00100000, // tfTwoAsset
    };

    // Asset A handling
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

    // Asset B handling
    if (assetBObj.currency === "XRP") {
      tx.Asset2 = { currency: "XRP" };
      tx.Amount2 = xrpl.xrpToDrops(assetBObj.value);
    } else {
      tx.Asset2 = {
        currency: assetBObj.currency,
        issuer: assetBObj.issuer,
      };
      tx.Amount2 = {
        currency: assetBObj.currency,
        issuer: assetBObj.issuer,
        value: assetBObj.value,
      };
    }

    console.log(
      "📃 Transaction fields:",
      JSON.stringify(
        {
          TransactionType: tx.TransactionType,
          Flags: tx.Flags,
          Asset: tx.Asset,
          Asset2: tx.Asset2,
          Amount: tx.Amount,
          Amount2: tx.Amount2,
          AMMAccount: tx.AMMAccount,
        },
        null,
        2,
      ),
    );

    try {
      // Autofill transaction fields (fee, sequence, etc.)
      console.log("🔄 Preparing transaction...");
      const prepared = await client.autofill(tx);

      // Sign the transaction
      console.log("✍️ Signing transaction...");
      const signed = providerWallet.sign(prepared);

      // Now submit and wait for validation
      console.log("⏳ Waiting for transaction validation...");
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        console.log("✅ Successfully added liquidity to AMM");

        // Extract and display LP tokens received
        const lpTokensReceived = await extractLPTokensReceived(
          result,
          providerWallet,
          ammAccount,
        );

        // Extract actual assets deposited
        const assetsDeposited = extractActualAssetsDeposited(result);

        // Display transaction details
        displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

        return true;
      } else {
        console.error(
          `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
        );
        if (result.result.meta.TransactionResult === "tecUNFUNDED_AMM") {
          console.log(
            "💡 The AMM needs to be funded with both assets first. Try using the 'Two Asset If Empty' option.",
          );
        } else if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
          console.log("💡 AMM failure. This could be due to:");
          console.log("- Invalid asset amounts or ratio");
          console.log("- Pool constraints not being met");
          console.log(
            "- Try with different amounts that better match the current pool ratio",
          );
        }
        return false;
      }
    } catch (error) {
      console.error(`❌ Transaction error: ${error.message}`);
      if (error.data && error.data.resultCode) {
        console.error(`Error code: ${error.data.resultCode}`);
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding liquidity: ${error.message}`);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return false;
  }
}

// Double-asset deposit: tfLPToken (deposit both assets, receive specified LP tokens)
export async function addLiquidityLPToken(
  providerWallet,
  ammAccount,
  assetAObj,
  assetBObj,
  lpTokenOut,
) {
  try {
    await connectXrplClient();
    console.log(`✅ Adding liquidity (LPToken) to AMM at ${ammAccount}`);
    console.log(
      `🔹 Asset A: ${assetAObj.currency} - Max Amount: ${assetAObj.value}`,
    );
    console.log(
      `🔹 Asset B: ${assetBObj.currency} - Max Amount: ${assetBObj.value}`,
    );
    console.log(`🔹 LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

    // Get LP token info
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });
    if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
      console.error("❌ Could not retrieve LP token information from AMM");
      return false;
    }
    const lpToken = ammInfoResponse.result.amm.lp_token;
    const lpTokenIssuer = ammAccount;

    // Check LP trustline
    const hasLPTrustline = await checkTrustline(
      providerWallet,
      lpTokenIssuer,
      lpToken.currency,
    );
    if (!hasLPTrustline) {
      console.log(
        `❌ Trustline for LP token (${lpToken.currency}) with issuer (${lpTokenIssuer}) not found.`,
      );
      console.log(
        "Please set up the LP trustline first using the 'Setup LP Trustline' option.",
      );
      return false;
    }

    // Check if user has sufficient balances for both assets
    // Asset A
    if (assetAObj.currency !== "XRP") {
      if (!assetAObj.issuer) {
        console.log(`❌ Issuer not specified for ${assetAObj.currency}`);
        return false;
      }
      const balanceResponseA = await client.request({
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
          console.log(
            `❌ Insufficient balance of ${assetAObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
          );
          return false;
        }
      } else {
        console.log(
          `❌ Cannot find balance information for ${assetAObj.currency}`,
        );
        return false;
      }
    } else {
      // XRP
      const accountInfoResponseA = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });
      if (
        accountInfoResponseA.result &&
        accountInfoResponseA.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponseA.result.account_data.Balance,
        );
        const balance = new BigNumber(xrpBalance);
        const depositBN = new BigNumber(assetAObj.value);
        const reserveXRP = new BigNumber(10);
        if (balance.minus(reserveXRP).lt(depositBN)) {
          console.log(
            `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)} + reserve`,
          );
          return false;
        }
      } else {
        console.log(`❌ Cannot find balance information for XRP`);
        return false;
      }
    }

    // Asset B
    if (assetBObj.currency !== "XRP") {
      if (!assetBObj.issuer) {
        console.log(`❌ Issuer not specified for ${assetBObj.currency}`);
        return false;
      }
      const balanceResponseB = await client.request({
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
          console.log(
            `❌ Insufficient balance of ${assetBObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
          );
          return false;
        }
      } else {
        console.log(
          `❌ Cannot find balance information for ${assetBObj.currency}`,
        );
        return false;
      }
    } else {
      // XRP
      const accountInfoResponse = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });
      if (
        accountInfoResponse.result &&
        accountInfoResponse.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponse.result.account_data.Balance,
        );
        const balance = new BigNumber(xrpBalance);
        const depositBN = new BigNumber(assetBObj.value);
        const reserveXRP = new BigNumber(10);
        if (balance.minus(reserveXRP).lt(depositBN)) {
          console.log(
            `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)} + reserve`,
          );
          return false;
        }
      } else {
        console.log(`❌ Cannot find balance information for XRP`);
        return false;
      }
    }

    // Check AMM pool status
    console.log("📊 Checking AMM pool status...");
    const poolInfo = ammInfoResponse.result.amm;
    if (!poolInfo) {
      console.error("❌ Could not retrieve AMM pool information");
      return false;
    }

    // Check if pool is empty
    const isPoolEmpty = poolInfo.amount === "0" || poolInfo.amount2 === "0";
    if (isPoolEmpty) {
      console.log(
        "⚠️ The AMM pool appears to be empty or nearly empty. Consider using the 'Two Asset If Empty' option instead.",
      );
      return false;
    }

    // When using the tfLPToken flag for the LPToken mode, according to the documentation,
    // we should specify:
    // 1. The Asset and Asset2 fields to identify the assets in the pool
    // 2. The LPTokenOut field for desired LP tokens
    // But NOT include the Amount and Amount2 fields
    const tx = {
      TransactionType: "AMMDeposit",
      Account: providerWallet.classicAddress,
      AMMAccount: ammAccount,
      Flags: 0x00010000, // tfLPToken flag
      LPTokenOut: {
        currency: lpTokenOut.currency,
        issuer: lpTokenOut.issuer,
        value: lpTokenOut.value,
      },
    };

    // Handle XRP assets specially
    if (assetAObj.currency === "XRP") {
      tx.Asset = { currency: "XRP" };
    } else {
      tx.Asset = {
        currency: assetAObj.currency,
        issuer: assetAObj.issuer,
      };
    }

    if (assetBObj.currency === "XRP") {
      tx.Asset2 = { currency: "XRP" };
    } else {
      tx.Asset2 = {
        currency: assetBObj.currency,
        issuer: assetBObj.issuer,
      };
    }

    // Extract and process current pool data for information only
    const asset1Amount =
      typeof poolInfo.amount === "object"
        ? parseFloat(poolInfo.amount.value)
        : parseFloat(xrpl.dropsToXrp(poolInfo.amount));

    const asset2Amount =
      typeof poolInfo.amount2 === "object"
        ? parseFloat(poolInfo.amount2.value)
        : parseFloat(xrpl.dropsToXrp(poolInfo.amount2));

    const lpTokenSupply = parseFloat(poolInfo.lp_token.value);

    // Calculate and display required amounts based on LP token ratio (for information only)
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

      // Check if maximum amounts are sufficient (for information only)
      const asset1Sufficient =
        parseFloat(assetAObj.value) >= requiredAsset1 * 1.01;
      const asset2Sufficient =
        parseFloat(assetBObj.value) >= requiredAsset2 * 1.01;

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

    try {
      const prepared = await client.autofill(tx);
      console.log("🔄 Transaction prepared, signing...");
      const signed = providerWallet.sign(prepared);
      console.log("⏳ Submitting transaction and waiting for validation...");
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta.TransactionResult === "tesSUCCESS") {
        console.log("✅ Successfully added liquidity to AMM (LPToken)");

        // Extract and display LP tokens received
        const lpTokensReceived = await extractLPTokensReceived(
          result,
          providerWallet,
          ammAccount,
        );

        // Extract actual assets deposited
        const assetsDeposited = extractActualAssetsDeposited(result);

        // Display transaction details
        displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

        return true;
      } else {
        console.error(
          `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
        );
        if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
          console.error("💡 This error often occurs when:");
          console.error(
            "  - The pool's ratio requirements cannot be satisfied",
          );
          console.error("  - The amount of LP tokens requested is too high");
          console.error(
            "  - There is an issue with the LP token currency format",
          );
          console.error(
            "Try with lower values or use the basic two-asset deposit option instead.",
          );
        }
        return false;
      }
    } catch (submitError) {
      console.error(`❌ Transaction submission error: ${submitError.message}`);
      if (submitError.data && submitError.data.resultCode) {
        console.error(`Error code: ${submitError.data.resultCode}`);
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding liquidity: ${error.message}`);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return false;
  }
}

// Double-asset deposit: tfTwoAssetIfEmpty (deposit exactly both assets, useful for empty pools, 0x00080000 = 524288)
export async function addLiquidityIfEmpty(
  providerWallet,
  ammAccount,
  assetAObj,
  assetBObj,
) {
  try {
    await connectXrplClient();
    console.log(`✅ Adding liquidity (IfEmpty) to AMM at ${ammAccount}`);

    // Check AMM status
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });

    if (ammInfoResponse.result && ammInfoResponse.result.amm) {
      const ammInfo = ammInfoResponse.result.amm;
      const asset1 = ammInfo.amount.currency
        ? ammInfo.amount
        : { value: xrpl.dropsToXrp(ammInfo.amount) };
      const asset2 = ammInfo.amount2.currency
        ? ammInfo.amount2
        : { value: xrpl.dropsToXrp(ammInfo.amount2) };

      // Check if both assets have value
      const hasLiquidity =
        ((asset1.currency && parseFloat(asset1.value) > 0) ||
          (!asset1.currency && parseFloat(asset1.value) > 0)) &&
        ((asset2.currency && parseFloat(asset2.value) > 0) ||
          (!asset2.currency && parseFloat(asset2.value) > 0));

      // If pool has liquidity, warn user but allow them to continue
      if (hasLiquidity) {
        console.log(
          "⚠️ The AMM pool already has liquidity. The 'IfEmpty' option is designed for empty pools.",
        );
        console.log(
          `   Current pool balances: ${asset1.value} ${asset1.currency || "XRP"}, ${asset2.value} ${asset2.currency || "XRP"}`,
        );
        console.log(
          "   You can still proceed, but the 'Two Asset Quantity' option might be more appropriate.",
        );
        const shouldContinue = true; // In a real UI, you would ask for confirmation here
        if (!shouldContinue) {
          console.log("✓ Operation cancelled by user.");
          return false;
        }
      }
    }

    // Handle formatting of assets
    let amount1, amount2;

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

    // Check if user has sufficient balances
    // Asset A
    if (assetAObj.currency !== "XRP") {
      const balanceResponseA = await client.request({
        command: "account_lines",
        account: providerWallet.classicAddress,
        peer: assetAObj.issuer,
      });
      const assetLineA = balanceResponseA.result.lines.find(
        (line) => line.currency === assetAObj.currency,
      );
      if (assetLineA) {
        const balance = parseFloat(assetLineA.balance);
        const deposit = parseFloat(assetAObj.value);
        console.log(
          `💰 Current ${assetAObj.currency} balance: ${balance.toFixed(6)}`,
        );
        if (balance < deposit) {
          console.log(
            `❌ Insufficient balance of ${assetAObj.currency}. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)}`,
          );
          return false;
        }
        console.log(`✅ Sufficient ${assetAObj.currency} balance confirmed.`);
      } else {
        console.log(`❌ No trustline found for ${assetAObj.currency}`);
        return false;
      }
    } else {
      // Check XRP balance
      const accountInfoResponseA = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });
      if (
        accountInfoResponseA.result &&
        accountInfoResponseA.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponseA.result.account_data.Balance,
        );
        const balance = parseFloat(xrpBalance);
        const deposit = parseFloat(assetAObj.value);
        const reserveXRP = 10; // Base reserve
        console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
        if (balance - reserveXRP < deposit) {
          console.log(
            `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)} + reserve`,
          );
          return false;
        }
        console.log(`✅ Sufficient XRP balance confirmed.`);
      } else {
        console.log(`❌ Could not retrieve XRP balance`);
        return false;
      }
    }

    // Asset B
    if (assetBObj.currency !== "XRP") {
      const balanceResponseB = await client.request({
        command: "account_lines",
        account: providerWallet.classicAddress,
        peer: assetBObj.issuer,
      });
      const assetLineB = balanceResponseB.result.lines.find(
        (line) => line.currency === assetBObj.currency,
      );
      if (assetLineB) {
        const balance = parseFloat(assetLineB.balance);
        const deposit = parseFloat(assetBObj.value);
        console.log(
          `💰 Current ${assetBObj.currency} balance: ${balance.toFixed(6)}`,
        );
        if (balance < deposit) {
          console.log(
            `❌ Insufficient balance of ${assetBObj.currency}. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)}`,
          );
          return false;
        }
        console.log(`✅ Sufficient ${assetBObj.currency} balance confirmed.`);
      } else {
        console.log(`❌ No trustline found for ${assetBObj.currency}`);
        return false;
      }
    } else {
      // Check XRP balance (if not already checked for asset A)
      if (assetAObj.currency !== "XRP") {
        const accountInfoResponseB = await client.request({
          command: "account_info",
          account: providerWallet.classicAddress,
          ledger_index: "validated",
        });
        if (
          accountInfoResponseB.result &&
          accountInfoResponseB.result.account_data
        ) {
          const xrpBalance = xrpl.dropsToXrp(
            accountInfoResponseB.result.account_data.Balance,
          );
          const balance = parseFloat(xrpBalance);
          const deposit = parseFloat(assetBObj.value);
          const reserveXRP = 10; // Base reserve
          console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
          if (balance - reserveXRP < deposit) {
            console.log(
              `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${deposit.toFixed(6)} + reserve`,
            );
            return false;
          }
          console.log(`✅ Sufficient XRP balance confirmed.`);
        } else {
          console.log(`❌ Could not retrieve XRP balance`);
          return false;
        }
      }
    }

    // Set up the transaction fields
    const tx = {
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

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Successfully added liquidity to AMM (IfEmpty)");

      // Extract and display LP tokens received
      const lpTokensReceived = await extractLPTokensReceived(
        result,
        providerWallet,
        ammAccount,
      );

      // Extract actual assets deposited
      const assetsDeposited = extractActualAssetsDeposited(result);

      // Display transaction details
      displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

      return true;
    } else {
      console.error(
        `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
      );
      if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
        console.error("💡 This error often occurs when:");
        console.error(
          "  - The AMM pool already has liquidity in a different ratio",
        );
        console.error("  - There is an issue with the asset formats");
        console.error("  - There may be a minimum liquidity requirement");
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding liquidity: ${error.message}`);
    return false;
  }
}

// Single-asset deposit: tfSingleAsset (deposit exactly the specified amount of one asset, 0x00100000 = 1048576)
export async function addLiquiditySingleAsset(
  providerWallet,
  ammAccount,
  assetObj,
) {
  try {
    await connectXrplClient();
    console.log(`✅ Adding single-asset liquidity to AMM at ${ammAccount}`);
    // Get LP token info
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });
    if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
      console.error("❌ Could not retrieve LP token information from AMM");
      return false;
    }
    const lpToken = ammInfoResponse.result.amm.lp_token;
    const lpTokenIssuer = ammAccount;
    const hasLPTrustline = await checkTrustline(
      providerWallet,
      lpTokenIssuer,
      lpToken.currency,
    );
    if (!hasLPTrustline) {
      console.log(
        `❌ Trustline for LP token (${lpToken.currency}) with issuer (${lpTokenIssuer}) not found.`,
      );
      return false;
    }
    // Asset balance check
    if (assetObj.currency !== "XRP") {
      if (!assetObj.issuer) {
        console.log(`❌ Issuer not specified for ${assetObj.currency}`);
        return false;
      }
      const balanceResponse = await client.request({
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
          console.log(
            `❌ Insufficient balance of ${assetObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
          );
          return false;
        }
        console.log(`✅ Sufficient ${assetObj.currency} balance confirmed.`);
      } else {
        console.log(
          `❌ Cannot find balance information for ${assetObj.currency}`,
        );
        return false;
      }
    } else {
      const accountInfoResponse = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });
      if (
        accountInfoResponse.result &&
        accountInfoResponse.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponse.result.account_data.Balance,
        );
        const balance = new BigNumber(xrpBalance);
        const depositBN = new BigNumber(assetObj.value);
        const reserveXRP = new BigNumber(10);
        console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
        console.log(
          `📊 Required XRP amount: ${depositBN.toFixed(6)} + ${reserveXRP.toFixed()} reserve`,
        );
        if (balance.minus(reserveXRP).lt(depositBN)) {
          console.log(
            `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)} + reserve`,
          );
          return false;
        }
        console.log(`✅ Sufficient XRP balance confirmed.`);
      } else {
        console.log(`❌ Cannot find balance information for XRP`);
        return false;
      }
    }
    // Prepare the transaction
    const tx = {
      TransactionType: "AMMDeposit",
      Account: providerWallet.classicAddress,
      AMMAccount: ammAccount,
      Flags: 0x00080000, // tfSingleAsset
    };

    // Get AMM info to determine the other asset in the pair
    console.log("📊 Fetching AMM info to identify both assets in the pair...");
    const pairAmmInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });

    if (!pairAmmInfoResponse.result.amm) {
      console.error("❌ Could not fetch AMM information");
      return false;
    }

    const ammInfo = pairAmmInfoResponse.result.amm;

    // Handle different property formats in AMM info response
    let asset1, asset2;

    if (ammInfo.asset && ammInfo.asset.currency) {
      asset1 =
        ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
    } else if (ammInfo.amount) {
      asset1 =
        typeof ammInfo.amount === "object" && ammInfo.amount.currency
          ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine first asset in the AMM pool");
      return false;
    }

    if (ammInfo.asset2 && ammInfo.asset2.currency) {
      asset2 =
        ammInfo.asset2.currency === "XRP"
          ? { currency: "XRP" }
          : ammInfo.asset2;
    } else if (ammInfo.amount2) {
      asset2 =
        typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
          ? {
              currency: ammInfo.amount2.currency,
              issuer: ammInfo.amount2.issuer,
            }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine second asset in the AMM pool");
      return false;
    }

    console.log(`🔹 AMM Assets: ${asset1.currency}/${asset2.currency}`);

    // Determine which asset we're depositing and which is the other asset
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
      console.log(
        `❌ Selected asset ${assetObj.currency} does not match any asset in this AMM pool.`,
      );
      console.log(`   Pool assets: ${asset1.currency} and ${asset2.currency}`);
      console.log(`   Selected asset: ${assetObj.currency}`);
      if (assetObj.issuer) {
        console.log(`   Selected issuer: ${assetObj.issuer}`);
        console.log(
          `   Pool issuers: ${asset1.issuer || "None"} and ${asset2.issuer || "None"}`,
        );
      }
      return false;
    }

    // Handle XRP assets specially and format non-XRP assets according to exact XRPL requirements
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

    // Include Asset2 field for the other asset in the pair
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

    // Set LastLedgerSequence to ensure transaction doesn't expire too quickly
    const ledgerResponse = await client.request({ command: "ledger_current" });
    const currentLedger = ledgerResponse.result.ledger_current_index;
    prepared.LastLedgerSequence = currentLedger + 50; // Give it more time (50 ledgers)

    console.log("✍️ Signing transaction...");
    const signed = providerWallet.sign(prepared);
    console.log("⏳ Submitting transaction and waiting for validation...");
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Successfully added single-asset liquidity to AMM");

      // Extract and display LP tokens received
      const lpTokensReceived = await extractLPTokensReceived(
        result,
        providerWallet,
        ammAccount,
      );

      // Extract actual assets deposited
      const assetsDeposited = extractActualAssetsDeposited(result);

      // Display transaction details
      displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

      return true;
    } else {
      console.error(
        `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
      );
      if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
        console.error("💡 This error often occurs when:");
        console.error(
          "  - The pool's ratio requirements cannot be satisfied with a single asset",
        );
        console.error("  - The AMM pool may be too unbalanced");
        console.error(
          "Try with a smaller amount or consider using a two-asset deposit instead.",
        );
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding liquidity: ${error.message}`);
    // Log full error in development mode
    console.error(error);
    return false;
  }
}

// Single-asset deposit: tfOneAssetLPToken (deposit one asset at most, receive specified LP tokens)
export async function addLiquidityOneAssetLPToken(
  providerWallet,
  ammAccount,
  assetObj,
  lpTokenOut,
) {
  try {
    await connectXrplClient();
    console.log(
      `✅ Adding one-asset LPToken liquidity to AMM at ${ammAccount}`,
    );
    console.log(
      `🔹 Asset: ${assetObj.currency} - Max Amount: ${assetObj.value} - Issuer: ${assetObj.issuer || "XRP"}`,
    );
    console.log(`🔹 LPTokenOut: ${JSON.stringify(lpTokenOut)}`);

    // Check if trustline exists for LP token
    console.log(
      `🔍 Checking if trustline exists for ${lpTokenOut.currency} from ${lpTokenOut.issuer} to ${providerWallet.classicAddress}...`,
    );
    const trustlinesResponse = await client.request({
      command: "account_lines",
      account: providerWallet.classicAddress,
      peer: lpTokenOut.issuer,
    });

    const lpTrustline = trustlinesResponse.result.lines.find(
      (line) => line.currency === lpTokenOut.currency,
    );

    if (!lpTrustline) {
      console.log(
        `❌ Trustline for ${lpTokenOut.currency} not found. Please set up the trustline first.`,
      );
      return false;
    }
    console.log(`✅ Trustline found for ${lpTokenOut.currency}`);

    // Check balance of the asset being deposited
    if (assetObj.currency !== "XRP") {
      const balanceResponse = await client.request({
        command: "account_lines",
        account: providerWallet.classicAddress,
        peer: assetObj.issuer,
      });

      const assetLine = balanceResponse.result.lines.find(
        (line) =>
          line.currency === assetObj.currency &&
          line.account === assetObj.issuer,
      );

      if (assetLine) {
        console.log(
          `💰 Current ${assetObj.currency} balance: ${assetLine.balance}`,
        );
        console.log(
          `📊 Required ${assetObj.currency} amount: ${assetObj.value}`,
        );

        if (parseFloat(assetLine.balance) < parseFloat(assetObj.value)) {
          console.log(
            `❌ Insufficient ${assetObj.currency} balance. Need: ${assetObj.value}, Have: ${assetLine.balance}`,
          );
          return false;
        }
        console.log(`✅ Sufficient ${assetObj.currency} balance confirmed.`);
      } else {
        console.log(
          `❌ Could not find trustline for ${assetObj.currency} issued by ${assetObj.issuer}.`,
        );
        return false;
      }
    } else {
      // XRP balance check
      const accountInfoResponse = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });

      if (
        accountInfoResponse.result &&
        accountInfoResponse.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponse.result.account_data.Balance,
        );
        console.log(`💰 Current XRP balance: ${xrpBalance}`);
        console.log(`📊 Required XRP amount: ${assetObj.value}`);

        // Check if balance minus 10 XRP reserve is sufficient
        if (parseFloat(xrpBalance) - 10 < parseFloat(assetObj.value)) {
          console.log(
            `❌ Insufficient XRP balance. Need: ${assetObj.value}, Have: ${xrpBalance} (minus 10 XRP reserve)`,
          );
          return false;
        }
        console.log(`✅ Sufficient XRP balance confirmed.`);
      } else {
        console.log(`❌ Could not retrieve XRP balance.`);
        return false;
      }
    }

    // Get AMM info to identify both assets in the pair
    console.log(`📊 Fetching AMM info to identify both assets in the pair...`);
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });

    if (!ammInfoResponse.result.amm) {
      console.log(`❌ Could not retrieve AMM information for ${ammAccount}`);
      return false;
    }

    const ammInfo = ammInfoResponse.result.amm;

    // Handle different property formats in AMM info response
    // Some responses use asset/asset2, others use amount/amount2
    // Extract asset information properly based on what's available
    let asset1, asset2;

    if (ammInfo.asset && ammInfo.asset.currency) {
      asset1 =
        ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
    } else if (ammInfo.amount) {
      asset1 =
        typeof ammInfo.amount === "object" && ammInfo.amount.currency
          ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine first asset in the AMM pool");
      return false;
    }

    if (ammInfo.asset2 && ammInfo.asset2.currency) {
      asset2 =
        ammInfo.asset2.currency === "XRP"
          ? { currency: "XRP" }
          : ammInfo.asset2;
    } else if (ammInfo.amount2) {
      asset2 =
        typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
          ? {
              currency: ammInfo.amount2.currency,
              issuer: ammInfo.amount2.issuer,
            }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine second asset in the AMM pool");
      return false;
    }

    console.log(`🔹 AMM Assets: ${asset1.currency}/${asset2.currency}`);

    // When using the tfOneAssetLPToken flag (0x00200000), according to the documentation,
    // we need to specify:
    // 1. The Asset and Asset2 fields to identify the assets in the pool
    // 2. The Amount field for the maximum amount of the asset to deposit
    // 3. The LPTokenOut field for desired LP tokens

    // For OneAssetLPToken mode, we need to set this flag specifically - 0x00200000 (2097152)
    let tx = {
      TransactionType: "AMMDeposit",
      Account: providerWallet.classicAddress,
      AMMAccount: ammAccount,
      Asset: asset1,
      Asset2: asset2,
      Flags: 0x00200000, // tfOneAssetLPToken flag (0x00200000)
      LPTokenOut: {
        currency: lpTokenOut.currency,
        issuer: lpTokenOut.issuer,
        value: lpTokenOut.value,
      },
    };

    // Add the Amount field based on the selected asset
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
      console.log(
        `❌ Selected asset ${assetObj.currency} does not match any asset in this AMM pool.`,
      );
      console.log(`   Pool assets: ${asset1.currency} and ${asset2.currency}`);
      console.log(`   Selected asset: ${assetObj.currency}`);
      if (assetObj.issuer) {
        console.log(`   Selected issuer: ${assetObj.issuer}`);
        console.log(
          `   Pool issuers: ${asset1.issuer || "None"} and ${asset2.issuer || "None"}`,
        );
      }
      return false;
    }

    // Add Amount field
    if (assetObj.currency === "XRP") {
      tx.Amount = xrpl.xrpToDrops(assetObj.value);
    } else {
      tx.Amount = {
        currency: assetObj.currency,
        issuer: assetObj.issuer,
        value: assetObj.value,
      };
    }

    // Extract and process current pool data for information only
    // Handle both XRP (string) and tokens (object) formats
    const asset1Amount =
      typeof ammInfo.amount === "object"
        ? parseFloat(ammInfo.amount.value)
        : parseFloat(xrpl.dropsToXrp(ammInfo.amount));

    const asset2Amount =
      typeof ammInfo.amount2 === "object"
        ? parseFloat(ammInfo.amount2.value)
        : parseFloat(xrpl.dropsToXrp(ammInfo.amount2));

    const lpTokenSupply = parseFloat(ammInfo.lp_token.value);

    // Calculate and display required amount based on LP token ratio (for information only)
    if (lpTokenSupply > 0) {
      const lpTokenRatio = parseFloat(lpTokenOut.value) / lpTokenSupply;

      // Determine which asset amount to use based on the selected asset
      const selectedAssetAmount = isFirstAsset ? asset1Amount : asset2Amount;
      const requiredAssetAmount = selectedAssetAmount * lpTokenRatio;

      console.log(`💡 Based on the LP token ratio, you need approximately:`);
      console.log(
        `   - ${requiredAssetAmount.toFixed(6)} of ${assetObj.currency}`,
      );
      console.log(
        `   Maximum amount you're willing to provide: ${assetObj.value}`,
      );

      // Check if maximum amount is sufficient (for information only)
      const assetSufficient =
        parseFloat(assetObj.value) >= requiredAssetAmount * 1.01;

      if (!assetSufficient) {
        console.log(
          "⚠️ Warning: The maximum amount you're providing may not be sufficient for the requested LP tokens.",
        );
      }

      // Display the percentage of LP tokens being requested compared to total supply
      const lpPercentage = (parseFloat(lpTokenOut.value) / lpTokenSupply) * 100;
      if (lpPercentage > 20) {
        console.log(
          `⚠️ Warning: You're requesting ${lpPercentage.toFixed(2)}% of the total LP token supply.`,
        );
        console.log(
          "   Large requests may fail or have high slippage. Consider requesting a smaller amount.",
        );
      }
    }

    console.log(
      "📃 Transaction fields (OneAssetLPToken):",
      JSON.stringify(
        {
          TransactionType: tx.TransactionType,
          Asset: tx.Asset,
          Asset2: tx.Asset2,
          Amount: tx.Amount,
          LPTokenOut: tx.LPTokenOut,
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

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Successfully added one-asset LPToken liquidity to AMM");

      // Extract and display LP tokens received
      const lpTokensReceived = await extractLPTokensReceived(
        result,
        providerWallet,
        ammAccount,
      );

      // Extract actual assets deposited
      const assetsDeposited = extractActualAssetsDeposited(result);

      // Display transaction details
      displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

      return true;
    } else {
      console.error(
        `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
      );
      if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
        console.error("💡 This error often occurs when:");
        console.error("  - The pool's ratio requirements cannot be satisfied");
        console.error("  - The amount of LP tokens requested is too high");
        console.error(
          "  - There is an issue with the LP token currency format",
        );
        console.error(
          "Try with a smaller LP token amount or increase your maximum asset amount.",
        );
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding one-asset liquidity: ${error.message}`);
    // In development mode, log the full error for debugging
    console.error(error);
    return false;
  }
}

// Single-asset deposit: tfLimitLPToken (deposit up to specified amount, pay no more than specified effective price per LP token)
export async function addLiquidityLimitLPToken(
  providerWallet,
  ammAccount,
  assetObj,
  ePrice,
) {
  try {
    await connectXrplClient();
    console.log(`✅ Adding limit LPToken liquidity to AMM at ${ammAccount}`);
    // Get LP token info
    const ammInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });
    if (!ammInfoResponse.result.amm || !ammInfoResponse.result.amm.lp_token) {
      console.error("❌ Could not retrieve LP token information from AMM");
      return false;
    }
    const lpToken = ammInfoResponse.result.amm.lp_token;
    const lpTokenIssuer = ammAccount;
    const hasLPTrustline = await checkTrustline(
      providerWallet,
      lpTokenIssuer,
      lpToken.currency,
    );
    if (!hasLPTrustline) {
      console.log(
        `❌ Trustline for LP token (${lpToken.currency}) with issuer (${lpTokenIssuer}) not found.`,
      );
      return false;
    }
    // Asset balance check
    if (assetObj.currency !== "XRP") {
      if (!assetObj.issuer) {
        console.log(`❌ Issuer not specified for ${assetObj.currency}`);
        return false;
      }
      const balanceResponse = await client.request({
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
          console.log(
            `❌ Insufficient balance of ${assetObj.currency}. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)}`,
          );
          return false;
        }
        console.log(`✅ Sufficient ${assetObj.currency} balance confirmed.`);
      } else {
        console.log(
          `❌ Cannot find balance information for ${assetObj.currency}`,
        );
        return false;
      }
    } else {
      const accountInfoResponse = await client.request({
        command: "account_info",
        account: providerWallet.classicAddress,
        ledger_index: "validated",
      });
      if (
        accountInfoResponse.result &&
        accountInfoResponse.result.account_data
      ) {
        const xrpBalance = xrpl.dropsToXrp(
          accountInfoResponse.result.account_data.Balance,
        );
        const balance = new BigNumber(xrpBalance);
        const depositBN = new BigNumber(assetObj.value);
        const reserveXRP = new BigNumber(10);
        console.log(`💰 Current XRP balance: ${balance.toFixed(6)}`);
        console.log(
          `📊 Required XRP amount: ${depositBN.toFixed(6)} + ${reserveXRP.toFixed()} reserve`,
        );
        if (balance.minus(reserveXRP).lt(depositBN)) {
          console.log(
            `❌ Insufficient balance of XRP. Have: ${balance.toFixed(6)}, Need: ${depositBN.toFixed(6)} + reserve`,
          );
          return false;
        }
        console.log(`✅ Sufficient XRP balance confirmed.`);
      } else {
        console.log(`❌ Cannot find balance information for XRP`);
        return false;
      }
    }
    // Prepare the transaction
    const tx = {
      TransactionType: "AMMDeposit",
      Account: providerWallet.classicAddress,
      AMMAccount: ammAccount,
      Flags: 0x00400000, // tfLimitLPToken
      EPrice: ePrice,
    };

    // Get AMM info to determine the other asset in the pair
    console.log("📊 Fetching AMM info to identify both assets in the pair...");
    const pairAmmInfoResponse = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated",
    });

    if (!pairAmmInfoResponse.result.amm) {
      console.error("❌ Could not fetch AMM information");
      return false;
    }

    const ammInfo = pairAmmInfoResponse.result.amm;

    // Handle different property formats in AMM info response
    let asset1, asset2;

    if (ammInfo.asset && ammInfo.asset.currency) {
      asset1 =
        ammInfo.asset.currency === "XRP" ? { currency: "XRP" } : ammInfo.asset;
    } else if (ammInfo.amount) {
      asset1 =
        typeof ammInfo.amount === "object" && ammInfo.amount.currency
          ? { currency: ammInfo.amount.currency, issuer: ammInfo.amount.issuer }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine first asset in the AMM pool");
      return false;
    }

    if (ammInfo.asset2 && ammInfo.asset2.currency) {
      asset2 =
        ammInfo.asset2.currency === "XRP"
          ? { currency: "XRP" }
          : ammInfo.asset2;
    } else if (ammInfo.amount2) {
      asset2 =
        typeof ammInfo.amount2 === "object" && ammInfo.amount2.currency
          ? {
              currency: ammInfo.amount2.currency,
              issuer: ammInfo.amount2.issuer,
            }
          : { currency: "XRP" };
    } else {
      console.log("❌ Cannot determine second asset in the AMM pool");
      return false;
    }

    console.log(`🔹 AMM Assets: ${asset1.currency}/${asset2.currency}`);

    // Determine which asset we're depositing and which is the other asset
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
      console.error(
        `❌ Asset ${assetObj.currency} is not part of this AMM pair`,
      );
      console.log(`   Pool assets: ${asset1.currency} and ${asset2.currency}`);
      console.log(`   Selected asset: ${assetObj.currency}`);
      if (assetObj.issuer) {
        console.log(`   Selected issuer: ${assetObj.issuer}`);
        console.log(
          `   Pool issuers: ${asset1.issuer || "None"} and ${asset2.issuer || "None"}`,
        );
      }
      return false;
    }

    // Handle XRP assets specially and format non-XRP assets according to exact XRPL requirements
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

    // Include Asset2 field for the other asset in the pair
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
      "📃 Transaction fields (LimitLPToken):",
      JSON.stringify(
        {
          TransactionType: tx.TransactionType,
          Asset: tx.Asset,
          Asset2: tx.Asset2,
          Amount: tx.Amount,
          EPrice: tx.EPrice,
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

    if (result.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Successfully added limit LPToken liquidity to AMM");

      // Extract and display LP tokens received
      const lpTokensReceived = await extractLPTokensReceived(
        result,
        providerWallet,
        ammAccount,
      );

      // Extract actual assets deposited
      const assetsDeposited = extractActualAssetsDeposited(result);

      // Display transaction details
      displayTransactionDetails(result, lpTokensReceived, assetsDeposited);

      return true;
    } else {
      console.error(
        `❌ Failed to add liquidity: ${result.result.meta.TransactionResult}`,
      );
      if (result.result.meta.TransactionResult === "tecAMM_FAILED") {
        console.error("💡 This error often occurs when:");
        console.error("  - The effective price limit is too restrictive");
        console.error("  - The AMM pool constraints cannot be satisfied");
        console.error(
          "Try with a different price limit or consider using a different deposit option.",
        );
      }
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding liquidity: ${error.message}`);
    // Log full error in development mode
    console.error(error);
    return false;
  }
}
