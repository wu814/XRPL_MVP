"use strict";

import * as xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";
import { analyzeMarket } from "../pathfind/corePathfindingEngine";
import { calculateExactAMMInput, calculateEstimateOutput } from "../amm/calculations.js";

// Helper functions to reduce redundancy
const formatCurrency = (amount, currency, issuer = null) => {
  const numAmount = parseFloat(amount);
  if (currency === "XRP") {
    return xrpl.xrpToDrops(numAmount.toFixed(6));
  }
  return {
    currency,
    issuer,
    value: numAmount.toFixed(6)
  };
};

const formatCurrencyDisplay = (amount, currency) => {
  const numAmount = parseFloat(amount);
  return currency === "XRP" ? `${numAmount.toFixed(6)} XRP` : `${numAmount.toFixed(6)} ${currency}`;
};

const getAmmPoolData = async (sendCurrency, receiveCurrency, issuerAddress) => {
  const { getAmmInfoByCurrencies } = await import('../amm/ammUtils.js');
  const liveAmmInfo = await getAmmInfoByCurrencies(sendCurrency, receiveCurrency, issuerAddress);
  
  if (!liveAmmInfo) return null;
  
  return {
    amm_account: liveAmmInfo.amm_account,
    currency_a: {
      currency: liveAmmInfo.amount.currency,
      issuer: liveAmmInfo.amount.issuer,
      value: liveAmmInfo.amount.value
    },
    currency_b: {
      currency: liveAmmInfo.amount2.currency,
      issuer: liveAmmInfo.amount2.issuer,
      value: liveAmmInfo.amount2.value
    },
    trading_fee: liveAmmInfo.trading_fee
  };
};

const mapPoolCurrencies = (pool, sendCurrency, receiveCurrency) => {
  if (pool.currency_a?.currency === sendCurrency && pool.currency_b?.currency === receiveCurrency) {
    return {
      poolSend: parseFloat(pool.currency_a.value),
      poolReceive: parseFloat(pool.currency_b.value),
      isReversed: false
    };
  } else if (pool.currency_b?.currency === sendCurrency && pool.currency_a?.currency === receiveCurrency) {
    return {
      poolSend: parseFloat(pool.currency_b.value),
      poolReceive: parseFloat(pool.currency_a.value),
      isReversed: true
    };
  }
  throw new Error(`Pool currency mismatch: expected ${sendCurrency}/${receiveCurrency}, got ${pool.currency_a?.currency}/${pool.currency_b?.currency}`);
};

const calculatePreciseAmount = async (recommendation, sendCurrency, receiveCurrency, sendAmount, issuerAddress, slippagePercent, paymentType) => {
  if (paymentType === "exact_output") {

    if (recommendation.type === 'DEX') {
      return parseFloat(sendAmount);
    }
    
    if (recommendation.type === 'AMM' && recommendation.path?.hops) {
      let cumulativeSlippage = 1.0;
      recommendation.path.hops.forEach((hop, i) => {
        cumulativeSlippage *= 1.003; // 0.3% per hop
      });
      return parseFloat(sendAmount) * cumulativeSlippage;
    }
    
    // Direct AMM calculation
    try {
      const liveAmmData = await getAmmPoolData(sendCurrency, receiveCurrency, issuerAddress);
      if (liveAmmData) {
        const { poolSend, poolReceive } = mapPoolCurrencies(liveAmmData, sendCurrency, receiveCurrency);
        const tradingFeeBasisPoints = liveAmmData.trading_fee || 0;
        
        if (paymentType === "exact_output") {
          // For exact_output: Calculate how much input is needed for exact output
          const targetOutput = parseFloat(recommendation.estimatedOutput);
          const calculation = calculateExactAMMInput(poolSend, poolReceive, targetOutput, slippagePercent / 100, tradingFeeBasisPoints);
          if (calculation.success) {
            return calculation.exactInput;
          }
        } else {
          // For exact_input: Use the exact amount specified (with slippage buffer)
          return parseFloat(sendAmount) * (1 + slippagePercent / 100);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error calculating precise amount: ${error.message}`);
    }
  }
  
  return parseFloat(sendAmount);
};

const createCounterOffer = async (senderWallet, targetAmount, receiveCurrency, sendCurrency, issuerAddress, actualRate) => {
  const requiredInput = parseFloat(targetAmount) / actualRate;
  
  const counterOfferTx = {
    TransactionType: "OfferCreate",
    Account: senderWallet.address,
    TakerGets: formatCurrency(targetAmount, receiveCurrency, issuerAddress),
    TakerPays: formatCurrency(requiredInput, sendCurrency, issuerAddress),
    Flags: 0x00040000 // tfImmediateOrCancel
  };
  
  const prepared = await client.autofill(counterOfferTx);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  
  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    return {
      success: true,
      transactionHash: result.result.hash,
      ledgerIndex: result.result.ledger_index,
      deliveredAmount: formatCurrencyDisplay(targetAmount, receiveCurrency),
      sentAmount: formatCurrencyDisplay(requiredInput, sendCurrency),
      routingMethod: "DEX (Counter-Offer)",
      exchangeRate: actualRate,
      message: `\n=== DEX TRADE COMPLETED ===\n💸 Amount Sent: ${formatCurrencyDisplay(requiredInput, sendCurrency)}\n💰 Amount Delivered: ${formatCurrencyDisplay(targetAmount, receiveCurrency)}\n📈 Exchange Rate: ${actualRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}\n🎯 Routing Method: DEX (Counter-Offer)\n📋 Ledger Index: ${result.result.ledger_index}\n============================\n`
    };
  }
  
  return { success: false };
};

const parseTransactionResult = (response, recommendation, walletObject, sendCurrency, receiveCurrency, sendMax) => {
  let actualAmountSent = "Unknown";
  let actualAmountDelivered = "Unknown";
  let actualRoutingMethod = recommendation.type;
  
  try {
    const affectedNodes = response.result.meta.AffectedNodes || [];
    let actualSentAmount = null;
    let hasAmmUsage = false;
    let hasDexOfferUsage = false;
    
    // Parse actual amounts and routing method
    affectedNodes.forEach(node => {
      const nodeData = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
      if (!nodeData) return;
      
      // Check routing method
      if (nodeData.LedgerEntryType === "AMM" || nodeData.FinalFields?.AMMID || nodeData.PreviousFields?.AMMID) {
        hasAmmUsage = true;
      }
      if (nodeData.LedgerEntryType === "Offer") {
        hasDexOfferUsage = true;
      }
      
      // Parse sent amount
      if (nodeData.LedgerEntryType === "RippleState") {
        const prevBalance = parseFloat(nodeData.PreviousFields?.Balance || 0);
        const finalBalance = parseFloat(nodeData.FinalFields?.Balance || 0);
        const balanceChange = finalBalance - prevBalance;
        
        if (balanceChange < 0) {
          const actualSent = Math.abs(balanceChange);
          if (!actualSentAmount || actualSent > actualSentAmount) {
            actualSentAmount = actualSent;
          }
        }
      }
      
      if (nodeData.LedgerEntryType === "AccountRoot" && nodeData.FinalFields?.Account === walletObject.classicAddress) {
        const prevBalance = parseFloat(nodeData.PreviousFields?.Balance || 0);
        const finalBalance = parseFloat(nodeData.FinalFields?.Balance || 0);
        const xrpChange = (prevBalance - finalBalance) / 1000000;
        
        if (sendCurrency === "XRP" && xrpChange > 0.000012) {
          actualSentAmount = xrpChange - 0.000012;
        }
      }
    });
    
    // Format amounts
    if (actualSentAmount !== null) {
      actualAmountSent = formatCurrencyDisplay(actualSentAmount, sendCurrency);
    } else {
      actualAmountSent = typeof sendMax === 'string' ? 
        `${xrpl.dropsToXrp(sendMax)} XRP (max)` : 
        `${sendMax.value} ${sendMax.currency} (max)`;
    }
    
    if (response.result.meta.delivered_amount) {
      const delivered = response.result.meta.delivered_amount;
      actualAmountDelivered = typeof delivered === 'string' ? 
        `${xrpl.dropsToXrp(delivered)} XRP` : 
        `${delivered.value} ${delivered.currency}`;
    }
    
    // Determine routing method
    if (hasAmmUsage && hasDexOfferUsage) {
      actualRoutingMethod = "Hybrid (AMM + DEX)";
    } else if (hasAmmUsage) {
      actualRoutingMethod = "AMM";
    } else if (hasDexOfferUsage) {
      actualRoutingMethod = "DEX";
    }
    
  } catch (parseError) {
    console.error("Error parsing transaction amounts:", parseError.message);
  }
  
  return { actualAmountSent, actualAmountDelivered, actualRoutingMethod };
};

/**
 * Send a cross-currency payment using smart pathfinding (AMM + DEX combined)
 */
export async function sendCrossCurrency(
  senderWallet, 
  destinationAddress, 
  sendCurrency, 
  sendAmount, 
  receiveCurrency, 
  issuerAddress,
  slippagePercent = 0,
  destinationTag = null,
  paymentType = "exact_input",
  exactOutputAmount = null
) {
  try {
    await connectXrplClient();
    
    console.log(`🎯 Smart Cross-Currency Payment: ${senderWallet.classicAddress} → ${destinationAddress}`);
    console.log(`💰 ${paymentType === "exact_input" ? 
      `Send ${sendAmount} ${sendCurrency} → Get ${receiveCurrency}` : 
      `Pay ${sendCurrency} → Get exactly ${exactOutputAmount} ${receiveCurrency}`}`);
    
    // Step 1: Handle exact output calculation
    if (paymentType === "exact_output") {
      console.log(`🧮 Calculating required input for ${exactOutputAmount} ${receiveCurrency}...`);
      
      try {
        const directPool = await getAmmPoolData(sendCurrency, receiveCurrency);
        if (!directPool) {
          throw new Error(`Could not find ${sendCurrency}/${receiveCurrency} AMM pool`);
        }
        
        const { poolSend, poolReceive } = mapPoolCurrencies(directPool, sendCurrency, receiveCurrency);
        const tradingFeeBasisPoints = directPool.trading_fee || 0;
        
        const calculation = calculateExactAMMInput(poolSend, poolReceive, parseFloat(exactOutputAmount), slippagePercent / 100, tradingFeeBasisPoints);
        if (!calculation.success) {
          throw new Error(`AMM calculation failed: ${calculation.error}`);
        }
        
        sendAmount = calculation.inputWithSlippage.toString();
        console.log(`✅ Calculated input: ${sendAmount} ${sendCurrency}`);
        
      } catch (calcError) {
        throw new Error(`Failed to calculate required input: ${calcError.message}`);
      }
    }
    
    // Step 2: Run market analysis
    const pathfindingResult = await analyzeMarket(
      sendCurrency,
      receiveCurrency,
      sendAmount,
      issuerAddress,
      {
        purpose: paymentType === "exact_input" ? 'cross_currency_payment' : 'exact_output_analysis',
        targetOutput: exactOutputAmount ? parseFloat(exactOutputAmount) : undefined,
        includeAMM: true,
        includeDEX: true,
        includeHybrid: true
      }
    );
    
    if (!pathfindingResult.success) {
      throw new Error("No viable payment paths found. Check liquidity, trustlines, and restrictions.");
    }
    
    const recommendation = pathfindingResult.bestRoute;
    console.log(`🏆 Optimal route: ${recommendation.type} (Rate: ${recommendation.rate.toFixed(6)})`);
    
    // Step 3: Handle exact output rate optimization
    if (paymentType === "exact_output" && pathfindingResult.success) {
      const optimalRate = recommendation.rate;
      const requiredInput = parseFloat(exactOutputAmount) / optimalRate;
      const executionBuffer = 1 + (slippagePercent / 100);
      sendAmount = (requiredInput * executionBuffer).toString();
      
      console.log(`🔄 Optimized input: ${sendAmount} ${sendCurrency} (${slippagePercent}% buffer)`);
      recommendation.estimatedOutput = exactOutputAmount;
    }
    
    // Step 4: Calculate precise amounts
    const preciseInputNeeded = await calculatePreciseAmount(
      recommendation, sendCurrency, receiveCurrency, sendAmount, issuerAddress, slippagePercent, paymentType
    );
    
    const sendMax = formatCurrency(preciseInputNeeded, sendCurrency, issuerAddress);
    
    // Step 5: Handle DEX routing via counter-offer
    if (recommendation.type === 'DEX') {
      console.log("🔧 Executing DEX trade via counter-offer...");
      const targetAmount = paymentType === "exact_output" ? exactOutputAmount : recommendation.estimatedOutput;
      
      const counterResult = await createCounterOffer(
        senderWallet, targetAmount, receiveCurrency, sendCurrency, issuerAddress, recommendation.rate
      );
      
      if (counterResult.success) {
        return counterResult;
      }
      
      console.log("🔄 Counter-offer failed, falling back to payment transaction");
    }
    
    // Step 6: Calculate destination amount
    let destinationAmount;
    if (paymentType === "exact_output") {
      destinationAmount = formatCurrency(exactOutputAmount, receiveCurrency, issuerAddress);
    } else {
      let preciseOutput;
      if (recommendation.type === 'DEX') {
        preciseOutput = parseFloat(sendAmount) * recommendation.rate;
        // Convert to exact output for DEX reliability
        exactOutputAmount = preciseOutput.toFixed(6);
        paymentType = "exact_output";
      } else {
        preciseOutput = parseFloat(recommendation.estimatedOutput);
      }
      destinationAmount = formatCurrency(preciseOutput, receiveCurrency, issuerAddress);
    }
    
    // Step 7: Check trustline compatibility
    let hasTrustlineRisk = false;
    if (receiveCurrency !== "XRP") {
      try {
        const destLines = await client.request({
          command: "account_lines",
          account: destinationAddress,
          peer: issuerAddress
        });
        
        hasTrustlineRisk = !destLines.result.lines.some(line => 
          line.currency === receiveCurrency && line.account === issuerAddress
        );
        
        if (hasTrustlineRisk) {
          console.log(`⚠️ Trustline risk detected - may need multi-hop routing`);
        }
      } catch (error) {
        hasTrustlineRisk = true;
      }
    }
    
    // Step 8: Construct and submit payment transaction
    const paymentTx = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: destinationAddress,
      SendMax: sendMax,
      Amount: destinationAmount,
      Flags: 0x00020000 // tfPartialPayments
    };
    
    if (destinationTag !== null) {
      paymentTx.DestinationTag = destinationTag;
    }
    
    // Add explicit path for multi-hop routing
    if (recommendation.path?.hops?.length > 0 && recommendation.path.intermediateCurrency) {
      const intermediateCurrency = recommendation.path.intermediateCurrency;
      const explicitPath = [];
      
      if (intermediateCurrency === 'XRP') {
        explicitPath.push({ currency: 'XRP' });
      } else {
        explicitPath.push({ currency: intermediateCurrency, issuer: issuerAddress });
      }
      
      paymentTx.Paths = [explicitPath];
      console.log(`🔗 Using explicit path: ${recommendation.path.path}`);
    }
    
    console.log("🚀 Submitting payment transaction...");
    
    const preparedTx = await client.autofill(paymentTx);
    const currentLedger = await client.request({ command: "ledger_current" });
    preparedTx.LastLedgerSequence = currentLedger.result.ledger_current_index + 100;
    
    const walletObject = senderWallet.seed && !senderWallet.sign ? 
      xrpl.Wallet.fromSeed(senderWallet.seed) : senderWallet;
    
    const signedTx = walletObject.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Payment successful!");
      
      const { actualAmountSent, actualAmountDelivered, actualRoutingMethod } = parseTransactionResult(
        response, recommendation, walletObject, sendCurrency, receiveCurrency, sendMax
      );
      
      const displayRate = recommendation.rate;
      const rateLabel = receiveCurrency === 'XRP' && sendCurrency !== 'XRP' ? 
        `XRP per ${sendCurrency}` : 
        sendCurrency === 'XRP' && receiveCurrency !== 'XRP' ? 
          `${receiveCurrency} per XRP` : 
          `${receiveCurrency}/${sendCurrency}`;
      
      const message = `\n=== Smart Cross-Currency Payment Details ===\n👛 From: ${walletObject.classicAddress}\n👛 To: ${destinationAddress}\n💸 Amount Sent: ${actualAmountSent}\n💰 Amount Delivered: ${actualAmountDelivered}\n🎯 Routing Method: ${actualRoutingMethod}\n📈 Exchange Rate: ${displayRate.toFixed(6)} ${rateLabel}\n📋 Transaction Hash: ${response.result.hash}\n📋 Ledger Index: ${response.result.ledger_index}\n`;
      
      return {
        success: true,
        txHash: response.result.hash,
        ledgerIndex: response.result.ledger_index,
        amountSent: actualAmountSent,
        amountDelivered: actualAmountDelivered,
        routingMethod: actualRoutingMethod,
        exchangeRate: recommendation.rate,
        pathfindingResult: pathfindingResult,
        response: response,
        message: message
      };
    } else {
      throw new Error(`Payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Cross-currency payment error:", error.message);
    throw error;
  }
}
