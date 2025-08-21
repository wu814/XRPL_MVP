"use strict";

import { connectXRPLClient, client } from "../testnet";
import { analyzeMarket } from "../pathfind/corePathfindingEngine";
import { calculateExactAMMInput, calculateEstimateOutput } from "../amm/calculations";
import { getFormattedAMMInfoByCurrencies } from "../amm/ammUtils";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import BigNumber from 'bignumber.js';
import { formatAmountForXRPL } from "@/utils/assetUtils";
import { isTypedTransactionSuccessful, handleTransactionError } from "../errorHandler";
import { Payment, TxResponse, Wallet, dropsToXrp, Amount, OfferCreate, AccountLinesResponse, AccountInfoResponse } from "xrpl";
import { SendCrossCurrencyResult } from "@/types/xrpl/transactionXRPLTypes";


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

const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

/**
 * Helper function to check if a wallet has sufficient balance for cross-currency payment
 * @param senderWallet - The wallet sending the payment
 * @param sendCurrency - The currency being sent
 * @param sendAmount - The amount to send
 * @param issuerAddress - The issuer address for the currency (if not XRP)
 * @returns Promise<boolean> - Returns true if sufficient balance, false otherwise
 */
async function checkAssetBalanceForCrossCurrencyPayment(
  senderWallet: Wallet,
  sendCurrency: string,
  sendAmount: string | number,
  issuerAddress: string
): Promise<boolean> {
  if (sendCurrency !== "XRP") {
    console.log(`🔍 Checking ${sendCurrency} balance...`);
    const balanceResponse: AccountLinesResponse = await client.request({
      command: "account_lines",
      account: senderWallet.classicAddress,
      peer: issuerAddress,
    });

    const assetLine = balanceResponse.result.lines.find(
      (line) =>
        line.currency === sendCurrency &&
        line.account === issuerAddress,
    );

    if (assetLine) {
      const balance = new BigNumber(assetLine.balance);
      const paymentAmount = new BigNumber(sendAmount.toString());

      if (balance.lt(paymentAmount)) {
        console.log(`❌ Insufficient ${sendCurrency} balance. Have: ${balance.toFixed(6)}, Need: ${paymentAmount.toFixed(6)}`);
        return false;
      }
      
      console.log(`✅ Sufficient ${sendCurrency} balance confirmed.`);
      return true;
    } else {
      console.log(`❌ No trustline found for ${sendCurrency} from ${issuerAddress}`);
      return false;
    }
  } else {
    console.log(`🔍 Checking XRP balance...`);
    const accountInfoResponse: AccountInfoResponse = await client.request({
      command: "account_info",
      account: senderWallet.classicAddress,
      ledger_index: "validated",
    });

    const xrpBalance = new BigNumber(dropsToXrp(
      accountInfoResponse.result.account_data.Balance,
    ));
    const ownerCount = accountInfoResponse.result.account_data.OwnerCount || 0;
    const reserveXRP = new BigNumber(BASE_RESERVE_XRP).plus(new BigNumber(OWNER_RESERVE_XRP).times(ownerCount));
    const paymentAmount = new BigNumber(sendAmount.toString());
    const transactionFee = new BigNumber("0.000012"); // Standard transaction fee

    const totalRequired = paymentAmount.plus(reserveXRP).plus(transactionFee);

    if (xrpBalance.lt(totalRequired)) {
      console.log(`❌ Insufficient XRP balance. Need: ${totalRequired.toFixed(6)} (${paymentAmount.toFixed(6)} + ${reserveXRP.toFixed(6)} reserve + ${transactionFee.toFixed(6)} fee), Have: ${xrpBalance.toFixed(6)}`);
      return false;
    }
    
    console.log(`✅ Sufficient XRP balance confirmed.`);
    return true;
  }
}

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
): Promise<BigNumber> => {
  if (paymentType === "exact_output") {

    if (recommendation.type === 'DEX') {
      return new BigNumber(sendAmount.toString());
    }
    
    if (recommendation.type === 'AMM' && recommendation.path?.hops) {
      let cumulativeSlippage = 1.0;
      recommendation.path.hops.forEach((hop: any, i: number) => {
        cumulativeSlippage *= 1.003; // 0.3% per hop
      });
      return new BigNumber(sendAmount.toString()).multipliedBy(cumulativeSlippage);
    }
    
    // Direct AMM calculation
    try {
      const liveFormattedAMMInfo = await getFormattedAMMInfoByCurrencies(sendCurrency, receiveCurrency);
      if (liveFormattedAMMInfo) {
        const { poolSend, poolReceive } = mapPoolCurrencies(liveFormattedAMMInfo, sendCurrency, receiveCurrency);
        const tradingFeeDecimal = liveFormattedAMMInfo.tradingFee / 100000 || 0;
        
        if (paymentType === "exact_output") {
          // For exact_output: Calculate how much input is needed for exact output
          const targetOutput = parseFloat(recommendation.estimatedOutput);
          const calculation = calculateExactAMMInput(poolSend, poolReceive, targetOutput, slippagePercent / 100, tradingFeeDecimal);
          if (calculation.success) {
            return calculation.inputWithSlippage; // Use inputWithSlippage instead of exactInput
          }
        } else {
          // For exact_input: Use the exact amount specified (with slippage buffer)
          return new BigNumber(sendAmount.toString()).multipliedBy(1 + slippagePercent / 100);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error calculating precise amount: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return new BigNumber(sendAmount.toString());
};

const createCounterOffer = async (
  senderWallet: Wallet, 
  targetAmount: string | number, 
  receiveCurrency: string, 
  sendCurrency: string, 
  issuerAddress: string, 
  actualRate: number
): Promise<CounterOfferResult> => {
  const requiredInput = parseFloat(targetAmount.toString()) / actualRate;
  
  const counterOfferTx: OfferCreate = {
    TransactionType: "OfferCreate",
    Account: senderWallet.address,
    TakerGets: formatAmountForXRPL({currency: receiveCurrency, issuer: issuerAddress, value: targetAmount.toString()}),
    TakerPays: formatAmountForXRPL({currency: sendCurrency, issuer: issuerAddress, value: requiredInput.toString()}),
    Flags: 0x00040000 // tfImmediateOrCancel
  };
  
  const prepared = await client.autofill(counterOfferTx);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait<OfferCreate>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "createCounterOffer");
      throw new Error(`Counter-offer failed: ${errorInfo.code} - ${errorInfo.message}`);
  }
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
};

const parseTransactionResult = (
  response: TxResponse<Payment>, 
  recommendation: any, 
  walletObject: Wallet, 
  sendCurrency: string, 
  sendMax: Amount
): TransactionResult => {
  let actualAmountSent: number | null = null;
  let actualAmountDelivered: number = 0;
  let actualRoutingMethod: string = recommendation.type;
  
  try {
    // Type guard to ensure meta is PaymentMetadata
    if (typeof response.result.meta === 'string') {
      throw new Error('Transaction metadata is string, expected object');
    }
    
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
        const xrpChange = dropsToXrp(prevBalance - finalBalance);
        
        if (sendCurrency === "XRP" && xrpChange > 0.000012) {
          actualAmountSent = xrpChange - 0.000012;
        }
      }
    });
    
    // Fallback if we couldn't parse the actual sent amount
    if (actualAmountSent === null) {
      actualAmountSent = typeof sendMax === 'string' ? 
        dropsToXrp(sendMax) : 
        parseFloat(sendMax.value);
    }
    
    // Parse delivered amount
    if (response.result.meta.delivered_amount) {
      const delivered = response.result.meta.delivered_amount;
      actualAmountDelivered = typeof delivered === 'string' ? 
        dropsToXrp(delivered) : 
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
      dropsToXrp(sendMax) : 
      parseFloat(sendMax.value);
  }
  
  return { actualAmountSent: actualAmountSent || 0, actualAmountDelivered, actualRoutingMethod };
};

/**
 * Send a cross-currency payment using smart pathfinding (AMM + DEX combined)
 */
export async function sendCrossCurrency(
  senderXRPLWallet: Wallet, 
  destinationAddress: string, 
  sendCurrency: string, 
  sendAmount: string | number, 
  receiveCurrency: string, 
  issuerAddress: string,
  slippagePercent: number = 0,
  destinationTag: number | null = null,
  paymentType: "exact_input" | "exact_output" = "exact_input",
  exactOutputAmount: string | number | null = null
): Promise<SendCrossCurrencyResult> {
  try {
    
    await connectXRPLClient();
    
    console.log(`🎯 Smart Cross-Currency Payment: ${senderXRPLWallet.classicAddress} → ${destinationAddress}`);
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
        const tradingFeeDecimal = liveFormattedAMMInfo.tradingFee / 100000 || 0;
        
        // Use BigNumber for exact output amount to preserve precision
        const exactOutputBN = new BigNumber(exactOutputAmount!.toString());
        const calculation = calculateExactAMMInput(poolSend, poolReceive, parseFloat(exactOutputBN.toString()), slippagePercent / 100, tradingFeeDecimal);
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

    // ========== BALANCE CHECK ==========
    console.log(`🔍 Checking if user has sufficient ${sendCurrency} balance...`);
    const balanceSufficient = await checkAssetBalanceForCrossCurrencyPayment(
      senderXRPLWallet,
      sendCurrency,
      preciseInputNeeded.toString(),
      issuerAddress
    );
    
    if (!balanceSufficient) {
      return {
        success: false,
        message: `Insufficient ${sendCurrency} balance for this transaction.`,
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient ${sendCurrency} balance.`
        }
      };
    }
    console.log(`✅ Balance check passed!`);

    // Step 5: Handle DEX routing via counter-offer
    if (recommendation.type === 'DEX') {
      console.log("🔧 Executing DEX trade via counter-offer...");
      const targetAmount = paymentType === "exact_output" ? exactOutputAmount : recommendation.estimatedOutput;
      
      const counterResult = await createCounterOffer(
        senderXRPLWallet, 
        targetAmount, 
        receiveCurrency, 
        sendCurrency, 
        issuerAddress, 
        recommendation.rate
      );
      
      if (counterResult.success) {
        console.log("✅ DEX trade completed via counter-offer!");
        return {
          success: true,
          message: counterResult.message!
        };
      }
      
      console.log("🔄 Counter-offer failed, falling back to payment transaction");
    }

    // Step 6: Calculate destination amount and transaction fields based on payment type
    let destinationAmount: Amount;
    let sendMaxAmount: Amount;
    let transactionFlags: number;

    if (paymentType === "exact_output") {
      // Case 2: Receiver gets exactly the specified amount
      // Amount = exact output, SendMax = calculated input (with slippage buffer)
      destinationAmount = formatAmountForXRPL({currency: receiveCurrency, issuer: issuerAddress, value: exactOutputAmount!.toString()});
      sendMaxAmount = formatAmountForXRPL({currency: sendCurrency, issuer: issuerAddress, value: preciseInputNeeded.toString()});
      transactionFlags = 0x00000000; // No tfPartialPayment needed
      
      console.log(`🎯 Exact Output Mode: Receiver gets exactly ${exactOutputAmount} ${receiveCurrency}`);
      console.log(`🎯 SendMax set to: ${preciseInputNeeded.toString()} ${sendCurrency}`);
      
    } else if (paymentType === "exact_input") {
      // Case 1: Sender spends exactly the specified amount
      // Amount = high placeholder (cap), SendMax = exact input, Enable tfPartialPayment
      const highPlaceholderAmount = "1000000000"; // Arbitrarily high cap
      destinationAmount = formatAmountForXRPL({currency: receiveCurrency, issuer: issuerAddress, value: highPlaceholderAmount});
      sendMaxAmount = formatAmountForXRPL({currency: sendCurrency, issuer: issuerAddress, value: sendAmount.toString()});
      transactionFlags = 0x00020000; // tfPartialPayment flag
      
      console.log(`🎯 Exact Input Mode: Sender spends exactly ${sendAmount} ${sendCurrency}`);
      console.log(`🎯 SendMax set to: ${sendAmount} ${sendCurrency} (exact spend)`);
      console.log(`🎯 Amount set to high placeholder: ${highPlaceholderAmount} ${receiveCurrency}`);
      
    } else {
      // Fallback for other payment types
      let preciseOutput: number;
      if (recommendation.type === 'DEX') {
        preciseOutput = parseFloat(sendAmount.toString()) * recommendation.rate;
        exactOutputAmount = preciseOutput.toString();
        paymentType = "exact_output";
      } else {
        preciseOutput = parseFloat(recommendation.estimatedOutput);
      }
      destinationAmount = formatAmountForXRPL({currency: receiveCurrency, issuer: issuerAddress, value: preciseOutput.toString()});
      sendMaxAmount = formatAmountForXRPL({currency: sendCurrency, issuer: issuerAddress, value: preciseInputNeeded.toString()});
      transactionFlags = 0x00000000;
    }

    // Step 8: Construct and submit payment transaction
    const paymentTx: Payment = {
      TransactionType: "Payment",
      Account: senderXRPLWallet.classicAddress,
      Destination: destinationAddress,
      SendMax: sendMaxAmount as Amount,        // Use calculated sendMaxAmount
      Amount: destinationAmount as Amount,     // Use calculated destinationAmount
      Flags: transactionFlags        // Use calculated flags
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
    console.log(`   Amount Sent: ${sendAmount} ${sendCurrency}`);
    console.log(`   SendMax: ${JSON.stringify(paymentTx.SendMax)}`);
    console.log(`   Amount (destination): ${JSON.stringify(paymentTx.Amount)}`);
    console.log(`   Payment Type: ${paymentType}`);
    
    const preparedTx = await client.autofill(paymentTx);    
    const signedTx = senderXRPLWallet.sign(preparedTx);
    const response = await client.submitAndWait<Payment>(signedTx.tx_blob)
        
    // Use the integrated error handling functions
    if (!isTypedTransactionSuccessful(response)) {
      const errorInfo = handleTransactionError(response, "sendCrossCurrency");
      return {
        success: false,
        message: `Payment failed: ${errorInfo.code} - ${errorInfo.message}`,
        error: errorInfo
      };
    }
    
    console.log("✅ Payment successful!");
    
    const { actualAmountSent, actualAmountDelivered, actualRoutingMethod } = parseTransactionResult(
      response, recommendation, senderXRPLWallet, sendCurrency, sendMaxAmount
    );
    
    const displayRate = recommendation.rate;
    const rateLabel = receiveCurrency === 'XRP' && sendCurrency !== 'XRP' ? 
      `XRP per ${sendCurrency}` : 
      sendCurrency === 'XRP' && receiveCurrency !== 'XRP' ? 
        `${receiveCurrency} per XRP` : 
        `${receiveCurrency}/${sendCurrency}`;
    
    const message = `\n=== Smart Cross-Currency Payment Details ===\n👛 From: ${senderXRPLWallet.classicAddress}\n👛 To: ${destinationAddress}\n💸 Amount Sent: ${actualAmountSent.toFixed(6)} ${sendCurrency}   (+ 0.000012 XRP)\n💰 Amount Delivered: ${actualAmountDelivered.toFixed(6)} ${receiveCurrency}\n🎯 Routing Method: ${actualRoutingMethod}\n📈 Exchange Rate: ${displayRate.toFixed(6)} ${rateLabel}\n📋 Transaction Hash: ${response.result.hash}\n📋 Ledger Index: ${response.result.ledger_index}\n`;
    
    return {
      success: true,
      message: message
    };
  } catch (error) {
    console.error("❌ Cross-currency payment error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
