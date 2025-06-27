import { NextResponse } from "next/server";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";
import * as xrpl from "xrpl";

// Function to extract deposited amounts from AMM deposit transaction metadata
function extractAmmDepositAmounts(txData, senderAddress) {
  const meta = txData.meta;
  if (!meta || !meta.AffectedNodes) return "Liquidity deposit";

  const assetsDeposited = [];
  const addedAssets = new Set();

  for (const node of meta.AffectedNodes) {
    // For token deposits (check trustline modifications)
    if (node.ModifiedNode?.LedgerEntryType === "RippleState") {
      const state = node.ModifiedNode;
      const { FinalFields, PreviousFields } = state;
      
      if (!FinalFields?.Balance || !PreviousFields?.Balance) continue;
      if (FinalFields.Balance.currency?.length === 40) continue; // Skip LP tokens

      const highAccount = FinalFields.HighLimit?.issuer;
      const lowAccount = FinalFields.LowLimit?.issuer;
      
      if (highAccount !== senderAddress && lowAccount !== senderAddress) continue;

      const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
      const assetKey = `${FinalFields.Balance.currency}:${issuer}`;
      
      if (addedAssets.has(assetKey)) continue;

      const prevValue = parseFloat(PreviousFields.Balance.value || "0");
      const finalValue = parseFloat(FinalFields.Balance.value || "0");
      const isFromSenderPerspective = lowAccount === senderAddress;
      
      const diff = isFromSenderPerspective ? 
        prevValue - finalValue : finalValue - prevValue;

      if (diff > 0.000001) {
        assetsDeposited.push({
          currency: FinalFields.Balance.currency,
          value: diff.toFixed(6),
        });
        addedAssets.add(assetKey);
      }
    }
    // For XRP deposits
    else if (node.ModifiedNode?.LedgerEntryType === "AccountRoot") {
      const state = node.ModifiedNode;
      if (state.FinalFields?.Account !== senderAddress) continue;
      
      const { FinalFields, PreviousFields } = state;
      if (!FinalFields?.Balance || !PreviousFields?.Balance) continue;
      
      const finalDrops = parseInt(FinalFields.Balance);
      const prevDrops = parseInt(PreviousFields.Balance);
      const fee = parseInt(txData.tx?.Fee || txData.Fee || 0);
      const xrpSent = prevDrops - finalDrops - fee;

      if (!addedAssets.has("XRP") && xrpSent > 1000) {
        assetsDeposited.push({
          currency: "XRP",
          value: parseFloat(xrpl.dropsToXrp(xrpSent.toString())).toFixed(6),
        });
        addedAssets.add("XRP");
      }
    }
  }

  if (assetsDeposited.length === 0) return "Liquidity deposit";
  if (assetsDeposited.length === 1) {
    const asset = assetsDeposited[0];
    return `${asset.value} ${asset.currency}`;
  }
  return assetsDeposited.map(asset => `${asset.value} ${asset.currency}`).join(" + ");
}

// Function to extract withdrawn amounts from AMM withdraw transaction metadata
function extractAmmWithdrawAmounts(txData, senderAddress) {
  const meta = txData.meta;
  if (!meta || !meta.AffectedNodes) return "Liquidity withdrawal";

  const assetsWithdrawn = [];
  const addedAssets = new Set();

  for (const node of meta.AffectedNodes) {
    // For token withdrawals
    if (node.ModifiedNode?.LedgerEntryType === "RippleState") {
      const state = node.ModifiedNode;
      const { FinalFields, PreviousFields } = state;
      
      if (!FinalFields?.Balance || !PreviousFields?.Balance) continue;
      if (FinalFields.Balance.currency?.length === 40) continue; // Skip LP tokens

      const highAccount = FinalFields.HighLimit?.issuer;
      const lowAccount = FinalFields.LowLimit?.issuer;
      
      if (highAccount !== senderAddress && lowAccount !== senderAddress) continue;

      const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
      const assetKey = `${FinalFields.Balance.currency}:${issuer}`;
      
      if (addedAssets.has(assetKey)) continue;

      const prevValue = parseFloat(PreviousFields.Balance.value || "0");
      const finalValue = parseFloat(FinalFields.Balance.value || "0");
      const isFromSenderPerspective = lowAccount === senderAddress;
      
      const diff = isFromSenderPerspective ? 
        finalValue - prevValue : prevValue - finalValue;

      if (diff > 0.000001) {
        assetsWithdrawn.push({
          currency: FinalFields.Balance.currency,
          value: diff.toFixed(6),
        });
        addedAssets.add(assetKey);
      }
    }
    // For XRP withdrawals
    else if (node.ModifiedNode?.LedgerEntryType === "AccountRoot") {
      const state = node.ModifiedNode;
      if (state.FinalFields?.Account !== senderAddress) continue;
      
      const { FinalFields, PreviousFields } = state;
      if (!FinalFields?.Balance || !PreviousFields?.Balance) continue;
      
      const finalDrops = parseInt(FinalFields.Balance);
      const prevDrops = parseInt(PreviousFields.Balance);
      const fee = parseInt(txData.tx?.Fee || txData.Fee || 0);
      const xrpReceived = finalDrops - prevDrops + fee;

      if (!addedAssets.has("XRP") && xrpReceived > 1000) {
        assetsWithdrawn.push({
          currency: "XRP",
          value: parseFloat(xrpl.dropsToXrp(xrpReceived.toString())).toFixed(6),
        });
        addedAssets.add("XRP");
      }
    }
  }

  if (assetsWithdrawn.length === 0) return "Liquidity withdrawal";
  if (assetsWithdrawn.length === 1) {
    const asset = assetsWithdrawn[0];
    return `${asset.value} ${asset.currency}`;
  }
  return assetsWithdrawn.map(asset => `${asset.value} ${asset.currency}`).join(" + ");
}

// Helper function to format amount
function formatAmount(amount) {
  if (typeof amount === "string") {
    return `${xrpl.dropsToXrp(amount)} XRP`;
  } else if (amount && typeof amount === "object") {
    return `${amount.value} ${amount.currency}`;
  }
  return null;
}

export async function POST(req) {
  try {
    const { address, wallet, limit = 50, marker } = await req.json();
    const targetAddress = wallet?.classicAddress || address;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    await connectXrplClient();
    
    const requestParams = {
      command: "account_tx",
      account: targetAddress,
      binary: false,
      limit: Math.min(limit, 30),
      forward: false,
      ...(marker && { marker }),
    };

    const accountTx = await client.request(requestParams);

    if (!accountTx.result?.transactions) {
      return NextResponse.json({ 
        transactions: [],
        marker: null,
        account: targetAddress,
        message: "No transaction data available"
      }, { status: 200 });
    }

    // Process transactions
    const processedTransactions = accountTx.result.transactions.map((txData) => {
      try {
        const tx = txData.tx || txData.transaction || txData.tx_json || txData;
        const meta = txData.meta;
        
        if (!tx) return null;

        // Convert timestamp
        let timestamp = null;
        if (tx.date) {
          timestamp = new Date((tx.date + 946684800) * 1000);
        } else if (txData.date) {
          timestamp = new Date((txData.date + 946684800) * 1000);
        }

        // Calculate fee
        const fee = tx.Fee ? xrpl.dropsToXrp(tx.Fee) : null;
        const transactionType = tx.TransactionType || "Unknown";

        let direction = "unknown";
        let counterparty = null;
        let amount = null;
        let currency = "XRP";

        switch (transactionType) {
          case "Payment":
            const isSmartTrade = tx.Account === tx.Destination && tx.Account === targetAddress;
            
            if (isSmartTrade) {
              direction = "smart_trade";
              counterparty = null;
            
              
              // For smart trades, get sent amount from SendMax (what was sent)
              // and received amount from DeliverMax or delivered_amount (what was received)
              const sentAmount = tx.SendMax || tx.Amount;
              const receivedAmount = tx.DeliverMax || meta?.delivered_amount;
              
              console.log("sentAmount:", JSON.stringify(sentAmount));
              console.log("receivedAmount:", JSON.stringify(receivedAmount));
              
              const sentStr = formatAmount(sentAmount);
              const receivedStr = formatAmount(receivedAmount);
              
              console.log("sentStr:", sentStr);
              console.log("receivedStr:", receivedStr);
              
              if (sentStr && receivedStr) {
                amount = `${sentStr} → ${receivedStr}`;
              } else if (sentStr) {
                amount = `${sentStr} → ?`;
              } else if (receivedStr) {
                amount = `? → ${receivedStr}`;
              } else {
                amount = "Smart trade (no amounts found)";
              }
              
              console.log("Final smart trade amount:", amount);
              currency = "";
            } else {
              direction = tx.Account === targetAddress ? "sent" : "received";
              counterparty = direction === "sent" ? tx.Destination : tx.Account;
              
              const paymentAmount = tx.Amount || tx.DeliverMax || meta?.delivered_amount;
              const formatted = formatAmount(paymentAmount);
              
              if (formatted) {
                if (typeof paymentAmount === "string") {
                  amount = xrpl.dropsToXrp(paymentAmount);
                  currency = "XRP";
                } else {
                  amount = paymentAmount.value;
                  currency = paymentAmount.currency;
                }
              } else {
                amount = "Unknown amount";
                currency = "Unknown";
              }
            }
            break;

          case "TrustSet":
            direction = "trustline_set";
            counterparty = tx.LimitAmount?.issuer;
            amount = tx.LimitAmount ? 
              `${tx.LimitAmount.value} ${tx.LimitAmount.currency}` : 
              "Remove trustline";
            currency = tx.LimitAmount?.currency || "";
            break;

          case "OfferCreate":
            direction = "offer_create";
            const gets = formatAmount(tx.TakerGets);
            const pays = formatAmount(tx.TakerPays);
            amount = `${gets} → ${pays}`;
            currency = "";
            break;

          case "OfferCancel":
            direction = "offer_cancel";
            amount = `Sequence: ${tx.OfferSequence}`;
            break;

          case "AMMCreate":
            direction = "amm_create";
            amount = "AMM pool created";
            break;

          case "AMMDeposit":
            direction = "amm_deposit";
            amount = extractAmmDepositAmounts(txData, targetAddress);
            currency = "";
            break;

          case "AMMWithdraw":
            direction = "amm_withdraw";
            amount = extractAmmWithdrawAmounts(txData, targetAddress);
            currency = "";
            break;

          case "Clawback":
            direction = "clawback";
            counterparty = tx.Amount?.issuer;
            amount = tx.Amount?.value || "Clawback";
            currency = tx.Amount?.currency || "Unknown";
            break;

          default:
            direction = transactionType.toLowerCase();
            amount = "N/A";
        }

        // Override display for smart trades
        let finalType = transactionType;
        let finalDirection = direction;
        
        console.log("Before override - direction:", direction, "amount:", amount);

        if (direction === "smart_trade") {
          finalType = "Smart Trade";
          finalDirection = "smart_trade";
          console.log("Smart trade override - setting finalDirection to:", finalDirection);
          currency = "";
        }

        console.log("Final override values - type:", finalType, "direction:", finalDirection, "amount:", amount);

        return {
          hash: tx.hash || txData.hash || "unknown",
          ledger_index: tx.ledger_index || txData.ledger_index || null,
          date: timestamp,
          type: finalType,
          direction: finalDirection,
          counterparty,
          amount,
          currency,
          fee,
          validated: txData.validated !== false,
          result: meta?.TransactionResult || "unknown",
          raw: txData,
        };
      } catch (error) {
        console.warn("Error processing transaction:", error.message);
        return null;
      }
    }).filter(tx => tx !== null);

    return NextResponse.json({ 
      transactions: processedTransactions,
      marker: accountTx.result.marker,
      account: targetAddress,
      ledger_index_min: accountTx.result.ledger_index_min,
      ledger_index_max: accountTx.result.ledger_index_max,
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    return NextResponse.json(
      { error: `getAccountTransactions failed: ${error.message}` },
      { status: 500 },
    );
  }
} 