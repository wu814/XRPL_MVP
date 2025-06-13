import * as xrpl from "xrpl";
import { client, connectXrplClient } from "../testnet";
import { findBestPath } from "../pathfind/pathfindEngine";
import BigNumber from "bignumber.js";
import { getAllAmmInfo } from "../amm/getAmmInfo";

/**
 * Send a cross-currency payment using smart pathfinding (AMM + DEX combined)
 * @param {Wallet} senderWallet - The wallet sending the payment
 * @param {string} destinationAddress - The recipient's address
 * @param {string} sendCurrency - Currency the sender wants to pay with
 * @param {string} sendAmount - Amount the sender wants to pay
 * @param {string} receiveCurrency - Currency the recipient should receive
 * @param {string} issuerAddress - The issuer address for currencies
 * @param {number} slippagePercent - Slippage tolerance percentage (e.g., 5 for 5%)
 * @param {number} destinationTag - Optional destination tag
 * @returns {object} Transaction result
 */
export async function sendCrossCurrency (
  wallet, 
  destinationAddress, 
  sendCurrency, 
  sendAmount, 
  receiveCurrency, 
  issuerAddress,
  slippagePercent = 5,
  destinationTag = null
) {
  try {
    await connectXrplClient();
    
    console.log("🎯 Smart Cross-Currency Payment (AMM + DEX pathfinding)...");
    console.log(`Sender: ${wallet.classicAddress}`);
    console.log(`Destination: ${destinationAddress}`);
    console.log(`Send: ${sendAmount} ${sendCurrency}`);
    console.log(`Convert to: ${receiveCurrency}`);
    console.log(`Slippage Tolerance: ${slippagePercent}%`);

    // generate a wallet from the seed
    const senderWallet = xrpl.Wallet.fromSeed(wallet.seed);
    
    // Step 1: Use smart pathfinding to find the best route
    const pathfindingResult = await findBestPath(
      senderWallet.classicAddress,
      destinationAddress,
      sendCurrency,
      receiveCurrency,
      sendAmount,
      issuerAddress
    );
    
    if (!pathfindingResult.success) {
      throw new Error("No viable payment paths found. This could be due to: (1) Insufficient liquidity in AMMs/order books, (2) Missing trustlines, (3) DepositAuth restrictions, or (4) Pathfinding limitations. Try a smaller amount or different currency pair.");
    }
    
    const recommendation = pathfindingResult.recommendation;
    console.log(`🏆 Optimal route: ${pathfindingResult.winner} (Rate: ${recommendation.rate.toFixed(6)})`);
    console.log(`💰 Expected output: ${recommendation.estimatedOutput} ${receiveCurrency}`);
    
    // Step 2: Construct send amount with slippage
    let sendMax;
    if (sendCurrency === "XRP") {
      const maxAmountXRP = new BigNumber(parseFloat(sendAmount) * (1 + slippagePercent / 100));
      sendMax = xrpl.xrpToDrops(maxAmountXRP.toFixed(6));
    } else {
      const maxAmountValue = new BigNumber(parseFloat(sendAmount) * (1 + slippagePercent / 100));
      sendMax = {
        currency: sendCurrency,
        issuer: issuerAddress,
        value: maxAmountValue.toFixed(6)
      };
    }
    
    // Step 3: Construct destination amount based on smart pathfinding result
    let destinationCurrency;
    if (receiveCurrency === "XRP") {
      // Use estimated output with some buffer to ensure conversion
      const targetXRP = parseFloat(recommendation.estimatedOutput) * 1.1; // 10% buffer
      destinationCurrency = xrpl.xrpToDrops(Math.max(targetXRP, 0.000001).toFixed(6));
    } else {
      // Use estimated output with buffer  
      const targetAmount = parseFloat(recommendation.estimatedOutput) * 1.1; // 10% buffer
      destinationCurrency = {
        currency: receiveCurrency,
        issuer: issuerAddress,
        value: Math.max(targetAmount, 0.000001).toFixed(6)
      };
    }
    
    console.log(`🎯 Target destination amount: ${typeof destinationCurrency === 'string' ? xrpl.dropsToXrp(destinationCurrency) + ' XRP' : destinationCurrency.value + ' ' + destinationCurrency.currency}`);
    
    // Step 4: Extract paths from smart pathfinding result
    let pathsSet = [];
    if (recommendation.path && recommendation.path.path) {
      pathsSet = [recommendation.path.path];
    } else if (recommendation.path && recommendation.path.paths) {
      pathsSet = recommendation.path.paths;
    }
    
    console.log(`✅ Using ${pathfindingResult.winner} routing with ${pathsSet.length} path(s)`);
    if (pathsSet.length > 0) {
      console.log("🛤️ Paths:", JSON.stringify(pathsSet, null, 2));
    }
    
    // Step 5: Calculate proper flags for optimal routing
    let flags = 0x00020000; // tfPartialPayments - essential for cross-currency routing
    
    // Add tfNoRippleDirect if we have explicit paths to force using our optimized routing
    if (pathsSet.length > 0) {
      flags |= 0x00010000; // tfNoRippleDirect - force using explicit paths only
      console.log("🔧 Using explicit paths with partial payments for optimal routing");
    } else {
      console.log("🔧 Using partial payments with XRPL default routing");
    }
    
    // Step 6: Construct and submit transaction
    const paymentTx = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: destinationAddress,
      SendMax: sendMax,
      Amount: destinationCurrency,
      Flags: flags
    };
    
    // Only add paths if we have them (for complex routing)
    if (pathsSet.length > 0) {
      paymentTx.Paths = pathsSet;
    }
    
    // Add destination tag if provided
    if (destinationTag !== null) {
      paymentTx.DestinationTag = destinationTag;
    }
    
    console.log("\n📜 Prepared Smart Cross-Currency Payment TX:");
    console.log(JSON.stringify(paymentTx, null, 2));
    
    // Prepare and submit the transaction
    const preparedTx = await client.autofill(paymentTx);
    
    // Increase LastLedgerSequence buffer to prevent timeout issues
    const currentLedger = await client.request({ command: "ledger_current" });
    preparedTx.LastLedgerSequence = currentLedger.result.ledger_current_index + 100; // Large buffer
    
    const signedTx = senderWallet.sign(preparedTx);
    
    console.log("🚀 Submitting smart cross-currency payment...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Smart cross-currency payment successful!");
      
      // Parse transaction metadata to get actual amounts and detect routing method
      let actualAmountSent = "Unknown";
      let actualAmountDelivered = "Unknown";
      let actualRoutingMethod = pathfindingResult.winner;
      
      try {
        // For successful transactions, we can use SendMax as a good approximation of amount sent
        if (typeof sendMax === 'string') {
          actualAmountSent = `${xrpl.dropsToXrp(sendMax)} XRP (max)`;
        } else {
          actualAmountSent = `${sendMax.value} ${sendMax.currency} (max)`;
        }
        
        // The delivered_amount field shows what was actually delivered
        if (response.result.meta.delivered_amount) {
          const delivered = response.result.meta.delivered_amount;
          actualAmountDelivered = typeof delivered === 'string' ? 
            `${xrpl.dropsToXrp(delivered)} XRP` : 
            `${delivered.value} ${delivered.currency}`;
        }
        
        // Analyze AffectedNodes to detect hybrid routing (AMM + DEX)
        const affectedNodes = response.result.meta.AffectedNodes || [];
        let hasAmmUsage = false;
        let hasDexOfferUsage = false;
        
        affectedNodes.forEach(node => {
          // ENHANCED: More precise AMM detection - check for AMM-specific ledger entries
          if (node.ModifiedNode || node.CreatedNode || node.DeletedNode) {
            const nodeData = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
            
            // Check for AMM-specific ledger entry types
            if (nodeData.LedgerEntryType === "AMM") {
              hasAmmUsage = true;
              console.log(`🔍 Detected AMM ledger entry modification`);
            }
            
            // Check for AMM VoteSlots (AMM voting mechanics)
            if (nodeData.LedgerEntryType === "VoteSlot") {
              hasAmmUsage = true;
              console.log(`🔍 Detected AMM VoteSlot modification`);
            }
            
            // Check for AMM auction slots
            if (nodeData.LedgerEntryType === "AuctionSlot") {
              hasAmmUsage = true;
              console.log(`🔍 Detected AMM AuctionSlot modification`);
            }
            
            // ENHANCED: Check for AMM account modifications (accounts with AMMID field)
            if (nodeData.LedgerEntryType === "AccountRoot" && 
                (nodeData.FinalFields?.AMMID || nodeData.PreviousFields?.AMMID)) {
              hasAmmUsage = true;
              const ammId = nodeData.FinalFields?.AMMID || nodeData.PreviousFields?.AMMID;
              console.log(`🔍 Detected AMM account modification (AMMID: ${ammId})`);
            }
          }
          
          // Check for DEX offer modifications (traditional order book)
          if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "Offer") {
            hasDexOfferUsage = true;
            console.log(`🔍 Detected DEX offer modification`);
          }
          
          // Also check deleted offers (fully consumed DEX offers)
          if (node.DeletedNode && node.DeletedNode.LedgerEntryType === "Offer") {
            hasDexOfferUsage = true;
            console.log(`🔍 Detected DEX offer deletion (fully consumed)`);
          }
        });
        
        // Determine actual routing method based on usage
        if (hasAmmUsage && hasDexOfferUsage) {
          actualRoutingMethod = "Hybrid (AMM + DEX)";
        } else if (hasDexOfferUsage && pathfindingResult.winner === "AMM") {
          // If pathfinding said AMM but we only see DEX usage, correct it
          actualRoutingMethod = "DEX";
        } else if (hasAmmUsage && pathfindingResult.winner === "DEX") {
          // If pathfinding said DEX but we only see AMM usage, correct it  
          actualRoutingMethod = "AMM";
        }
        // Otherwise keep the original pathfindingResult.winner
        
        console.log(`🔍 Routing analysis: AMM usage: ${hasAmmUsage}, DEX usage: ${hasDexOfferUsage}`);
        
      } catch (parseError) {
        console.error("Error parsing transaction amounts:", parseError.message);
      }
      
      // Create user-friendly rate display for the exchange rate
      let displayRate = recommendation.rate;
      let rateLabel = `${receiveCurrency}/${sendCurrency}`;
      
      if (receiveCurrency === 'XRP' && sendCurrency !== 'XRP') {
        rateLabel = `XRP per ${sendCurrency}`;
      } else if (sendCurrency === 'XRP' && receiveCurrency !== 'XRP') {
        rateLabel = `${receiveCurrency} per XRP`;
      }
      
      // Build message string for return 
      let message = `\n===== Smart Cross-Currency Payment Details =====\n`;
      message += `👛 From: ${senderWallet.classicAddress}\n`;
      message += `👛 To: ${destinationAddress}\n`;
      message += `💸 Amount Sent: ${actualAmountSent}\n`;
      message += `💰 Amount Delivered: ${actualAmountDelivered}\n`;
      message += `🎯 Routing Method: ${actualRoutingMethod}\n`;
      message += `\n📈 Exchange Rate: ${displayRate.toFixed(6)} ${rateLabel}\n`;
      message += `📋 Transaction Hash: ${response.result.hash}\n`;
      message += `📋 Ledger Index: ${response.result.ledger_index}\n`;
      
      
      return {
        success: true,
        txHash: response.result.hash,
        ledgerIndex: response.result.ledger_index,
        amountSent: actualAmountSent,
        amountDelivered: actualAmountDelivered,
        routingMethod: actualRoutingMethod,
        exchangeRate: recommendation.rate,
        pathfindingResult: pathfindingResult,
        message
      };
    } else {
      throw new Error(`Smart cross-currency payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error in smart cross-currency payment:", error.message);
    throw error;
  }
};

/**
 * Send a cross-currency payment using AMM-only pathfinding (legacy/API endpoint)
 * This preserves the original AMM-only logic for backwards compatibility and API endpoints
 * @param {Wallet} senderWallet - The wallet sending the payment
 * @param {string} destinationAddress - The recipient's address
 * @param {string} sendCurrency - Currency the sender wants to pay with
 * @param {string} sendAmount - Amount the sender wants to pay
 * @param {string} receiveCurrency - Currency the recipient should receive
 * @param {string} issuerAddress - The issuer address for currencies
 * @param {number} slippagePercent - Slippage tolerance percentage (e.g., 5 for 5%)
 * @param {number} destinationTag - Optional destination tag
 * @returns {object} Transaction result
 */
 export async function sendCrossCurrencyAmmOnly (
  senderWallet, 
  destinationAddress, 
  sendCurrency, 
  sendAmount, 
  receiveCurrency, 
  issuerAddress,
  slippagePercent = 5,
  destinationTag = null
) {
  try {
    await connectXrplClient();
    
    console.log("🔍 AMM-Only Cross-Currency Payment...");
    console.log(`Sender: ${senderWallet.classicAddress}`);
    console.log(`Destination: ${destinationAddress}`);
    console.log(`Send: ${sendAmount} ${sendCurrency}`);
    console.log(`Convert to: ${receiveCurrency}`);
    console.log(`Slippage Tolerance: ${slippagePercent}%`);
    
    // Construct send amount
    let sendMax;
    if (sendCurrency === "XRP") {
      const maxAmountXRP = parseFloat(sendAmount) * (1 + slippagePercent / 100);
      sendMax = xrpl.xrpToDrops(maxAmountXRP.toFixed(6));
    } else {
      const maxAmountValue = parseFloat(sendAmount) * (1 + slippagePercent / 100);
      sendMax = {
        currency: sendCurrency,
        issuer: issuerAddress,
        value: maxAmountValue.toFixed(6)
      };
    }
    
    // Construct source currencies
    let sourceCurrencies = [];
    if (sendCurrency === "XRP") {
      sourceCurrencies.push({ currency: "XRP" });
    } else {
      sourceCurrencies.push({
        currency: sendCurrency,
        issuer: issuerAddress
      });
    }
    
    console.log("🔍 Source currencies for pathfinding:", sourceCurrencies);
    
    // For cross-currency conversion through AMMs, use high target amounts
    let destinationCurrency;
    if (receiveCurrency === "XRP") {
      const highTargetMultiplier = 100;
      const targetXRP = parseFloat(sendAmount) * highTargetMultiplier;
      destinationCurrency = xrpl.xrpToDrops(Math.max(targetXRP, 10).toFixed(6));
    } else {
      const highTargetMultiplier = 100;
      const targetAmount = parseFloat(sendAmount) * highTargetMultiplier;
      
      destinationCurrency = {
        currency: receiveCurrency,
        issuer: issuerAddress,
        value: Math.max(targetAmount, 1000).toFixed(6)
      };
    }
    
    console.log(`🎯 Target destination amount: ${typeof destinationCurrency === 'string' ? xrpl.dropsToXrp(destinationCurrency) + ' XRP' : destinationCurrency.value + ' ' + destinationCurrency.currency}`);
    
    // Try simple pathfinding first
    const pathfindRequest = {
      command: "ripple_path_find",
      source_account: senderWallet.classicAddress,
      destination_account: destinationAddress,
      destination_amount: destinationCurrency,
      source_currencies: sourceCurrencies
    };
    
    console.log("📜 Pathfind Request:", JSON.stringify(pathfindRequest, null, 2));
    
    let pathfindResponse;
    let useFallbackPaths = false;
    
    try {
      pathfindResponse = await client.request(pathfindRequest);
    } catch (pathfindError) {
      console.log("⚠️ Simple pathfind failed, will use manual multi-hop path construction");
      useFallbackPaths = true;
    }
    
    // Check if we have viable paths
    if (!useFallbackPaths && (!pathfindResponse.result.alternatives || pathfindResponse.result.alternatives.length === 0)) {
      console.log("❌ No direct paths found. Using manual multi-hop path construction...");
      useFallbackPaths = true;
    }
    
    let pathsSet = [];
    
    if (useFallbackPaths) {
      // Manual multi-hop path construction for AMM swaps
      console.log("🔧 Constructing manual multi-hop AMM path...");
      
      // Find intermediate currency from AMM data
      let intermediateCurrency = null;
      
      try {
        const ammData = await getAllAmmInfo();
        
        // Find an AMM that has our send currency and a potential intermediate
        for (const [ammId, amm] of Object.entries(ammData)) {
          const hasSendCurrency = (
            (sendCurrency === "XRP" && (amm.currency_a?.currency === "XRP" || amm.currency_b?.currency === "XRP")) ||
            (sendCurrency !== "XRP" && (amm.currency_a?.currency === sendCurrency || amm.currency_b?.currency === sendCurrency))
          );
          
          if (hasSendCurrency) {
            let potentialIntermediate = null;
            if (sendCurrency === "XRP") {
              potentialIntermediate = amm.currency_a?.currency === "XRP" ? amm.currency_b?.currency : amm.currency_a?.currency;
            } else {
              potentialIntermediate = amm.currency_a?.currency === sendCurrency ? amm.currency_b?.currency : amm.currency_a?.currency;
            }
            
            if (potentialIntermediate && potentialIntermediate !== receiveCurrency) {
              // Check if there's another AMM with this intermediate and our destination currency
              for (const [ammId2, amm2] of Object.entries(ammData)) {
                if (ammId2 !== ammId) {
                  const hasIntermediate = (potentialIntermediate === "XRP" && (amm2.currency_a?.currency === "XRP" || amm2.currency_b?.currency === "XRP")) ||
                                        (potentialIntermediate !== "XRP" && (amm2.currency_a?.currency === potentialIntermediate || amm2.currency_b?.currency === potentialIntermediate));
                  
                  const hasDestination = (receiveCurrency === "XRP" && (amm2.currency_a?.currency === "XRP" || amm2.currency_b?.currency === "XRP")) ||
                                       (receiveCurrency !== "XRP" && (amm2.currency_a?.currency === receiveCurrency || amm2.currency_b?.currency === receiveCurrency));
                  
                  if (hasIntermediate && hasDestination) {
                    intermediateCurrency = potentialIntermediate;
                    console.log(`✅ Found multi-hop path: ${sendCurrency} → ${intermediateCurrency} → ${receiveCurrency}`);
                    break;
                  }
                }
              }
              
              if (intermediateCurrency) break;
            }
          }
        }
      } catch (ammError) {
        console.log("⚠️ Could not load AMM data for path construction");
      }
      
      if (intermediateCurrency) {
        // Construct manual multi-hop path
        const manualPath = [];
        
        if (intermediateCurrency === "XRP") {
          manualPath.push({ currency: "XRP", type: 48 });
        } else {
          manualPath.push({ 
            currency: intermediateCurrency, 
            issuer: issuerAddress, 
            type: 48 
          });
        }
        
        if (receiveCurrency === "XRP") {
          manualPath.push({ currency: "XRP", type: 48 });
        } else {
          manualPath.push({ 
            currency: receiveCurrency, 
            issuer: issuerAddress, 
            type: 48 
          });
        }
        
        pathsSet = [manualPath];
        console.log("🛤️ Constructed manual multi-hop path:", JSON.stringify(pathsSet, null, 2));
        
        // Create a fake pathfind response to use existing logic
        pathfindResponse = {
          result: {
            alternatives: [{
              paths_computed: pathsSet,
              source_amount: xrpl.xrpToDrops(sendAmount)
            }]
          }
        };
      } else {
        console.log("⚠️ Could not find suitable multi-hop path, trying fallback");
        pathfindResponse = {
          result: {
            alternatives: [{
              paths_computed: [],
              source_amount: xrpl.xrpToDrops(sendAmount)
            }]
          }
        };
      }
    } else {
      console.log("✅ Direct pathfinding successful");
      
      const bestAlternative = pathfindResponse.result.alternatives[0];
      if (bestAlternative.paths_computed && bestAlternative.paths_computed.length > 0) {
        pathsSet = bestAlternative.paths_computed;
      } else if (bestAlternative.paths_canonical && bestAlternative.paths_canonical.length > 0) {
        pathsSet = bestAlternative.paths_canonical;
      } else if (bestAlternative.paths && bestAlternative.paths.length > 0) {
        pathsSet = bestAlternative.paths;
      }
    }
    
    if (!pathfindResponse.result.alternatives || pathfindResponse.result.alternatives.length === 0) {
      throw new Error("No payment paths found between the specified currencies. This could be due to: (1) Insufficient liquidity in AMMs/order books, (2) Missing trustlines, (3) DepositAuth restrictions, or (4) Pathfinding limitations. Try a smaller amount or different currency pair.");
    }
    
    console.log(`✅ Found ${pathfindResponse.result.alternatives.length} payment path(s)`);
    console.log(`🛤️ Paths: ${pathsSet.length} path(s) available`);
    
    // Calculate proper flags - need partial payments for AMM cross-currency
    let flags = 0x00020000; // tfPartialPayments - essential for cross-currency AMM routing
    
    if (pathsSet.length > 0) {
      flags |= 0x00010000; // tfNoRippleDirect - force using explicit paths only
      console.log("🔧 Using explicit paths with partial payments");
    } else {
      console.log("🔧 Using partial payments with XRPL default routing (including AMMs)");
    }
    
    const paymentTx = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: destinationAddress,
      SendMax: sendMax,
      Amount: destinationCurrency,
      Flags: flags
    };
    
    if (pathsSet.length > 0) {
      paymentTx.Paths = pathsSet;
    }
    
    if (destinationTag !== null) {
      paymentTx.DestinationTag = destinationTag;
    }
    
    console.log("\n📜 Prepared AMM-Only Cross-Currency Payment TX:");
    console.log(JSON.stringify(paymentTx, null, 2));
    
    const preparedTx = await client.autofill(paymentTx);
    
    const currentLedger = await client.request({ command: "ledger_current" });
    preparedTx.LastLedgerSequence = currentLedger.result.ledger_current_index + 100;
    
    const signedTx = senderWallet.sign(preparedTx);
    
    console.log("🚀 Submitting AMM-only cross-currency payment...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ AMM-only cross-currency payment successful!");
      
      let actualAmountSent = "Unknown";
      let actualAmountDelivered = "Unknown";
      
      try {
        if (typeof sendMax === 'string') {
          actualAmountSent = `${xrpl.dropsToXrp(sendMax)} XRP (max)`;
        } else {
          actualAmountSent = `${sendMax.value} ${sendMax.currency} (max)`;
        }
        
        if (response.result.meta.delivered_amount) {
          const delivered = response.result.meta.delivered_amount;
          actualAmountDelivered = typeof delivered === 'string' ? 
            `${xrpl.dropsToXrp(delivered)} XRP` : 
            `${delivered.value} ${delivered.currency}`;
        }
      } catch (parseError) {
        console.error("Error parsing transaction amounts:", parseError.message);
      }
      
      console.log("\n=== AMM-Only Cross-Currency Payment Details ===");
      console.log(`👛 From: ${senderWallet.classicAddress}`);
      console.log(`👛 To: ${destinationAddress}`);
      console.log(`💸 Amount Sent: ${actualAmountSent}`);
      console.log(`💰 Amount Delivered: ${actualAmountDelivered}`);
      console.log(`🎯 Routing Method: AMM-Only`);
      console.log(`📋 Transaction Hash: ${response.result.hash}`);
      console.log(`📋 Ledger Index: ${response.result.ledger_index}`);
      
      return {
        success: true,
        txHash: response.result.hash,
        ledgerIndex: response.result.ledger_index,
        amountSent: actualAmountSent,
        amountDelivered: actualAmountDelivered,
        routingMethod: "AMM-Only",
        response: response
      };
    } else {
      throw new Error(`AMM-only cross-currency payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error in AMM-only cross-currency payment:", error.message);
    throw error;
  }
};

