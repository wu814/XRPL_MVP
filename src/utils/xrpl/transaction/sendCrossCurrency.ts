"use strict";

import * as xrpl from "xrpl";
import { connectXRPLClient, client } from "../testnet";
import { analyzeMarket } from "../pathfind/corePathfindingEngine";
import { calculateExactAMMInput, calculateEstimateOutput } from "../amm/calculations.js";
import { getFormattedAMMInfoByCurrencies } from "../amm/ammUtils.js";
import { FormattedAMMInfo } from "@/types/xrpl/index";
import BigNumber from 'bignumber.js';

// Type definitions
interface CurrencyAmount {
  currency: string;
  issuer?: string;
  value: string;
}


interface PoolCurrencyMapping {
  poolSend: number;
  poolReceive: number;
  isReversed: boolean;
}

interface CounterOfferResult {
  success: boolean;
  transactionHash?: string;
  ledgerIndex?: number;
  deliveredAmount?: number;
  sentAmount?: number;
  routingMethod?: string;
  exchangeRate?: number;
  message?: string;
}

interface TransactionResult {
  actualAmountSent: number;
  actualAmountDelivered: number;
  actualRoutingMethod: string;
}

interface PaymentTransaction {
  TransactionType: "Payment";
  Account: string;
  Destination: string;
  SendMax: string | CurrencyAmount;
  Amount: string | CurrencyAmount;
  Flags: number;
  DestinationTag?: number;
  Paths?: Array<Array<{ currency: string; issuer?: string }>>;
}

interface SendCrossCurrencyParams {
  senderWallet: xrpl.Wallet;
  destinationAddress: string;
  sendCurrency: string;
  sendAmount: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  destinationTag?: number | null;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number | null;
}

interface SendCrossCurrencyResponse {
  success: boolean;
  txHash?: string;
  ledgerIndex?: number;
  amountSent?: number;
  amountDelivered?: number;
  routingMethod?: string;
  exchangeRate?: number;
  pathfindingResult?: any;
  response?: any;
  message?: string;
}

interface XRPLResponse {
  result: {
    meta: {
      TransactionResult: string;
      delivered_amount?: any;
      AffectedNodes?: any[];
    };
    hash: string;
    ledger_index?: number;
  };
}

interface LedgerResponse {
  result: {
    ledger_current_index: number;
  };
}

interface AccountLinesResponse {
  result: {
    lines: Array<{
      currency: string;
      account: string;
      [key: string]: any;
    }>;
  };
}

// Helper functions to reduce redundancy
const formatCurrency = (
  amount: string | number, 
  currency: string, 
  issuer: string | null = null, 
  preserveExactValue: boolean = false
): string | CurrencyAmount => {
  const numAmount = parseFloat(amount.toString());
  if (currency === "XRP") {
    // For XRP, use exact value for precise payments
    return xrpl.xrpToDrops(numAmount.toFixed(6));
  }
  return {
    currency,
    issuer: issuer || undefined,
    value: preserveExactValue ? numAmount.toString() : numAmount.toFixed(6)
  };
};


const mapPoolCurrencies = (
  pool: FormattedAMMInfo, 
  sendCurrency: string, 
  receiveCurrency: string
): PoolCurrencyMapping => {
  if (pool.formattedAmount1?.currency === sendCurrency && pool.formattedAmount2?.currency === receiveCurrency) {
    return {
      poolSend: parseFloat(pool.formattedAmount1.value),
      poolReceive: parseFloat(pool.formattedAmount2.value),
      isReversed: false
    };
  } else if (pool.formattedAmount2?.currency === sendCurrency && pool.formattedAmount1?.currency === receiveCurrency) {
    return {
      poolSend: parseFloat(pool.formattedAmount2.value),
      poolReceive: parseFloat(pool.formattedAmount1.value),
      isReversed: true
    };
  }
  throw new Error(`Pool currency mismatch: expected ${sendCurrency}/${receiveCurrency}, got ${pool.formattedAmount1?.currency}/${pool.formattedAmount2?.currency}`);
};

const calculatePreciseAmount = async (
  recommendation: any, 
  sendCurrency: string, 
  receiveCurrency: string, 
  sendAmount: string | number, 
  slippagePercent: number, 
  paymentType: string
): Promise<number> => {
  if (paymentType === "exact_output") {

    if (recommendation.type === 'DEX') {
      return parseFloat(sendAmount.toString());
    }
    
    if (recommendation.type === 'AMM' && recommendation.path?.hops) {
      let cumulativeSlippage = 1.0;
      recommendation.path.hops.forEach((hop: any, i: number) => {
        cumulativeSlippage *= 1.003; // 0.3% per hop
      });
      return parseFloat(sendAmount.toString()) * cumulativeSlippage;
    }
    
    // Direct AMM calculation
    try {
      const liveFormattedAMMInfo = await getFormattedAMMInfoByCurrencies(sendCurrency, receiveCurrency);
      if (liveFormattedAMMInfo) {
        const { poolSend, poolReceive } = mapPoolCurrencies(liveFormattedAMMInfo, sendCurrency, receiveCurrency);
        const tradingFeeBasisPoints = liveFormattedAMMInfo.tradingFee || 0;
        
        if (paymentType === "exact_output") {
          // For exact_output: Calculate how much input is needed for exact output
          const targetOutput = parseFloat(recommendation.estimatedOutput);
          const calculation = calculateExactAMMInput(poolSend, poolReceive, targetOutput, slippagePercent / 100, tradingFeeBasisPoints);
          if (calculation.success) {
            return calculation.inputWithSlippage; // Use inputWithSlippage instead of exactInput
          }
        } else {
          // For exact_input: Use the exact amount specified (with slippage buffer)
          return parseFloat(sendAmount.toString()) * (1 + slippagePercent / 100);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error calculating precise amount: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return parseFloat(sendAmount.toString());
};

const createCounterOffer = async (
  senderWallet: xrpl.Wallet, 
  targetAmount: string | number, 
  receiveCurrency: string, 
  sendCurrency: string, 
  issuerAddress: string, 
  actualRate: number
): Promise<CounterOfferResult> => {
  const requiredInput = parseFloat(targetAmount.toString()) / actualRate;
  
  const counterOfferTx = {
    TransactionType: "OfferCreate" as const,
    Account: senderWallet.address,
    TakerGets: formatCurrency(targetAmount, receiveCurrency, issuerAddress) as any,
    TakerPays: formatCurrency(requiredInput, sendCurrency, issuerAddress) as any,
    Flags: 0x00040000 // tfImmediateOrCancel
  };
  
  const prepared = await client.autofill(counterOfferTx);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob) as XRPLResponse;
  
  if (result.result.meta.TransactionResult === "tesSUCCESS") {
    return {
      success: true,
      transactionHash: result.result.hash,
      ledgerIndex: result.result.ledger_index,
      deliveredAmount: parseFloat(targetAmount.toString()),
      sentAmount: parseFloat(requiredInput.toString()),
      routingMethod: "DEX (Counter-Offer)",
      exchangeRate: actualRate,
      message: `\n=== DEX TRADE COMPLETED ===\n💸 Amount Sent: ${parseFloat(requiredInput.toString()).toFixed(6)} ${sendCurrency}\n💰 Amount Delivered: ${parseFloat(targetAmount.toString()).toFixed(6)} ${receiveCurrency}\n📈 Exchange Rate: ${actualRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}\n🎯 Routing Method: DEX (Counter-Offer)\n📋 Ledger Index: ${result.result.ledger_index}\n============================\n`
    };
  }
  
  return { success: false };
};

const parseTransactionResult = (
  response: XRPLResponse, 
  recommendation: any, 
  walletObject: xrpl.Wallet, 
  sendCurrency: string, 
  receiveCurrency: string, 
  sendMax: string | CurrencyAmount
): TransactionResult => {
  let actualAmountSent: number | null = null;
  let actualAmountDelivered: number = 0;
  let actualRoutingMethod: string = recommendation.type;
  
  try {
    const affectedNodes = response.result.meta.AffectedNodes || [];
    let hasAMMUsage = false;
    let hasDexOfferUsage = false;
    
    affectedNodes.forEach((node: any) => {
      const nodeData = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
      if (!nodeData) return;
      
      if (nodeData.LedgerEntryType === "AMM") {
        hasAMMUsage = true;
      }
      
      if (nodeData.LedgerEntryType === "Offer") {
        hasDexOfferUsage = true;
      }
      
      // Parse sent amount for non-XRP currencies
      if (nodeData.LedgerEntryType === "RippleState") {
        const prevBalance = parseFloat(nodeData.PreviousFields?.Balance?.value || "0");
        const finalBalance = parseFloat(nodeData.FinalFields?.Balance?.value || "0");
        const balanceChange = finalBalance - prevBalance;
        
        if (balanceChange < 0 && nodeData.PreviousFields?.Balance?.currency === sendCurrency) {
          const actualSent = Math.abs(balanceChange);
          if (!actualAmountSent || actualSent > actualAmountSent) {
            actualAmountSent = actualSent;
          }
        }
      }
      
      // Parse sent amount for XRP
      if (nodeData.LedgerEntryType === "AccountRoot" && nodeData.FinalFields?.Account === walletObject.classicAddress) {
        const prevBalance = parseFloat(nodeData.PreviousFields?.Balance || "0");
        const finalBalance = parseFloat(nodeData.FinalFields?.Balance || "0");
        const xrpChange = xrpl.dropsToXrp(prevBalance - finalBalance);
        
        if (sendCurrency === "XRP" && xrpChange > 0.000012) {
          actualAmountSent = xrpChange - 0.000012;
        }
      }
    });
    
    // Fallback if we couldn't parse the actual sent amount
    if (actualAmountSent === null) {
      actualAmountSent = typeof sendMax === 'string' ? 
        xrpl.dropsToXrp(sendMax) : 
        parseFloat(sendMax.value);
    }
    
    // Parse delivered amount
    if (response.result.meta.delivered_amount) {
      const delivered = response.result.meta.delivered_amount;
      actualAmountDelivered = typeof delivered === 'string' ? 
        xrpl.dropsToXrp(delivered) : 
        parseFloat(delivered.value);
    }
    
    // Set routing method
    if (hasAMMUsage && hasDexOfferUsage) {
      actualRoutingMethod = "Hybrid (AMM + DEX)";
    } else if (hasAMMUsage) {
      actualRoutingMethod = "AMM";
    } else if (hasDexOfferUsage) {
      actualRoutingMethod = "DEX";
    }
    
  } catch (error) {
    console.error("Error parsing transaction result:", error instanceof Error ? error.message : String(error));
    // Set fallback values
    actualAmountSent = typeof sendMax === 'string' ? 
      xrpl.dropsToXrp(sendMax) : 
      parseFloat(sendMax.value);
  }
  
  return { actualAmountSent: actualAmountSent || 0, actualAmountDelivered, actualRoutingMethod };
};

/**
 * Send a cross-currency payment using smart pathfinding (AMM + DEX combined)
 */
export async function sendCrossCurrency({
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
}: SendCrossCurrencyParams): Promise<SendCrossCurrencyResponse> {
  try {
    await connectXRPLClient();
    
    console.log(`🎯 Smart Cross-Currency Payment: ${senderWallet.classicAddress} → ${destinationAddress}`);
    console.log(`💰 ${paymentType === "exact_input" ? 
      `Send ${sendAmount} ${sendCurrency} → Get ${receiveCurrency}` : 
      `Pay ${sendCurrency} → Get exactly ${exactOutputAmount} ${receiveCurrency}`}`);
    
    // Step 1: Handle exact output calculation
    if (paymentType === "exact_output") {
      console.log(`🧮 Calculating required input for ${exactOutputAmount} ${receiveCurrency}...`);
      
      try {
        const liveFormattedAMMInfo = await getFormattedAMMInfoByCurrencies(sendCurrency, receiveCurrency);
        if (!liveFormattedAMMInfo) {
          throw new Error(`Could not find ${sendCurrency}/${receiveCurrency} AMM pool`);
        }
        
        const { poolSend, poolReceive } = mapPoolCurrencies(liveFormattedAMMInfo, sendCurrency, receiveCurrency);
        const tradingFeeBasisPoints = liveFormattedAMMInfo.tradingFee || 0;
        
        // Use BigNumber for exact output amount to preserve precision
        const exactOutputBN = new BigNumber(exactOutputAmount!.toString());
        const calculation = calculateExactAMMInput(poolSend, poolReceive, parseFloat(exactOutputBN.toString()), slippagePercent / 100, tradingFeeBasisPoints);
        if (!calculation.success) {
          throw new Error(`AMM calculation failed: ${calculation.error}`);
        }
        
        sendAmount = calculation.inputWithSlippage.toString();
        console.log(`✅ Calculated input: ${sendAmount} ${sendCurrency} for exact output: ${exactOutputBN.toString()} ${receiveCurrency}`);
        
      } catch (calcError) {
        throw new Error(`Failed to calculate required input: ${calcError instanceof Error ? calcError.message : String(calcError)}`);
      }
    }
    
    // Step 2: Run market analysis
    const pathfindingResult = await analyzeMarket(
      sendCurrency,
      receiveCurrency,
      sendAmount.toString(),
      issuerAddress,
      {
        purpose: paymentType === "exact_input" ? 'analysis' : 'exact_output_analysis',
        targetOutput: exactOutputAmount ? parseFloat(exactOutputAmount.toString()) : undefined,
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
      const requiredInput = parseFloat(exactOutputAmount!.toString()) / optimalRate;
      const executionBuffer = 1 + (slippagePercent / 100);
      sendAmount = (requiredInput * executionBuffer).toString();
      
      console.log(`🔄 Optimized input: ${sendAmount} ${sendCurrency} (${slippagePercent}% slippage)`);
      console.log(`🎯 Target output: exactly ${exactOutputAmount} ${receiveCurrency}`);
              recommendation.estimatedOutput = exactOutputAmount!.toString();
    }
    
    // Step 4: Calculate precise amounts
    const preciseInputNeeded = await calculatePreciseAmount(
      recommendation, sendCurrency, receiveCurrency, sendAmount, slippagePercent, paymentType
    );
    
    const sendMax = formatCurrency(preciseInputNeeded, sendCurrency, issuerAddress, true);
    
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
    let destinationAmount: string | CurrencyAmount;
    if (paymentType === "exact_output") {
      // For exact output, preserve the exact amount without rounding
      destinationAmount = formatCurrency(exactOutputAmount!, receiveCurrency, issuerAddress, true);
      console.log(`🎯 Setting exact destination amount: ${JSON.stringify(destinationAmount)}`);
    } else {
      let preciseOutput: number;
      if (recommendation.type === 'DEX') {
        preciseOutput = parseFloat(sendAmount.toString()) * recommendation.rate;
        // Convert to exact output for DEX reliability - preserve precision
        exactOutputAmount = preciseOutput.toString();
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
        const destLines: AccountLinesResponse = await client.request({
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
    const paymentTx: PaymentTransaction = {
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
    console.log(`📋 Payment Details:`);
    console.log(`   SendMax: ${JSON.stringify(paymentTx.SendMax)}`);
    console.log(`   Amount (destination): ${JSON.stringify(paymentTx.Amount)}`);
    console.log(`   Payment Type: ${paymentType}`);
    
    const preparedTx = await client.autofill(paymentTx as any);
    const currentLedger: LedgerResponse = await client.request({ command: "ledger_current" });
    (preparedTx as any).LastLedgerSequence = currentLedger.result.ledger_current_index + 100;
    
    const walletObject = senderWallet.seed && !senderWallet.sign ? 
      xrpl.Wallet.fromSeed(senderWallet.seed) : senderWallet;
    
    const signedTx = walletObject.sign(preparedTx);
    const response = await client.submitAndWait(signedTx.tx_blob) as XRPLResponse;
    
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
      
      const message = `\n=== Smart Cross-Currency Payment Details ===\n👛 From: ${walletObject.classicAddress}\n👛 To: ${destinationAddress}\n💸 Amount Sent: ${actualAmountSent.toFixed(6)} ${sendCurrency}   (+ 0.000012 XRP)\n💰 Amount Delivered: ${actualAmountDelivered.toFixed(6)} ${receiveCurrency}\n🎯 Routing Method: ${actualRoutingMethod}\n📈 Exchange Rate: ${displayRate.toFixed(6)} ${rateLabel}\n📋 Transaction Hash: ${response.result.hash}\n📋 Ledger Index: ${response.result.ledger_index}\n`;
      
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
    console.error("❌ Cross-currency payment error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
