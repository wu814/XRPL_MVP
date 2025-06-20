import xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";
import { analyzeMarket } from "../pathfind/corePathfindingEngine.js";

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
        // Import and use the universal AMM function for LIVE data
        const { calculateExactAMMInput } = await import('../pos/nftManager.js');
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
        
        // For exact output, preserve precise calculation if available or recalculate for multi-hop
        if (pathfindingResult.bestRoute.path && pathfindingResult.bestRoute.path.hops && pathfindingResult.bestRoute.path.hops.length > 0) {
          console.log(`🔄 Multi-hop route detected for exact output...`);
          
          // Check if we have a precise requiredInput from the multi-hop calculation
          if (pathfindingResult.bestRoute.path.requiredInput) {
            console.log(`✅ Using precise multi-hop calculation: ${pathfindingResult.bestRoute.path.requiredInput.toFixed(6)} ${sendCurrency}`);
            sendAmount = pathfindingResult.bestRoute.path.requiredInput.toString();
          } else {
            console.log(`📊 Fallback: Calculating input from multi-hop rate...`);
            // Calculate precise input needed for multi-hop route
            const optimalRate = pathfindingResult.bestRoute.rate;
            const requiredInput = parseFloat(exactOutputAmount) / optimalRate;
            
            // Add small buffer for execution slippage (2% for multi-hop - reduced from 5%)
            const executionBuffer = 1.02;
            const adjustedSendAmount = requiredInput * executionBuffer;
            sendAmount = adjustedSendAmount.toString();
            
            console.log(`📊 Multi-hop exact output calculation:`);
            console.log(`   Target: ${exactOutputAmount} ${receiveCurrency}`);
            console.log(`   Optimal rate: ${optimalRate.toFixed(6)} ${receiveCurrency}/${sendCurrency}`);
            console.log(`   Required input: ${requiredInput.toFixed(6)} ${sendCurrency}`);
            console.log(`   With 2% execution buffer: ${sendAmount} ${sendCurrency}`);
          }
        } else {
          console.log(`✅ Using precise direct route calculation: ${sendAmount} ${sendCurrency}`);
        }
      }
    }
    
    if (!pathfindingResult.success) {
      throw new Error("No viable payment paths found. This could be due to: (1) Insufficient liquidity in AMMs/order books, (2) Missing trustlines, (3) DepositAuth restrictions, or (4) Pathfinding limitations. Try a smaller amount or different currency pair.");
    }
    
    const recommendation = pathfindingResult.bestRoute;
    console.log(`🏆 Optimal route: ${recommendation.type} (Rate: ${recommendation.rate.toFixed(6)})`);
    console.log(`💰 Expected output: ${recommendation.estimatedOutput} ${receiveCurrency}`);
    
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
      // For exact input, add slippage buffer as before
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
      console.log(`💰 Exact Input SendMax: Added ${slippagePercent}% slippage buffer`);
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
      // For exact input, use estimated output with buffer
      if (receiveCurrency === "XRP") {
        const targetXRP = parseFloat(recommendation.estimatedOutput) * 1.1; // 10% buffer
        destinationCurrency = xrpl.xrpToDrops(Math.max(targetXRP, 0.000001).toFixed(6));
      } else {
        const targetAmount = parseFloat(recommendation.estimatedOutput) * 1.1; // 10% buffer
        destinationCurrency = {
          currency: receiveCurrency,
          issuer: issuerAddress,
          value: Math.max(targetAmount, 0.000001).toFixed(6)
        };
      }
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
    
    if (recommendation.type === 'AMM') {
      console.log("🔧 Using AMM-preferred routing (let XRPL find best AMM path)");
      console.log(`🎯 Expected AMM Account: ${recommendation.path?.ammAccount || 'Auto-detected'}`);
      useAmmPreference = true;
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
    
    // Step 8: Force multi-hop path when our analysis shows it's optimal
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
        
        // Use NoRippleDirect flag to force using our explicit path
        paymentTx.Flags |= 0x00010000; // tfNoRippleDirect
        console.log("🚫 Added NoRippleDirect flag to force explicit path usage");
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
        
        // The delivered_amount field shows what was actually delivered
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
      
      // Build summary message instead of console.log
      let message = "\n=== Smart Cross-Currency Payment Details ===\n";
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
        message // <-- add message to return object
      };
    } else {
      throw new Error(`Smart cross-currency payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error in smart cross-currency payment:", error.message);
    throw error;
  }
}

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
export async function sendCrossCurrencyAmmOnly(
  senderWallet, 
  destinationAddress, 
  sendCurrency, 
  sendAmount, 
  receiveCurrency, 
  issuerAddress,
  slippagePercent = 0,
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
        const { getAllAmmInfo } = await import('../amm/getAmmInfo.js');
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
    
    // Handle wallet object creation if needed
    let walletObject = senderWallet;
    if (senderWallet.seed && !senderWallet.sign) {
      // Create wallet object from seed
      walletObject = xrpl.Wallet.fromSeed(senderWallet.seed);
    }
    
    const signedTx = walletObject.sign(preparedTx);
    
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
      
      // Build summary message instead of console.log
      let message = "\n=== AMM-Only Cross-Currency Payment Details ===\n";
      message += `👛 From: ${senderWallet.classicAddress}\n`;
      message += `👛 To: ${destinationAddress}\n`;
      message += `💸 Amount Sent: ${actualAmountSent}\n`;
      message += `💰 Amount Delivered: ${actualAmountDelivered}\n`;
      message += `🎯 Routing Method: AMM-Only\n`;
      message += `📋 Transaction Hash: ${response.result.hash}\n`;
      message += `📋 Ledger Index: ${response.result.ledger_index}\n`;

      return {
        success: true,
        txHash: response.result.hash,
        ledgerIndex: response.result.ledger_index,
        amountSent: actualAmountSent,
        amountDelivered: actualAmountDelivered,
        routingMethod: "AMM-Only",
        response: response,
        message // <-- add message to return object
      };
    } else {
      throw new Error(`AMM-only cross-currency payment failed: ${response.result.meta.TransactionResult}`);
    }
  } catch (error) {
    console.error("❌ Error in AMM-only cross-currency payment:", error.message);
    throw error;
  }
} 