"use strict";

import xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";
import { analyzeMarket } from "../pathfind/corePathfindingEngine";

/**
 * Calculate exact AMM input needed for a specific output using constant product formula
 * @param {number} poolX - Input asset pool balance
 * @param {number} poolY - Output asset pool balance  
 * @param {number} desiredOutput - Desired output amount
 * @param {number} slippageTolerance - Slippage tolerance (default 0.01 = 1%)
 * @param {number} tradingFeeBasisPoints - Trading fee in basis points (default 0)
 * @returns {Object} Calculation result with exact input needed
 */
export function calculateExactAMMInput(poolX, poolY, desiredOutput, slippageTolerance = 0, tradingFeeBasisPoints = 0) {
  try {
    console.log(`🧮 AMM Constant Product Calculation:`);
    console.log(`   Initial Pool: ${poolX} (input) / ${poolY} (output)`);
    console.log(`   Desired Output: ${desiredOutput}`);
    console.log(`   Trading Fee: ${tradingFeeBasisPoints} basis points (${tradingFeeBasisPoints/1000}%)`);
    console.log(`   Constant k = ${poolX * poolY}`);
    
    // Convert trading fee from basis points to decimal (100 basis points = 1%)
    const tradingFeeDecimal = tradingFeeBasisPoints / 100000;
    
    // If there's a trading fee, we need to account for it in our calculation
    // The AMM will deduct the fee from the output, so we need to request more
    // to ensure we get exactly the desired amount after fees
    let adjustedDesiredOutput = desiredOutput;
    
    if (tradingFeeBasisPoints > 0) {
      // Calculate how much extra we need to request to account for the fee
      // If fee is 1% and we want 100, we need to request ~101.01 so that after 1% fee we get 100
      adjustedDesiredOutput = desiredOutput / (1 - tradingFeeDecimal);
      console.log(`   Fee Adjustment: Requesting ${adjustedDesiredOutput.toFixed(6)} to get ${desiredOutput} after ${tradingFeeBasisPoints}bps fee`);
    }
    
    // Constant product formula: X * Y = k
    const k = poolX * poolY;
    
    // After taking adjustedDesiredOutput from poolY:
    // newPoolY = poolY - adjustedDesiredOutput
    const newPoolY = poolY - adjustedDesiredOutput;
    
    if (newPoolY <= 0) {
      throw new Error(`Insufficient liquidity: Cannot withdraw ${adjustedDesiredOutput} from pool of ${poolY}`);
    }
    
    // Calculate newPoolX using k = newPoolX * newPoolY
    // newPoolX = k / newPoolY
    const newPoolX = k / newPoolY;
    
    // Input needed = newPoolX - poolX
    const exactInputNeeded = newPoolX - poolX;
    
    // Apply slippage tolerance
    const inputWithSlippage = exactInputNeeded * (1 + slippageTolerance);
    
    console.log(`   After withdrawal: ${newPoolX.toFixed(6)} / ${newPoolY.toFixed(6)}`);
    console.log(`   Exact input needed: ${exactInputNeeded.toFixed(6)}`);
    console.log(`   With ${slippageTolerance}% slippage: ${inputWithSlippage.toFixed(6)}`);
    console.log(`   Price per unit: ${(exactInputNeeded / desiredOutput).toFixed(6)}`);
    
    return {
      success: true,
      exactInput: exactInputNeeded,
      inputWithSlippage: inputWithSlippage,
      pricePerUnit: exactInputNeeded / desiredOutput,
      newPoolX: newPoolX,
      newPoolY: newPoolY,
      slippageAmount: inputWithSlippage - exactInputNeeded,
      tradingFeeAdjustment: adjustedDesiredOutput - desiredOutput,
      adjustedOutput: adjustedDesiredOutput
    };
    
  } catch (error) {
    console.error(`❌ AMM calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

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
    
    console.log("🎯 Smart Cross-Currency Payment (AMM + DEX pathfinding)...");
    console.log(`Sender: ${senderWallet.classicAddress}`);
    console.log(`Destination: ${destinationAddress}`);
    
    if (paymentType === "exact_input") {
      console.log(`💰 Exact Input: Send ${sendAmount} ${sendCurrency} → Get whatever ${receiveCurrency} possible`);
    } else {
      console.log(`🎯 Exact Output: Pay with ${sendCurrency} → Get exactly ${exactOutputAmount} ${receiveCurrency}`);
    }
    
    console.log(`Slippage Tolerance: ${slippagePercent}%`);
    
    // Step 1: Handle different payment types
    let pathfindingResult;
    
    if (paymentType === "exact_input") {
      // Standard pathfinding for exact input
      pathfindingResult = await analyzeMarket(
        sendCurrency,
        receiveCurrency,
        sendAmount,
        issuerAddress,
        {
          purpose: 'cross_currency_payment',
          includeAMM: true,
          includeDEX: true,
          includeHybrid: true
        }
      );
    } else {
      // For exact output, calculate required input first
      console.log(`🧮 Calculating required ${sendCurrency} for exactly ${exactOutputAmount} ${receiveCurrency}...`);
      
      // For exact output mode, try to calculate the precise input needed
      let calculatedInput = null;
      let directPool = null; // Move variable declaration outside try block
      
      try {
        // Use AMM calculation function and get LIVE data
        const { getAmmInfoByCurrencies } = await import('../amm/ammUtils.js');
        
        // Get LIVE AMM data using the universal function - NO CACHING
        console.log(`📊 Fetching LIVE AMM data for exact output calculation...`);
        const liveAmmInfo = await getAmmInfoByCurrencies(sendCurrency, receiveCurrency);
        
        if (liveAmmInfo) {
          console.log(`✅ Found live AMM pool: ${sendCurrency}/${receiveCurrency}`);
          
          // Convert universal format to calculation format
          directPool = {
            amm_account: liveAmmInfo.amm_account,
            currency_a: {
              currency: liveAmmInfo.asset1.currency,
              issuer: liveAmmInfo.asset1.issuer,
              value: liveAmmInfo.asset1.value
            },
            currency_b: {
              currency: liveAmmInfo.asset2.currency,
              issuer: liveAmmInfo.asset2.issuer,
              value: liveAmmInfo.asset2.value
            },
            trading_fee: liveAmmInfo.trading_fee
          };
          
          console.log(`📊 LIVE Pool data:`, JSON.stringify(directPool, null, 2));
        }
        
        if (directPool) {
          console.log(`📊 Pool data:`, JSON.stringify(directPool, null, 2));
          
          // Determine pool mapping based on currency positions
          let poolSend, poolReceive;
          if (directPool.currency_a?.currency === sendCurrency && directPool.currency_b?.currency === receiveCurrency) {
            poolSend = parseFloat(directPool.currency_a.value);
            poolReceive = parseFloat(directPool.currency_b.value);
            console.log(`💰 Pool mapping: ${sendCurrency}=${poolSend}, ${receiveCurrency}=${poolReceive}`);
          } else if (directPool.currency_b?.currency === sendCurrency && directPool.currency_a?.currency === receiveCurrency) {
            poolSend = parseFloat(directPool.currency_b.value);
            poolReceive = parseFloat(directPool.currency_a.value);
            console.log(`💰 Pool mapping (reversed): ${sendCurrency}=${poolSend}, ${receiveCurrency}=${poolReceive}`);
          } else {
            throw new Error(`Pool currency mismatch: expected ${sendCurrency}/${receiveCurrency}, got ${directPool.currency_a?.currency}/${directPool.currency_b?.currency}`);
          }
          
          console.log(`💰 Final pool balances: ${poolSend.toFixed(2)} ${sendCurrency} / ${poolReceive.toFixed(2)} ${receiveCurrency}`);
          
          // Get trading fee from the pool data (default to 0 if not available)
          const tradingFeeBasisPoints = directPool.trading_fee || 0;
          console.log(`📊 AMM Trading Fee: ${tradingFeeBasisPoints} basis points (${tradingFeeBasisPoints/100}%)`);
          
          const calculation = calculateExactAMMInput(poolSend, poolReceive, parseFloat(exactOutputAmount), slippagePercent / 100, tradingFeeBasisPoints);
          if (calculation.success) {
            calculatedInput = calculation.inputWithSlippage;
            console.log(`💡 Calculated input needed: ${calculatedInput.toFixed(6)} ${sendCurrency} for exactly ${exactOutputAmount} ${receiveCurrency}`);
            if (calculation.tradingFeeAdjustment > 0) {
              console.log(`   💰 Fee-adjusted request: ${calculation.adjustedOutput.toFixed(6)} (to deliver ${exactOutputAmount} after ${tradingFeeBasisPoints}bps fee)`);
            }
          } else {
            throw new Error(`AMM calculation failed: ${calculation.error}`);
          }
        }
        
        if (!calculatedInput) {
          throw new Error(`Could not find ${sendCurrency}/${receiveCurrency} AMM pool or calculate required input`);
        }

        // For exact output with AMM calculation, use the precise calculated amount
        // Don't add extra buffers since we already accounted for trading fees and slippage
        sendAmount = calculatedInput.toString();
        console.log(`✅ Using precise calculated input: ${sendAmount} ${sendCurrency} (no additional buffers)`);
        
      } catch (calcError) {
        console.error(`❌ Calculation error: ${calcError.message}`);
        throw new Error(`Failed to calculate required input amount: ${calcError.message}`);
      }
      
      // Run full market analysis for exact output to find optimal route
      console.log(`🎯 Exact Output Mode: Running market analysis to find optimal route...`);
      
      pathfindingResult = await analyzeMarket(
        sendCurrency,
        receiveCurrency,
        sendAmount, // Use calculated amount for rate analysis
        issuerAddress,
        {
          purpose: 'exact_output_analysis',
          targetOutput: parseFloat(exactOutputAmount), // Pass target output for exact calculations
          includeAMM: true,
          includeDEX: true,
          includeHybrid: true
        }
      );
      
      if (!pathfindingResult.success) {
        console.log(`⚠️ Market analysis failed, falling back to direct AMM calculation`);
        // Create fallback pathfinding result for direct AMM
        pathfindingResult = {
          success: true,
          bestRoute: {
            type: 'AMM',
            rate: parseFloat(exactOutputAmount) / parseFloat(sendAmount),
            estimatedOutput: exactOutputAmount,
            confidence: 95,
            path: { ammAccount: directPool?.amm_account || 'Auto-detected' }
          }
        };
      } else {
        console.log(`✅ Market analysis complete - found optimal route: ${pathfindingResult.bestRoute.type}`);
        
        // ✅ CRITICAL FIX: Recalculate input amount using the optimal route's rate
        const optimalRate = pathfindingResult.bestRoute.rate;
        const requiredInputFromOptimalRate = parseFloat(exactOutputAmount) / optimalRate;
        
        console.log(`🔄 Recalculating input using optimal ${pathfindingResult.bestRoute.type} rate:`);
        console.log(`   Target: ${exactOutputAmount} ${receiveCurrency}`);
        console.log(`   Optimal rate: ${optimalRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}`);
        console.log(`   Required input: ${requiredInputFromOptimalRate.toFixed(6)} ${sendCurrency}`);
        
        // Add execution buffer for slippage (smaller buffer since we're using the optimal rate)
        const executionBuffer = 1 + (slippagePercent / 100);
        const adjustedSendAmount = requiredInputFromOptimalRate * executionBuffer;
        sendAmount = adjustedSendAmount.toString();
        
        console.log(`   With ${slippagePercent}% slippage buffer: ${sendAmount} ${sendCurrency}`);
        console.log(`✅ Using optimal route calculation instead of initial AMM estimate`);
        
        // Update the bestRoute estimatedOutput to show the correct target amount
        pathfindingResult.bestRoute.estimatedOutput = exactOutputAmount;
      }
    }
    
    if (!pathfindingResult.success) {
      throw new Error("No viable payment paths found. This could be due to: (1) Insufficient liquidity in AMMs/order books, (2) Missing trustlines, (3) DepositAuth restrictions, or (4) Pathfinding limitations. Try a smaller amount or different currency pair.");
    }
    
    const recommendation = pathfindingResult.bestRoute;
    console.log(`🏆 Optimal route: ${recommendation.type} (Rate: ${recommendation.rate.toFixed(6)})`);
    
    if (paymentType === "exact_output") {
      console.log(`💰 Target output: ${exactOutputAmount} ${receiveCurrency}`);
    } else {
      console.log(`💰 Expected output: ${recommendation.estimatedOutput} ${receiveCurrency}`);
    }
    
    // Step 2: Construct send amount with slippage
    let sendMax;
    if (paymentType === "exact_output") {
      // For exact output, use the precise calculated amount (already includes slippage and fees)
      if (sendCurrency === "XRP") {
        sendMax = xrpl.xrpToDrops(parseFloat(sendAmount).toFixed(6));
      } else {
        sendMax = {
          currency: sendCurrency,
          issuer: issuerAddress,
          value: parseFloat(sendAmount).toFixed(6)
        };
      }
      console.log(`🎯 Exact Output SendMax: Using precise calculated amount (${sendAmount} ${sendCurrency})`);
    } else {
      // ALWAYS USE PRECISION: Calculate exact amount needed based on optimal route
      console.log(`🎯 Calculating precise SendMax based on ${recommendation.type} route...`);
      
      let preciseInputNeeded;
      
      if (recommendation.type === 'DEX') {
        // For DEX: Use exact input amount (no slippage needed for order book)
        preciseInputNeeded = parseFloat(sendAmount);
        console.log(`📊 DEX Route: Using exact input ${preciseInputNeeded} ${sendCurrency}`);
        
      } else if (recommendation.type === 'AMM' && recommendation.path?.hops) {
        // Multi-hop AMM: Calculate slippage per hop
        console.log(`🔀 Multi-hop AMM route detected: ${recommendation.path.path}`);
        
        let cumulativeSlippage = 1.0;
        for (let i = 0; i < recommendation.path.hops.length; i++) {
          const hop = recommendation.path.hops[i];
          // Each AMM hop typically has 0.1-0.6% slippage, use 0.3% per hop
          const hopSlippage = 1.003; // 0.3% per hop
          cumulativeSlippage *= hopSlippage;
          console.log(`  Hop ${i+1}: ${hop.path || 'AMM'} - Slippage factor: ${hopSlippage}`);
        }
        
        preciseInputNeeded = parseFloat(sendAmount) * cumulativeSlippage;
        console.log(`📊 Multi-hop calculation: ${sendAmount} × ${cumulativeSlippage.toFixed(6)} = ${preciseInputNeeded.toFixed(6)} ${sendCurrency}`);
        
      } else {
        // Direct AMM: Calculate precise input using constant product formula
        console.log(`🔵 Direct AMM route: Using live pool data for precision`);
        
        // Get live AMM data for precise calculation
        const { getAmmInfoByCurrencies } = await import('../amm/ammUtils.js');
        
        try {
          const liveAmmData = await getAmmInfoByCurrencies(sendCurrency, receiveCurrency, issuerAddress);
          
          if (liveAmmData && liveAmmData.asset1 && liveAmmData.asset2) {
            // Determine pool balances
            let poolInput, poolOutput;
            
            if (liveAmmData.asset1.currency === sendCurrency) {
              poolInput = parseFloat(liveAmmData.asset1.value);
              poolOutput = parseFloat(liveAmmData.asset2.value);
            } else {
              poolInput = parseFloat(liveAmmData.asset2.value);
              poolOutput = parseFloat(liveAmmData.asset1.value);
            }
            
            // Calculate exact input needed for expected output using constant product formula
            const targetOutput = parseFloat(recommendation.estimatedOutput);
            const tradingFeeBasisPoints = liveAmmData.trading_fee || 0;
            
            console.log(`📊 Live AMM Pool: ${poolInput} ${sendCurrency} / ${poolOutput} ${receiveCurrency}`);
            console.log(`🎯 Target Output: ${targetOutput} ${receiveCurrency}`);
            
            const calculation = calculateExactAMMInput(poolInput, poolOutput, targetOutput, slippagePercent / 100, tradingFeeBasisPoints);
            
            if (calculation.success) {
              preciseInputNeeded = calculation.exactInput;
              console.log(`✅ AMM Precise calculation: ${preciseInputNeeded.toFixed(6)} ${sendCurrency} needed`);
            } else {
              console.log(`⚠️ AMM calculation failed, using estimated: ${calculation.error}`);
              preciseInputNeeded = parseFloat(sendAmount);
            }
          } else {
            console.log(`⚠️ Could not get live AMM data, using estimated input`);
            preciseInputNeeded = parseFloat(sendAmount);
          }
        } catch (error) {
          console.log(`⚠️ Error fetching live AMM data: ${error.message}`);
          preciseInputNeeded = parseFloat(sendAmount);
        }
      }
      
      // Set precise SendMax
      if (sendCurrency === "XRP") {
        sendMax = xrpl.xrpToDrops(preciseInputNeeded.toFixed(6));
      } else {
        sendMax = {
          currency: sendCurrency,
          issuer: issuerAddress,
          value: preciseInputNeeded.toFixed(6)
        };
      }
      
      console.log(`✅ Precise SendMax: ${preciseInputNeeded.toFixed(6)} ${sendCurrency}`);
    }
    
    // Step 3: Construct destination amount based on payment type
    let destinationCurrency;
    
    if (paymentType === "exact_output") {
      // For exact output, use the specified amount
      if (receiveCurrency === "XRP") {
        destinationCurrency = xrpl.xrpToDrops(parseFloat(exactOutputAmount).toFixed(6));
      } else {
        destinationCurrency = {
          currency: receiveCurrency,
          issuer: issuerAddress,
          value: parseFloat(exactOutputAmount).toFixed(6)
        };
      }
    } else {
      // ALWAYS PRECISE: Calculate exact expected output for any route
      console.log("🎯 Calculating precise destination amount for optimal route...");
      
      let preciseExpectedOutput;
      
      if (recommendation.type === 'DEX') {
        // DEX: Calculate exact expected output using DEX rate
        preciseExpectedOutput = parseFloat(sendAmount) * recommendation.rate;
        console.log(`📊 DEX calculation: ${sendAmount} ${sendCurrency} × ${recommendation.rate.toFixed(6)} = ${preciseExpectedOutput.toFixed(6)} ${receiveCurrency}`);
        
        // CRITICAL: For DEX routing, we need to force exact output behavior
        // Convert this to an exact output transaction to ensure DEX routing works
        exactOutputAmount = preciseExpectedOutput.toFixed(6);
        paymentType = "exact_output";
        console.log(`🔄 Converting to exact_output mode to force DEX routing: ${exactOutputAmount} ${receiveCurrency}`);
        
      } else {
        // AMM: Use the precise estimated output from pathfinding analysis
        preciseExpectedOutput = parseFloat(recommendation.estimatedOutput);
        console.log(`📊 AMM calculation: Using precise pathfinding result: ${preciseExpectedOutput.toFixed(6)} ${receiveCurrency}`);
      }
      
      // Set precise destination amount
      if (receiveCurrency === "XRP") {
        destinationCurrency = xrpl.xrpToDrops(preciseExpectedOutput.toFixed(6));
      } else {
        destinationCurrency = {
          currency: receiveCurrency,
          issuer: issuerAddress,
          value: preciseExpectedOutput.toFixed(6)
        };
      }
      
      console.log(`✅ Precise destination target: ${preciseExpectedOutput.toFixed(6)} ${receiveCurrency}`);
    }
    
    console.log(`🎯 Target destination amount: ${typeof destinationCurrency === 'string' ? xrpl.dropsToXrp(destinationCurrency) + ' XRP' : destinationCurrency.value + ' ' + destinationCurrency.currency}`);
    
    // NEW: Trustline compatibility check for reliability
    let hasTrustlineRisk = false;
    try {
      if (receiveCurrency !== "XRP") {
        console.log(`🔍 Checking destination trustline compatibility...`);
        const destLines = await client.request({
          command: "account_lines",
          account: destinationAddress,
          peer: issuerAddress
        });
        
        const hasCorrectTrustline = destLines.result.lines.some(line => 
          line.currency === receiveCurrency && line.account === issuerAddress
        );
        
        if (!hasCorrectTrustline) {
          console.log(`⚠️ Potential trustline mismatch detected for ${receiveCurrency} to issuer ${issuerAddress}`);
          console.log(`💡 This may cause tecPATH_DRY errors - multi-hop routing recommended`);
          hasTrustlineRisk = true;
        } else {
          console.log(`✅ Destination has compatible trustline for ${receiveCurrency}`);
        }
      }
    } catch (trustlineError) {
      console.log(`⚠️ Could not verify destination trustlines: ${trustlineError.message}`);
      // Assume risk exists if we can't verify
      hasTrustlineRisk = true;
    }
    
    // Adjust routing preference based on trustline risk
    if (hasTrustlineRisk && recommendation.path?.path && !recommendation.path.path.includes('→ XRP →')) {
      console.log(`🎯 Trustline risk detected - checking for safer multi-hop alternatives...`);
      
      // Look for multi-hop routes in the pathfinding result
      if (pathfindingResult.routes?.amm?.allRoutes) {
        const multiHopRoutes = pathfindingResult.routes.amm.allRoutes.filter(route => 
          route.path && route.path.includes('→ XRP →')
        );
        
        if (multiHopRoutes.length > 0) {
          const bestMultiHop = multiHopRoutes[0]; // They're already sorted by rate
          
          // Use multi-hop if it's within 20% efficiency of direct route (reliability > efficiency)
          const directEfficiency = recommendation.rate;
          const multiHopEfficiency = bestMultiHop.rate;
          const efficiencyRatio = multiHopEfficiency / directEfficiency;
          
          if (efficiencyRatio > 0.8) { // Multi-hop is within 20% efficiency
            console.log(`🔄 Switching to safer multi-hop route (${(efficiencyRatio * 100).toFixed(1)}% efficiency of direct)`);
            console.log(`🛤️ Safe route: ${bestMultiHop.path}`);
            
            // Update recommendation to use multi-hop route
            recommendation.type = 'AMM';
            recommendation.rate = bestMultiHop.rate;
            recommendation.estimatedOutput = bestMultiHop.amountOut?.toFixed(6) || recommendation.estimatedOutput;
            recommendation.path = bestMultiHop;
            
            // CRITICAL: Recalculate required input for multi-hop route
            if (paymentType === "exact_output") {
              console.log(`🎯 Multi-hop targeting same exact output: ${exactOutputAmount} ${receiveCurrency}`);
              
              // Use precise calculation from multi-hop route if available
              if (bestMultiHop.requiredInput) {
                sendAmount = bestMultiHop.requiredInput.toString();
                console.log(`✅ Using precise multi-hop input calculation: ${sendAmount} ${sendCurrency}`);
              } else {
                // Calculate required input from multi-hop rate
                const requiredInput = parseFloat(exactOutputAmount) / bestMultiHop.rate;
                const bufferedInput = requiredInput * 1.02; // 2% buffer for multi-hop
                sendAmount = bufferedInput.toString();
                console.log(`📊 Calculated multi-hop input: ${requiredInput.toFixed(6)} → ${sendAmount} ${sendCurrency} (2% buffer)`);
              }
              
              // Update SendMax accordingly
              if (sendCurrency === "XRP") {
                sendMax = xrpl.xrpToDrops(parseFloat(sendAmount).toFixed(6));
              } else {
                sendMax = {
                  currency: sendCurrency,
                  issuer: issuerAddress,
                  value: parseFloat(sendAmount).toFixed(6)
                };
              }
              console.log(`🔄 Updated SendMax for multi-hop: ${typeof sendMax === 'string' ? xrpl.dropsToXrp(sendMax) + ' XRP' : sendMax.value + ' ' + sendMax.currency}`);
            }
          } else {
            console.log(`⚠️ Multi-hop route too inefficient (${(efficiencyRatio * 100).toFixed(1)}% efficiency) - proceeding with direct route`);
          }
        }
      }
    }
    
    // Step 4: Let XRPL handle pathfinding automatically (don't use invalid string paths)
    console.log(`✅ Using ${recommendation.type} routing`);
    console.log(`🛤️ Route Description: ${recommendation.path?.path || 'Auto-pathfinding'}`);
    
    // Step 5: Calculate proper flags for optimal routing
    let flags = 0x00020000; // tfPartialPayments - essential for cross-currency routing
    
    // Step 6: Determine routing approach based on recommendation
    let paths = [];
    let useAmmPreference = false;
    let forceDEXPath = false;
    
    if (recommendation.type === 'AMM') {
      console.log("🔧 Using AMM-preferred routing (let XRPL find best AMM path)");
      console.log(`🎯 Expected AMM Account: ${recommendation.path?.ammAccount || 'Auto-detected'}`);
      useAmmPreference = true;
    } else if (recommendation.type === 'DEX') {
      console.log("🔧 FORCING DEX routing with explicit empty paths to disable AMM");
      forceDEXPath = true;
    } else {
      console.log("🔧 Using partial payments with XRPL automatic pathfinding");
    }
    
    // Step 7: Construct and submit transaction
    const paymentTx = {
      TransactionType: "Payment",
      Account: senderWallet.classicAddress,
      Destination: destinationAddress,
      SendMax: sendMax,
      Amount: destinationCurrency,
      Flags: flags
    };
    
    // Step 8: Force DEX execution by creating a counter-offer
    if (forceDEXPath) {
      console.log("🔧 CRITICAL FIX: Creating counter-offer to execute DEX trade");
      console.log("💡 Using actual DEX rate from pathfinding analysis");
      
      try {
        // Create an OfferCreate transaction that will immediately cross with the existing offer
        // Use the actual target amount and REAL exchange rate from pathfinding
        const targetAmount = paymentType === "exact_output" ? exactOutputAmount : recommendation.estimatedOutput;
        const actualRate = recommendation.rate; // Use the real rate from pathfinding
        const requiredInput = parseFloat(targetAmount) / actualRate; // Calculate actual input needed
        
        console.log(`📊 DEX Rate Analysis:`);
        console.log(`   Target Output: ${targetAmount} ${receiveCurrency}`);
        console.log(`   Actual DEX Rate: ${actualRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}`);
        console.log(`   Required Input: ${requiredInput.toFixed(6)} ${sendCurrency}`);
        
        const counterOfferTx = {
          TransactionType: "OfferCreate",
          Account: senderWallet.address,
          TakerGets: {
            currency: receiveCurrency,
            issuer: issuerAddress,
            value: targetAmount.toString()  // We want the actual target amount
          },
          TakerPays: {
            currency: sendCurrency, 
            issuer: issuerAddress,
            value: requiredInput.toFixed(6)  // Pay the calculated amount based on actual rate
          },
          Flags: 0x00040000  // tfImmediateOrCancel - execute immediately or cancel
        };
        
        console.log("🔧 Creating counter-offer with actual exchange rate:");
        console.log(JSON.stringify(counterOfferTx, null, 2));
        
        // Submit the counter-offer
        const prepared = await client.autofill(counterOfferTx);
        const signed = senderWallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        if (result.result.meta.TransactionResult === "tesSUCCESS") {
          console.log("✅ DEX trade executed successfully via counter-offer!");
          console.log(`📋 Transaction Hash: ${result.result.hash}`);
          
          // Create a message string by building it line by line
          let message = "";
          message += "\n=== DEX TRADE COMPLETED ===\n";
          message += `💸 Amount Sent: ${requiredInput.toFixed(6)} ${sendCurrency}\n`;
          message += `💰 Amount Delivered: ${targetAmount} ${receiveCurrency}\n`;
          message += `📈 Exchange Rate: ${actualRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}\n`;
          message += `🎯 Routing Method: DEX (Counter-Offer)\n`;
          message += `📋 Ledger Index: ${result.result.ledger_index}\n`;
          message += "============================\n";
          
          // Return early - we've completed the trade
          return {
            success: true,
            transactionHash: result.result.hash,
            ledgerIndex: result.result.ledger_index,
            deliveredAmount: `${targetAmount} ${receiveCurrency}`,
            sentAmount: `${requiredInput.toFixed(6)} ${sendCurrency}`,
            routingMethod: "DEX (Counter-Offer)",
            exchangeRate: actualRate,  // Use the actual calculated rate
            message: message // Add the message to the return object
          };
        } else {
          console.log(`❌ Counter-offer failed: ${result.result.meta.TransactionResult}`);
          console.log("🔄 Falling back to payment transaction");
        }
        
      } catch (offerError) {
        console.log(`❌ Counter-offer error: ${offerError.message}`);
        console.log("🔄 Falling back to payment transaction");
      }
    }
    
    if (recommendation.path && recommendation.path.hops && recommendation.path.hops.length > 0) {
      console.log("🛤️ Multi-hop route detected - forcing explicit path");
      console.log(`🔀 Path: ${recommendation.path.path}`);
      
      // Construct explicit path for multi-hop routing
      const explicitPath = [];
      
      if (recommendation.path.intermediateCurrency) {
        // Add intermediate currency to path
        const intermediateCurrency = recommendation.path.intermediateCurrency;
        
        if (intermediateCurrency === 'XRP') {
          explicitPath.push({ currency: 'XRP' });
        } else {
          explicitPath.push({
            currency: intermediateCurrency,
            issuer: issuerAddress
          });
        }
        
        console.log(`🔗 Added intermediate currency to path: ${intermediateCurrency}`);
        paymentTx.Paths = [explicitPath];
        
        console.log("✅ Using explicit path for multi-hop routing");
      }
    } else if (useAmmPreference) {
      console.log("📍 Single-hop AMM route - letting XRPL find optimal AMM path");
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
    
    // Handle wallet object creation if needed
    let walletObject = senderWallet;
    if (senderWallet.seed && !senderWallet.sign) {
      // Create wallet object from seed
      walletObject = xrpl.Wallet.fromSeed(senderWallet.seed);
    }
    
    const signedTx = walletObject.sign(preparedTx);
    
    console.log("🚀 Submitting smart cross-currency payment...");
    const response = await client.submitAndWait(signedTx.tx_blob);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      console.log("✅ Smart cross-currency payment successful!");
      
      // Parse transaction metadata to get actual amounts and detect routing method
      let actualAmountSent = "Unknown";
      let actualAmountDelivered = "Unknown";
              let actualRoutingMethod = recommendation.type;
      
      try {
        // Get AffectedNodes from transaction metadata
        const affectedNodes = response.result.meta.AffectedNodes || [];
        
        // Parse actual amount sent from transaction metadata
        let actualSentAmount = null;
        
        // Look through AffectedNodes to find the actual amount sent
        affectedNodes.forEach(node => {
          const nodeData = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
          if (!nodeData) return;
          
          // Look for RippleState changes for the sender's account
          if (nodeData.LedgerEntryType === "RippleState") {
            const prevFields = nodeData.PreviousFields;
            const finalFields = nodeData.FinalFields;
            
            if (prevFields && finalFields) {
              // Check if this is the sending currency
              const balanceChange = parseFloat(finalFields.Balance || 0) - parseFloat(prevFields.Balance || 0);
              
              // For the sender, the balance should decrease (negative change)
              if (balanceChange < 0) {
                const actualSent = Math.abs(balanceChange);
                if (!actualSentAmount || actualSent > actualSentAmount) {
                  actualSentAmount = actualSent;
                }
              }
            }
          }
          
          // Also check AccountRoot for XRP changes
          if (nodeData.LedgerEntryType === "AccountRoot" && nodeData.FinalFields?.Account === walletObject.classicAddress) {
            const prevBalance = parseFloat(nodeData.PreviousFields?.Balance || 0);
            const finalBalance = parseFloat(nodeData.FinalFields?.Balance || 0);
            const xrpChange = (prevBalance - finalBalance) / 1000000; // Convert drops to XRP
            
            if (sendCurrency === "XRP" && xrpChange > 0.000012) { // Exclude just the fee
              actualSentAmount = xrpChange - 0.000012; // Subtract the transaction fee
            }
          }
        });
        
        // Format the actual amount sent
        if (actualSentAmount !== null) {
          if (sendCurrency === "XRP") {
            actualAmountSent = `${actualSentAmount.toFixed(6)} XRP`;
          } else {
            actualAmountSent = `${actualSentAmount.toFixed(6)} ${sendCurrency}`;
          }
        } else {
          // Fallback to SendMax if we can't determine actual amount
          if (typeof sendMax === 'string') {
            actualAmountSent = `${xrpl.dropsToXrp(sendMax)} XRP (max)`;
          } else {
            actualAmountSent = `${sendMax.value} ${sendMax.currency} (max)`;
          }
        }
        
        // Always show the actual delivered amount from XRPL
        if (response.result.meta.delivered_amount) {
          const delivered = response.result.meta.delivered_amount;
          actualAmountDelivered = typeof delivered === 'string' ? 
            `${xrpl.dropsToXrp(delivered)} XRP` : 
            `${delivered.value} ${delivered.currency}`;
        }
        
        // Analyze AffectedNodes to detect routing method used
        // (affectedNodes already declared above)
        let hasAmmUsage = false;
        let hasDexOfferUsage = false;
        let ammAccountsDetected = [];
        
        affectedNodes.forEach(node => {
          const nodeData = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
          if (!nodeData) return;
          
          // Check for AMM-specific ledger entry types
          if (nodeData.LedgerEntryType === "AMM") {
            hasAmmUsage = true;
            console.log(`🔍 Detected AMM ledger entry modification`);
          }
          
          // Check for AMM account modifications (look for accounts with special AMM characteristics)
          if (nodeData.LedgerEntryType === "AccountRoot") {
            const account = nodeData.FinalFields?.Account || nodeData.PreviousFields?.Account;
            
            // Check if this account has AMM-specific fields
            if (nodeData.FinalFields?.AMMID || nodeData.PreviousFields?.AMMID) {
              hasAmmUsage = true;
              const ammId = nodeData.FinalFields?.AMMID || nodeData.PreviousFields?.AMMID;
              console.log(`🔍 Detected AMM account modification (AMMID: ${ammId})`);
              ammAccountsDetected.push(account);
            }
            
            // Also check for accounts that look like AMM accounts (they often have specific patterns)
            if (account && account.startsWith('r') && account.length === 34) {
              // Check if balance changes suggest AMM activity
              const prevBalance = nodeData.PreviousFields?.Balance;
              const finalBalance = nodeData.FinalFields?.Balance;
              if (prevBalance && finalBalance && prevBalance !== finalBalance) {
                // This could be AMM activity - we'll count it if pathfinding suggested AMM
                if (recommendation.type === 'AMM') {
                  hasAmmUsage = true;
                  console.log(`🔍 Detected potential AMM account activity: ${account}`);
                  ammAccountsDetected.push(account);
                }
              }
            }
          }
          
          // Check for RippleState modifications (trustline changes - common in AMM)
          if (nodeData.LedgerEntryType === "RippleState") {
            // RippleState changes often indicate AMM activity
            if (recommendation.type === 'AMM') {
              hasAmmUsage = true;
              console.log(`🔍 Detected trustline modification (likely AMM activity)`);
            }
          }
          
          // Check for DEX offer modifications (traditional order book)
          if (nodeData.LedgerEntryType === "Offer") {
            hasDexOfferUsage = true;
            console.log(`🔍 Detected DEX offer modification`);
          }
        });
        
        // Fallback: Trust pathfinding result if we can't detect usage
        if (!hasAmmUsage && !hasDexOfferUsage) {
          console.log(`🔍 No direct routing evidence found, trusting pathfinding result: ${recommendation.type}`);
          if (recommendation.type === 'AMM') {
            hasAmmUsage = true;
          } else if (recommendation.type === 'DEX') {
            hasDexOfferUsage = true;
          }
        }
        
        // Determine actual routing method
        if (hasAmmUsage && hasDexOfferUsage) {
          actualRoutingMethod = "Hybrid (AMM + DEX)";
        } else if (hasAmmUsage) {
          actualRoutingMethod = "AMM";
        } else if (hasDexOfferUsage) {
          actualRoutingMethod = "DEX";
        } else {
          actualRoutingMethod = recommendation.type; // Fallback to pathfinding
        }
        
        console.log(`🔍 Routing analysis: AMM usage: ${hasAmmUsage}, DEX usage: ${hasDexOfferUsage}`);
        if (ammAccountsDetected.length > 0) {
          console.log(`🔍 AMM accounts involved: ${ammAccountsDetected.slice(0, 2).join(', ')}${ammAccountsDetected.length > 2 ? '...' : ''}`);
        }
        
      } catch (parseError) {
        console.error("Error parsing transaction amounts:", parseError.message);
      }
      
      let message = "";
      message += "\n=== Smart Cross-Currency Payment Details ===\n";
      message += `👛 From: ${walletObject.classicAddress}\n`;
      message += `👛 To: ${destinationAddress}\n`;
      message += `💸 Amount Sent: ${actualAmountSent}\n`;
      message += `💰 Amount Delivered: ${actualAmountDelivered}\n`;
      message += `🎯 Routing Method: ${actualRoutingMethod}\n`;
      
      // Create user-friendly rate display for the exchange rate
      let displayRate = recommendation.rate;
      let rateLabel = `${receiveCurrency}/${sendCurrency}`;
      
      if (receiveCurrency === 'XRP' && sendCurrency !== 'XRP') {
        rateLabel = `XRP per ${sendCurrency}`;
      } else if (sendCurrency === 'XRP' && receiveCurrency !== 'XRP') {
        rateLabel = `${receiveCurrency} per XRP`;
      }
      
      message += `📈 Exchange Rate: ${displayRate.toFixed(6)} ${rateLabel}\n`;
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
        response: response,
        message: message // Add the message to the return object
      };
    } else {
      throw new Error(`Smart cross-currency payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error in smart cross-currency payment:", error.message);
    throw error;
  }
};
