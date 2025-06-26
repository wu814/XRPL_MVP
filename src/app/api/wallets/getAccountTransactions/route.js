import { NextResponse } from "next/server";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";
import * as xrpl from "xrpl";

export async function POST(req) {
  try {
    const { address, wallet, limit = 50, marker } = await req.json();
    
    // Support both wallet object and direct address for backward compatibility
    const targetAddress = wallet?.classicAddress || address;
    
    if (!targetAddress) {
      return NextResponse.json({ error: "Missing address or wallet" }, { status: 400 });
    }

    await connectXrplClient();
    
    // First check if the account exists and is activated
    try {
      const accountInfo = await client.request({
        command: "account_info",
        account: targetAddress,
        ledger_index: "validated"
      });
      console.log(`Account ${targetAddress} exists with sequence: ${accountInfo.result.account_data.Sequence}`);
    } catch (accountError) {
      console.log(`Account ${targetAddress} may not be activated:`, accountError.message);
      // Continue anyway as account_tx might still work
    }
    
    const requestParams = {
      command: "account_tx",
      account: targetAddress,
      binary: false,
      limit: Math.min(limit, 30), // Cap at 30 to prevent abuse
      forward: false, // Get most recent first
    };

    // Add marker for pagination if provided
    if (marker) {
      requestParams.marker = marker;
    }

    const accountTx = await client.request(requestParams);

    // Debug: Log the full response
    console.log("XRPL account_tx response:", JSON.stringify(accountTx, null, 2));

    // Check if we got valid data
    if (!accountTx.result || !accountTx.result.transactions) {
      console.log("No transaction data in response for:", targetAddress);
      return NextResponse.json({ 
        transactions: [],
        marker: null,
        account: targetAddress,
        message: "No transaction data available"
      }, { status: 200 });
    }

    console.log(`Found ${accountTx.result.transactions.length} transactions for ${targetAddress}`);
    
    // Debug: Log transaction types
    const transactionTypes = accountTx.result.transactions.map(tx => {
      const transaction = tx.tx || tx;
      return transaction.TransactionType;
    });
    console.log("Transaction types found:", transactionTypes);

        // Process transactions to make them more readable
    const processedTransactions = accountTx.result.transactions.map((txData) => {
      try {
        // Handle different XRPL response formats
        const tx = txData.tx || txData.transaction || txData.tx_json || txData;
        const meta = txData.meta;
        const validated = txData.validated;
        
        // console.log("=== PROCESSING TRANSACTION ===");
        // console.log("Raw txData:", JSON.stringify(txData, null, 2));
        console.log("Processing transaction structure:", {
          hasTransaction: !!txData.transaction,
          hasTx: !!txData.tx,
          directFields: Object.keys(txData),
          txFields: tx ? Object.keys(tx) : null
        });
        
        // Convert Ripple timestamp to regular timestamp - try multiple formats
        let timestamp = null;
        if (tx?.date) {
          timestamp = new Date((tx.date + 946684800) * 1000);
        } else if (txData.date) {
          timestamp = new Date((txData.date + 946684800) * 1000);
        } else if (txData.close_time_iso) {
          timestamp = new Date(txData.close_time_iso);
        }
      
      // Determine transaction direction and counterparty
      let direction = "unknown";
      let counterparty = null;
      let amount = null;
      let currency = "XRP";
      let fee = null;
      
              // Safety check for tx object
        if (!tx) {
          console.warn("Transaction object is undefined:", txData);
          return null;
        }
        
        console.log("Transaction type:", tx.TransactionType, "TX keys:", Object.keys(tx));
        console.log("Full transaction data:", JSON.stringify(tx, null, 2));
        
        if (tx.Fee) {
          try {
            fee = xrpl.dropsToXrp(tx.Fee);
          } catch (e) {
            console.warn("Error parsing fee:", tx.Fee);
            fee = null;
          }
        }
        
                        // Try different possible field names for transaction type
        const transactionType = tx.TransactionType || tx.transaction_type || tx.type || txData.TransactionType || txData.transaction_type || txData.tx_json?.TransactionType || "Unknown";
        console.log("Final transaction type used:", transactionType);
        console.log("All possible type fields:", {
          "tx.TransactionType": tx.TransactionType,
          "tx.transaction_type": tx.transaction_type,
          "tx.type": tx.type,
          "txData.TransactionType": txData.TransactionType,
          "txData.transaction_type": txData.transaction_type
        });
        
        switch (transactionType) {
          case "Payment":
            direction = tx.Account === targetAddress ? "sent" : "received";
            counterparty = direction === "sent" ? tx.Destination : tx.Account;
            
            console.log("=== PROCESSING PAYMENT ===");
            console.log("Payment direction:", direction);
            console.log("Payment Amount field:", tx.Amount);
            console.log("Payment DeliverMax field:", tx.DeliverMax);
            console.log("Payment delivered_amount from meta:", txData.meta?.delivered_amount);
            
            // Handle different amount fields in payments
            const paymentAmount = tx.Amount || tx.DeliverMax || txData.meta?.delivered_amount;
            
            if (typeof paymentAmount === "string") {
              // XRP payment
              amount = xrpl.dropsToXrp(paymentAmount);
              currency = "XRP";
            } else if (paymentAmount && typeof paymentAmount === "object") {
              // IOU payment
              amount = paymentAmount.value;
              currency = paymentAmount.currency;
            } else {
              // Fallback - try to parse from meta
              console.log("Could not parse payment amount, using fallback");
              amount = "Unknown amount";
              currency = "Unknown";
            }
            
            console.log("Final payment amount:", amount, currency);
            break;
            
          case "TrustSet":
            direction = "trustline_set";
            counterparty = tx.LimitAmount?.issuer || tx.limitAmount?.issuer;
            if (tx.LimitAmount) {
              amount = `${tx.LimitAmount.value} ${tx.LimitAmount.currency}`;
              currency = tx.LimitAmount.currency;
            } else if (tx.limitAmount) {
              amount = `${tx.limitAmount.value} ${tx.limitAmount.currency}`;
              currency = tx.limitAmount.currency;
            } else {
              amount = "Remove trustline";
            }
            break;
            
          case "OfferCreate":
            direction = "offer_create";
            counterparty = null;
            
            const takerGets = tx.TakerGets;
            const takerPays = tx.TakerPays;
            
            if (typeof takerGets === "string") {
              amount = `${xrpl.dropsToXrp(takerGets)} XRP`;
            } else {
              amount = `${takerGets.value} ${takerGets.currency}`;
            }
            
            if (typeof takerPays === "string") {
              amount += ` → ${xrpl.dropsToXrp(takerPays)} XRP`;
            } else {
              amount += ` → ${takerPays.value} ${takerPays.currency}`;
            }
            break;
            
          case "OfferCancel":
            direction = "offer_cancel";
            counterparty = null;
            amount = `Sequence: ${tx.OfferSequence}`;
            break;
            
          case "AccountSet":
            direction = "account_set";
            counterparty = null;
            amount = "Account settings updated";
            break;
            
          case "SetRegularKey":
            direction = "set_regular_key";
            counterparty = tx.RegularKey;
            amount = "Regular key set";
            break;
            
          case "SignerListSet":
            direction = "signer_list_set";
            counterparty = null;
            amount = "Signer list updated";
            break;
            
          case "EscrowCreate":
            direction = "escrow_create";
            counterparty = tx.Destination;
            amount = typeof tx.Amount === "string" ? `${xrpl.dropsToXrp(tx.Amount)} XRP` : `${tx.Amount.value} ${tx.Amount.currency}`;
            break;
            
          case "EscrowFinish":
            direction = "escrow_finish";
            counterparty = tx.Owner;
            amount = "Escrow finished";
            break;
            
          case "EscrowCancel":
            direction = "escrow_cancel";
            counterparty = tx.Owner;
            amount = "Escrow cancelled";
            break;
            
          case "PaymentChannelCreate":
            direction = "payment_channel_create";
            counterparty = tx.Destination;
            amount = typeof tx.Amount === "string" ? `${xrpl.dropsToXrp(tx.Amount)} XRP` : `${tx.Amount.value} ${tx.Amount.currency}`;
            break;
            
          case "PaymentChannelFund":
            direction = "payment_channel_fund";
            counterparty = null;
            amount = typeof tx.Amount === "string" ? `${xrpl.dropsToXrp(tx.Amount)} XRP` : `${tx.Amount.value} ${tx.Amount.currency}`;
            break;
            
          case "PaymentChannelClaim":
            direction = "payment_channel_claim";
            counterparty = null;
            amount = "Payment channel claim";
            break;
            
          case "CheckCreate":
            direction = "check_create";
            counterparty = tx.Destination;
            amount = typeof tx.SendMax === "string" ? `${xrpl.dropsToXrp(tx.SendMax)} XRP` : `${tx.SendMax.value} ${tx.SendMax.currency}`;
            break;
            
          case "CheckCash":
            direction = "check_cash";
            counterparty = null;
            amount = "Check cashed";
            break;
            
          case "CheckCancel":
            direction = "check_cancel";
            counterparty = null;
            amount = "Check cancelled";
            break;
            
          case "DepositPreauth":
            direction = "deposit_preauth";
            counterparty = tx.Authorize || tx.Unauthorize;
            amount = tx.Authorize ? "Authorized" : "Unauthorized";
            break;
            
          case "AccountDelete":
            direction = "account_delete";
            counterparty = tx.Destination;
            amount = "Account deleted";
            break;
            
          case "AMMCreate":
            direction = "amm_create";
            counterparty = null;
            amount = "AMM pool created";
            break;
            
          case "AMMDeposit":
            direction = "amm_deposit";
            counterparty = null;
            amount = "Liquidity deposit";
            break;
            
          case "AMMWithdraw":
            direction = "amm_withdraw";
            counterparty = null;
            amount = "Liquidity withdrawal";
            break;
            
          case "AMMVote":
            direction = "amm_vote";
            counterparty = null;
            amount = "AMM vote";
            break;
            
          case "AMMBid":
            direction = "amm_bid";
            counterparty = null;
            amount = "AMM bid";
            break;
            
          case "Clawback":
            direction = "clawback";
            counterparty = tx.Amount?.issuer;
            if (tx.Amount) {
              amount = tx.Amount.value;
              currency = tx.Amount.currency;
            } else {
              amount = "Clawback";
              currency = "Unknown";
            }
            console.log("=== PROCESSING CLAWBACK ===");
            console.log("Clawback Amount object:", tx.Amount);
            console.log("Parsed amount:", amount, "currency:", currency);
            break;
            
          default:
            console.log("=== UNHANDLED TRANSACTION TYPE ===");
            console.log("Type:", transactionType);
            console.log("Full tx object:", JSON.stringify(tx, null, 2));
            console.log("=====================================");
            direction = transactionType !== "Unknown" ? transactionType.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase() : "unknown";
            counterparty = tx.Destination || tx.destination || null;
            amount = "N/A";
        }
      
              return {
          hash: tx.hash || txData.hash || "unknown",
          ledger_index: tx.ledger_index || txData.ledger_index || null,
          date: timestamp,
          type: transactionType,
          direction,
          counterparty,
          amount,
          currency,
          fee,
          validated: validated !== false, // Default to true if not specified
          result: meta?.TransactionResult || "unknown",
          raw: txData, // Include raw data for detailed view
        };
      } catch (error) {
        console.warn("Error processing transaction:", error.message, txData);
        return null;
      }
    }).filter(tx => tx !== null); // Remove any null transactions

    console.log(`Processed ${processedTransactions.length} transactions successfully`);
    
    // Debug: Log first few processed transactions
    if (processedTransactions.length > 0) {
      console.log("Sample processed transactions:", processedTransactions.slice(0, 3));
    }

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