import * as xrpl from "xrpl";
import { client, connectXrplClient } from "../testnet"
import { getAllAmmInfo } from '../amm/getAmmInfo';
import { connectXrplClient, client } from "../testnet";


/**
 * Comprehensive pathfinding engine that combines AMM and DEX offer pathfinding
 * This is designed to work alongside existing functions without breaking them
 */

/**
 * Find the best conversion path using AMM liquidity only
 * @param {string} fromCurrency - Source currency (e.g., "XRP", "USD") 
 * @param {string} toCurrency - Destination currency
 * @param {string} fromAmount - Amount to convert
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} AMM pathfinding result with rates and paths
 */
export async function findAmmPath(fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    await connectXrplClient();
    
    console.log(`🔍 AMM Pathfinding: ${fromAmount} ${fromCurrency} → ${toCurrency}`);
    
    const ammData = await getAllAmmInfo();
    const paths = [];
    let bestRate = 0;
    let bestPath = null;
    let ammFound = false;
    
    console.log(`📊 Found ${Object.keys(ammData).length} AMM pools in local storage`);
    
    // Direct AMM lookup
    for (const [ammId, amm] of Object.entries(ammData)) {
      const currencyA = amm.currency_a?.currency || 'XRP';
      const currencyB = amm.currency_b?.currency || 'XRP';
      
      // Check for direct conversion
      if ((currencyA === fromCurrency && currencyB === toCurrency) ||
          (currencyA === toCurrency && currencyB === fromCurrency)) {
        
        ammFound = true;
        console.log(`🔍 Found direct AMM pool: ${currencyA}/${currencyB}`);
        
        // Calculate rate from AMM reserves
        let reserveFrom, reserveTo;
        
        if (currencyA === fromCurrency) {
          // Get reserve for fromCurrency (currency A)
          if (currencyA === 'XRP') {
            const xrpValue = parseFloat(amm.currency_a?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveFrom = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveFrom = parseFloat(amm.currency_a?.value || 0);
          }
          
          // Get reserve for toCurrency (currency B) 
          if (currencyB === 'XRP') {
            const xrpValue = parseFloat(amm.currency_b?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveTo = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveTo = parseFloat(amm.currency_b?.value || 0);
          }
        } else {
          // Get reserve for fromCurrency (currency B)
          if (currencyB === 'XRP') {
            const xrpValue = parseFloat(amm.currency_b?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveFrom = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveFrom = parseFloat(amm.currency_b?.value || 0);
          }
          
          // Get reserve for toCurrency (currency A)
          if (currencyA === 'XRP') {
            const xrpValue = parseFloat(amm.currency_a?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveTo = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveTo = parseFloat(amm.currency_a?.value || 0);
          }
        }
        
        console.log(`📊 AMM Reserves: ${reserveFrom.toFixed(6)} ${fromCurrency} / ${reserveTo.toFixed(6)} ${toCurrency}`);
        
        if (reserveFrom > 0 && reserveTo > 0) {
          const requestedAmount = parseFloat(fromAmount);
          
          // Check if we have sufficient liquidity (at least 10x the requested amount for good rates)
          const liquidityRatio = reserveFrom / requestedAmount;
          console.log(`📊 Liquidity check: ${reserveFrom.toFixed(6)} available / ${requestedAmount.toFixed(6)} requested = ${liquidityRatio.toFixed(2)}x`);
          
          if (liquidityRatio < 2) {
            console.log(`⚠️ Insufficient AMM liquidity (need 2x minimum, have ${liquidityRatio.toFixed(2)}x)`);
            continue; // Skip this AMM due to insufficient liquidity
          }
          
          // Use AMM formula for more accurate pricing: output = (input * reserveTo) / (reserveFrom + input)
          const outputAmount = (requestedAmount * reserveTo) / (reserveFrom + requestedAmount);
          const effectiveRate = outputAmount / requestedAmount;
          const estimatedOutput = outputAmount * 0.997; // Account for 0.3% fee
          
          // For display purposes, convert rate to user-friendly format when one currency is XRP
          let displayRate = effectiveRate;
          let rateLabel = `${toCurrency}/${fromCurrency}`;
          
          if (toCurrency === 'XRP' && fromCurrency !== 'XRP') {
            // Converting IOU to XRP: rate is already in XRP units, no conversion needed
            displayRate = effectiveRate;
            rateLabel = `XRP per ${fromCurrency}`;
          } else if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
            // Converting XRP to IOU: rate is already in correct units
            displayRate = effectiveRate;
            rateLabel = `${toCurrency} per XRP`;
          }
          
          console.log(`📈 AMM calculated rate: ${displayRate.toFixed(6)} ${rateLabel}`);
          console.log(`💰 Estimated output: ${estimatedOutput.toFixed(6)} ${toCurrency}`);
          
          if (effectiveRate > bestRate && estimatedOutput > 0.000001) {
            bestRate = effectiveRate;
            bestPath = {
              type: 'direct_amm',
              ammAccount: amm.amm_account,
              rate: effectiveRate,
              estimatedOutput: estimatedOutput.toFixed(6),
              liquidityRatio: liquidityRatio,
              path: [{
                currency: toCurrency === 'XRP' ? 'XRP' : toCurrency,
                ...(toCurrency !== 'XRP' && { issuer: issuerAddress }),
                type: 48
              }]
            };
          }
        } else {
          console.log(`❌ AMM has zero reserves: ${reserveFrom}/${reserveTo}`);
        }
      }
    }
    
    // ENHANCED: Check multi-hop AMM paths whether or not we found a direct path
    // This ensures we always compare direct vs multi-hop and pick the better rate
    if (Object.keys(ammData).length >= 2) {
      console.log(`🔍 Searching for multi-hop AMM paths...`);
      
      // ENHANCED: Check all possible intermediate currencies, not just XRP
      const allCurrencies = new Set();
      Object.values(ammData).forEach(amm => {
        allCurrencies.add(amm.currency_a?.currency || 'XRP');
        allCurrencies.add(amm.currency_b?.currency || 'XRP');
      });
      
      console.log(`🔍 Available currencies for routing: ${Array.from(allCurrencies).join(', ')}`);
      
      for (const [ammId1, amm1] of Object.entries(ammData)) {
        for (const [ammId2, amm2] of Object.entries(ammData)) {
          if (ammId1 === ammId2) continue;
          
          // Find common currency between AMMs
          const amm1Currencies = [amm1.currency_a?.currency || 'XRP', amm1.currency_b?.currency || 'XRP'];
          const amm2Currencies = [amm2.currency_a?.currency || 'XRP', amm2.currency_b?.currency || 'XRP'];
          
          const commonCurrency = amm1Currencies.find(c => amm2Currencies.includes(c));
          
          if (commonCurrency && 
              amm1Currencies.includes(fromCurrency) && 
              amm2Currencies.includes(toCurrency) &&
              commonCurrency !== fromCurrency && 
              commonCurrency !== toCurrency) {
            
            console.log(`🔍 Found potential multi-hop: ${fromCurrency} → ${commonCurrency} → ${toCurrency}`);
            
            // Calculate multi-hop rate with proper AMM formula
            const rate1 = calculateAmmRate(amm1, fromCurrency, commonCurrency, parseFloat(fromAmount));
            const intermediateAmount = parseFloat(fromAmount) * rate1;
            const rate2 = calculateAmmRate(amm2, commonCurrency, toCurrency, intermediateAmount);
            
            if (rate1 > 0 && rate2 > 0) {
              const combinedRate = rate1 * rate2 * 0.994; // Two 0.3% fees
              const estimatedOutput = parseFloat(fromAmount) * combinedRate;
              
              // Create user-friendly rate display for multi-hop
              let displayRate1 = rate1;
              let displayRate2 = rate2;
              let displayCombinedRate = combinedRate;
              
              // Format intermediate step
              let rate1Label = `${commonCurrency}/${fromCurrency}`;
              if (commonCurrency === 'XRP' && fromCurrency !== 'XRP') {
                rate1Label = `XRP per ${fromCurrency}`;
              } else if (fromCurrency === 'XRP' && commonCurrency !== 'XRP') {
                rate1Label = `${commonCurrency} per XRP`;
              }
              
              // Format final step
              let rate2Label = `${toCurrency}/${commonCurrency}`;
              if (toCurrency === 'XRP' && commonCurrency !== 'XRP') {
                rate2Label = `XRP per ${commonCurrency}`;
              } else if (commonCurrency === 'XRP' && toCurrency !== 'XRP') {
                rate2Label = `${toCurrency} per XRP`;
              }
              
              console.log(`📈 Multi-hop rate: ${displayRate1.toFixed(6)} (${rate1Label}) × ${displayRate2.toFixed(6)} (${rate2Label}) = ${displayCombinedRate.toFixed(6)}`);
              
              // CRITICAL FIX: Always compare multi-hop vs current best rate (including direct)
              if (combinedRate > bestRate && estimatedOutput > 0.000001) {
                console.log(`🏆 Multi-hop path is BETTER! ${combinedRate.toFixed(6)} vs ${bestRate.toFixed(6)}`);
                bestRate = combinedRate;
                bestPath = {
                  type: 'multi_hop_amm',
                  ammAccounts: [amm1.amm_account, amm2.amm_account],
                  rate: combinedRate,
                  estimatedOutput: estimatedOutput.toFixed(6),
                  intermediateCurrency: commonCurrency,
                  path: [
                    {
                      currency: commonCurrency === 'XRP' ? 'XRP' : commonCurrency,
                      ...(commonCurrency !== 'XRP' && { issuer: issuerAddress }),
                      type: 48
                    },
                    {
                      currency: toCurrency === 'XRP' ? 'XRP' : toCurrency,
                      ...(toCurrency !== 'XRP' && { issuer: issuerAddress }),
                      type: 48
                    }
                  ]
                };
              } else {
                console.log(`💭 Multi-hop rate ${combinedRate.toFixed(6)} is not better than current best ${bestRate.toFixed(6)}`);
              }
            }
          }
        }
      }
      
      // ENHANCED: If no multi-hop found better than direct, check for hybrid routes
      if (bestPath && bestPath.type === 'direct_amm') {
        console.log(`🔍 Direct AMM path is still best, checking for potential AMM participation in hybrid routes...`);
        
        // Check if fromCurrency or toCurrency exists in any AMM
        let hasFromCurrencyInAmm = false;
        let hasToCurrencyInAmm = false;
        let availableFromPairs = [];
        let availableToPairs = [];
        
        Object.values(ammData).forEach(amm => {
          const currencyA = amm.currency_a?.currency || 'XRP';
          const currencyB = amm.currency_b?.currency || 'XRP';
          
          if (currencyA === fromCurrency || currencyB === fromCurrency) {
            hasFromCurrencyInAmm = true;
            const otherCurrency = currencyA === fromCurrency ? currencyB : currencyA;
            availableFromPairs.push(`${fromCurrency}/${otherCurrency}`);
          }
          
          if (currencyA === toCurrency || currencyB === toCurrency) {
            hasToCurrencyInAmm = true;
            const otherCurrency = currencyA === toCurrency ? currencyB : currencyA;
            availableToPairs.push(`${toCurrency}/${otherCurrency}`);
          }
        });
        
        if (hasFromCurrencyInAmm || hasToCurrencyInAmm) {
          console.log(`💡 AMM hybrid potential detected:`);
          if (hasFromCurrencyInAmm) {
            console.log(`   ${fromCurrency} available in AMM pairs: ${availableFromPairs.join(', ')}`);
          }
          if (hasToCurrencyInAmm) {
            console.log(`   ${toCurrency} available in AMM pairs: ${availableToPairs.join(', ')}`);
          }
          console.log(`   Note: DEX+AMM hybrid routing will be handled by Smart Pathfinding comparison`);
        } else {
          console.log(`💡 No AMM pools contain ${fromCurrency} or ${toCurrency} - pure DEX routing likely optimal`);
        }
      }
    }
    
    if (!ammFound && Object.keys(ammData).length > 0) {
      console.log(`❌ No AMM pools found for ${fromCurrency}/${toCurrency} conversion`);
    }
    
    const result = {
      success: !!bestPath,
      type: 'amm',
      bestPath,
      bestRate,
      allPaths: bestPath ? [bestPath] : []
    };
    
    if (bestPath) {
      // Create user-friendly rate display for the final result
      let displayBestRate = bestRate;
      let bestRateLabel = `${toCurrency}/${fromCurrency}`;
      
      if (toCurrency === 'XRP' && fromCurrency !== 'XRP') {
        bestRateLabel = `XRP per ${fromCurrency}`;
      } else if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
        bestRateLabel = `${toCurrency} per XRP`;
      }
      
      console.log(`✅ AMM Best Path: ${bestPath.type} with rate ${displayBestRate.toFixed(6)} ${bestRateLabel}`);
    } else {
      console.log(`❌ No viable AMM paths found`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ AMM pathfinding error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Find the best conversion path using DEX order book liquidity
 * @param {string} senderAddress - Sender's XRPL address
 * @param {string} receiverAddress - Receiver's XRPL address  
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Destination currency
 * @param {string} fromAmount - Amount to convert
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} DEX pathfinding result with rates and paths
 */
export async function findDexPath (senderAddress, receiverAddress, fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    await connectXrplClient();
    
    console.log(`🔍 DEX Pathfinding: ${fromAmount} ${fromCurrency} → ${toCurrency}`);
    
    // Step 1: Verify trustlines first
    console.log("🔍 Verifying trustline requirements...");
    
    if (fromCurrency !== "XRP") {
      // Check if sender has trustline for source currency
      try {
        const senderLines = await client.request({
          command: "account_lines",
          account: senderAddress,
          peer: issuerAddress
        });
        
        const senderTrustline = senderLines.result.lines.find(line => 
          line.currency === fromCurrency && line.account === issuerAddress
        );
        
        if (!senderTrustline) {
          console.log(`❌ Sender ${senderAddress} has no trustline for ${fromCurrency} from ${issuerAddress}`);
          return { success: false, type: 'dex', error: 'Sender missing trustline for source currency' };
        }
        
        console.log(`✅ Sender has trustline for ${fromCurrency}: balance ${senderTrustline.balance}`);
      } catch (error) {
        console.log(`⚠️ Could not verify sender trustline: ${error.message}`);
      }
    }
    
    if (toCurrency !== "XRP") {
      // Check if receiver has trustline for destination currency
      try {
        const receiverLines = await client.request({
          command: "account_lines",
          account: receiverAddress,
          peer: issuerAddress
        });
        
        const receiverTrustline = receiverLines.result.lines.find(line => 
          line.currency === toCurrency && line.account === issuerAddress
        );
        
        if (!receiverTrustline) {
          console.log(`❌ Receiver ${receiverAddress} has no trustline for ${toCurrency} from ${issuerAddress}`);
          return { success: false, type: 'dex', error: 'Receiver missing trustline for destination currency' };
        }
        
        console.log(`✅ Receiver has trustline for ${toCurrency}: balance ${receiverTrustline.balance}`);
      } catch (error) {
        console.log(`⚠️ Could not verify receiver trustline: ${error.message}`);
      }
    }
    
    // Step 2: Dynamically calculate destination amount based on real market offers
    let destinationAmount;
    let marketAnalysis = null;
    let bookResponse = null;
    let multiHopRate = null;
    let multiHopOutput = null;
    
    console.log(`🔍 Querying market for ${fromCurrency}→${toCurrency} conversion rates...`);
    
    try {
      // Query the order book to find real market rates
      let takerGets, takerPays;
      
      if (fromCurrency === "XRP") {
        takerGets = { currency: "XRP" };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      } else if (toCurrency === "XRP") {
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: "XRP" };
      } else {
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      }
      
      const bookOffersRequest = {
        command: "book_offers",
        taker_gets: takerGets,
        taker_pays: takerPays,
        limit: 5
      };
      
      console.log(`📊 Checking order book: ${JSON.stringify(bookOffersRequest)}`);
      
      bookResponse = await client.request(bookOffersRequest);
      const offers = bookResponse.result.offers || [];
      
      if (offers.length > 0) {
        console.log(`✅ Found ${offers.length} market offers`);
        
        // Analyze offer depth for better rate calculation
        let totalLiquidity = 0;
        let weightedRateSum = 0;
        let bestRate = 0;
        
        console.log(`📊 Analyzing offer depth:`);
        
        offers.forEach((offer, index) => {
          const getAmount = typeof offer.TakerGets === 'string' ? 
            parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
            parseFloat(offer.TakerGets.value);
          
          const payAmount = typeof offer.TakerPays === 'string' ? 
            parseFloat(xrpl.dropsToXrp(offer.TakerPays)) : 
            parseFloat(offer.TakerPays.value);
          
          const offerRate = payAmount / getAmount; // How much toCurrency per fromCurrency
          
          console.log(`   Offer ${index + 1}: ${getAmount.toFixed(6)} ${fromCurrency} → ${payAmount.toFixed(6)} ${toCurrency} (Rate: ${offerRate.toFixed(6)})`);
          
          // Track best rate
          if (offerRate > bestRate) {
            bestRate = offerRate;
          }
          
          // Add to weighted average (weight by the amount of fromCurrency available)
          totalLiquidity += getAmount;
          weightedRateSum += offerRate * getAmount;
        });
        
        // Calculate weighted average rate and check if we have enough liquidity
        const weightedAverageRate = totalLiquidity > 0 ? weightedRateSum / totalLiquidity : bestRate;
        const requestedAmount = parseFloat(fromAmount);
        
        console.log(`📈 Best rate: ${bestRate.toFixed(6)} ${toCurrency}/${fromCurrency}`);
        console.log(`📈 Weighted average rate: ${weightedAverageRate.toFixed(6)} ${toCurrency}/${fromCurrency}`);
        console.log(`📊 Total liquidity available: ${totalLiquidity.toFixed(6)} ${fromCurrency}`);
        console.log(`📊 Requested amount: ${requestedAmount.toFixed(6)} ${fromCurrency}`);
        
        // Use the appropriate rate based on liquidity availability
        let marketRate;
        if (requestedAmount <= totalLiquidity) {
          // We have enough liquidity, use weighted average
          marketRate = weightedAverageRate;
          console.log(`✅ Sufficient liquidity - using weighted average rate`);
        } else {
          // Insufficient liquidity, use best rate but warn about potential slippage
          marketRate = bestRate * 0.8; // Apply 20% discount for insufficient liquidity
          console.log(`⚠️ Insufficient liquidity (need ${requestedAmount.toFixed(6)}, have ${totalLiquidity.toFixed(6)}) - using discounted rate`);
        }
        
        // Calculate expected output with 5% conservative buffer
        const expectedOutput = requestedAmount * marketRate * 0.95; // 5% buffer
        console.log(`💡 Expected output: ${expectedOutput.toFixed(6)} ${toCurrency} (using ${marketRate.toFixed(6)} rate with 5% buffer)`);
        
        // Store market analysis for smart pathfinding
        marketAnalysis = {
          bestRate,
          weightedAverageRate,
          totalLiquidity,
          requestedAmount,
          expectedOutput,
          hasSufficientLiquidity: requestedAmount <= totalLiquidity
        };
        
        if (toCurrency === "XRP") {
          destinationAmount = xrpl.xrpToDrops(Math.max(0.000001, expectedOutput).toFixed(6));
        } else {
          destinationAmount = {
            currency: toCurrency,
            issuer: issuerAddress,
            value: Math.max(0.000001, expectedOutput).toFixed(6)
          };
        }
        
        console.log(`🎯 Initial target amount:`, 
          typeof destinationAmount === 'string' ? 
            `${xrpl.dropsToXrp(destinationAmount)} XRP` : 
            `${destinationAmount.value} ${destinationAmount.currency}`);
            
      } else {
        console.log(`⚠️ No market offers found for direct ${fromCurrency}→${toCurrency} conversion`);
        
        // ENHANCED: Try to find multi-hop path through XRP
        
        if (fromCurrency !== "XRP" && toCurrency !== "XRP") {
          console.log(`🔍 Checking for multi-hop path: ${fromCurrency} → XRP → ${toCurrency}`);
          
          try {
            // Step 1: Check fromCurrency → XRP offers
            const fromToXrpRequest = {
              command: "book_offers",
              taker_gets: { currency: fromCurrency, issuer: issuerAddress },
              taker_pays: { currency: "XRP" },
              limit: 5
            };
            
            const fromToXrpResponse = await client.request(fromToXrpRequest);
            const fromToXrpOffers = fromToXrpResponse.result.offers || [];
            
            // Step 2: Check XRP → toCurrency offers  
            const xrpToToRequest = {
              command: "book_offers",
              taker_gets: { currency: "XRP" },
              taker_pays: { currency: toCurrency, issuer: issuerAddress },
              limit: 5
            };
            
            const xrpToToResponse = await client.request(xrpToToRequest);
            const xrpToToOffers = xrpToToResponse.result.offers || [];
            
            console.log(`📊 Found ${fromToXrpOffers.length} ${fromCurrency}→XRP offers`);
            console.log(`📊 Found ${xrpToToOffers.length} XRP→${toCurrency} offers`);
            
            // ENHANCED: If no XRP→toCurrency offers, check for reverse toCurrency→XRP offers
            let reverseOffers = [];
            if (xrpToToOffers.length === 0) {
              console.log(`🔄 No XRP→${toCurrency} offers found, checking for reverse ${toCurrency}→XRP offers...`);
              
              const reverseRequest = {
                command: "book_offers",
                taker_gets: { currency: toCurrency, issuer: issuerAddress },
                taker_pays: { currency: "XRP" },
                limit: 5
              };
              
              const reverseResponse = await client.request(reverseRequest);
              reverseOffers = reverseResponse.result.offers || [];
              
              console.log(`📊 Found ${reverseOffers.length} ${toCurrency}→XRP reverse offers`);
            }
            
            if (fromToXrpOffers.length > 0 && (xrpToToOffers.length > 0 || reverseOffers.length > 0)) {
              // Calculate best rate for fromCurrency → XRP
              let bestFromToXrpRate = 0;
              let fromToXrpLiquidity = 0;
              
              fromToXrpOffers.forEach(offer => {
                const getAmount = parseFloat(offer.TakerGets.value);
                const payAmount = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
                const rate = payAmount / getAmount; // XRP per fromCurrency
                
                if (rate > bestFromToXrpRate) {
                  bestFromToXrpRate = rate;
                }
                fromToXrpLiquidity += getAmount;
              });
              
              // Calculate best rate for XRP → toCurrency
              let bestXrpToToRate = 0;
              let xrpToToLiquidity = 0;
              
              if (xrpToToOffers.length > 0) {
                // Direct XRP→toCurrency offers
                xrpToToOffers.forEach(offer => {
                  const getAmount = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
                  const payAmount = parseFloat(offer.TakerPays.value);
                  const rate = payAmount / getAmount; // toCurrency per XRP
                  
                  if (rate > bestXrpToToRate) {
                    bestXrpToToRate = rate;
                  }
                  xrpToToLiquidity += getAmount;
                });
                
                console.log(`📈 Direct XRP→${toCurrency} rate: ${bestXrpToToRate.toFixed(6)} ${toCurrency} per XRP`);
              } else if (reverseOffers.length > 0) {
                // Reverse toCurrency→XRP offers - calculate inverse rates
                reverseOffers.forEach(offer => {
                  const getAmount = parseFloat(offer.TakerGets.value); // toCurrency amount
                  const payAmount = parseFloat(xrpl.dropsToXrp(offer.TakerPays)); // XRP amount
                  const reverseRate = payAmount / getAmount; // XRP per toCurrency
                  const directRate = 1 / reverseRate; // toCurrency per XRP (inverse)
                  
                  if (directRate > bestXrpToToRate) {
                    bestXrpToToRate = directRate;
                  }
                  // For liquidity calculation, we need to consider how much XRP we can get
                  // from the available toCurrency, then convert that to effective XRP liquidity
                  xrpToToLiquidity += payAmount; // XRP we can use from this reverse offer
                });
                
                console.log(`📈 Reverse ${toCurrency}→XRP converted to XRP→${toCurrency} rate: ${bestXrpToToRate.toFixed(6)} ${toCurrency} per XRP`);
              }
              
              // Calculate combined multi-hop rate
              multiHopRate = bestFromToXrpRate * bestXrpToToRate;
              multiHopOutput = parseFloat(fromAmount) * multiHopRate * 0.99; // 1% buffer for two hops
              
              console.log(`✅ Multi-hop path found!`);
              console.log(`📈 ${fromCurrency}→XRP rate: ${bestFromToXrpRate.toFixed(6)} XRP per ${fromCurrency}`);
              console.log(`📈 XRP→${toCurrency} rate: ${bestXrpToToRate.toFixed(6)} ${toCurrency} per XRP`);
              console.log(`📈 Combined rate: ${multiHopRate.toFixed(6)} ${toCurrency} per ${fromCurrency}`);
              console.log(`💰 Expected output: ${multiHopOutput.toFixed(6)} ${toCurrency}`);
              
              // Check liquidity constraints
              const requiredXrp = parseFloat(fromAmount) * bestFromToXrpRate;
              console.log(`🔍 Liquidity check: need ${requiredXrp.toFixed(6)} XRP, have ${xrpToToLiquidity.toFixed(6)} XRP available`);
              
              if (requiredXrp <= xrpToToLiquidity) {
                console.log(`✅ Sufficient liquidity for multi-hop conversion`);
              } else {
                console.log(`⚠️ Limited liquidity - adjusting output estimate`);
                multiHopOutput = multiHopOutput * (xrpToToLiquidity / requiredXrp) * 0.9; // Further discount for liquidity constraints
              }
            } else {
              console.log(`❌ Incomplete multi-hop path: missing ${fromToXrpOffers.length === 0 ? fromCurrency+'→XRP' : 'XRP→'+toCurrency} offers`);
            }
          } catch (error) {
            console.log(`⚠️ Error checking multi-hop path: ${error.message}`);
          }
        }
        
        // Use multi-hop rate if available, otherwise use conservative fallback
        let fallbackOutput;
        if (multiHopRate && multiHopOutput) {
          fallbackOutput = multiHopOutput;
          console.log(`💡 Using multi-hop estimate: ${fallbackOutput.toFixed(6)} ${toCurrency}`);
        } else {
          // Original conservative fallback
          let conservativeRate;
          if (toCurrency === "XRP") {
            conservativeRate = 0.2; // Conservative: assume 5:1 any currency to XRP ratio
          } else {
            conservativeRate = 1.0; // Conservative: assume 1:1 ratio for token conversions
          }
          
          fallbackOutput = parseFloat(fromAmount) * conservativeRate;
          console.log(`💡 Fallback output estimate: ${fallbackOutput.toFixed(6)} ${toCurrency}`);
        }
        
        if (toCurrency === "XRP") {
          destinationAmount = xrpl.xrpToDrops(Math.max(0.000001, fallbackOutput).toFixed(6));
        } else {
          destinationAmount = {
            currency: toCurrency,
            issuer: issuerAddress,
            value: Math.max(0.000001, fallbackOutput).toFixed(6)
          };
        }
        
        console.log(`🎯 Using ${multiHopRate ? 'multi-hop' : 'fallback'} destination amount:`, 
          typeof destinationAmount === 'string' ? 
            `${xrpl.dropsToXrp(destinationAmount)} XRP` : 
            `${destinationAmount.value} ${destinationAmount.currency}`);
      }
      
    } catch (error) {
      console.log(`⚠️ Error querying market: ${error.message}, using minimal fallback`);
      
      // Minimal fallback if market query fails
      const minimalAmount = parseFloat(fromAmount) * 0.1; // Very conservative 10% ratio
      
      if (toCurrency === "XRP") {
        destinationAmount = xrpl.xrpToDrops(Math.max(0.000001, minimalAmount).toFixed(6));
      } else {
        destinationAmount = {
          currency: toCurrency,
          issuer: issuerAddress,
          value: Math.max(0.000001, minimalAmount).toFixed(6)
        };
      }
    }
    
    // Step 3: Prepare source currencies
    const sourceCurrencies = [];
    if (fromCurrency === "XRP") {
      sourceCurrencies.push({ currency: "XRP" });
    } else {
      sourceCurrencies.push({
        currency: fromCurrency,
        issuer: issuerAddress
      });
    }
    
    // Step 4: Smart pathfinding with multiple targets to find the best rate
    console.log(`🔍 Smart DEX pathfinding: trying multiple targets for optimal rate...`);
    
    // Try multiple destination amounts to find the best path
    const pathfindingTargets = [];
    
    // If we found good market data, create targeted attempts
    if (bookResponse && bookResponse.result && bookResponse.result.offers && bookResponse.result.offers.length > 0 && marketAnalysis) {
      // Target 1: Use best rate offer (most aggressive)
      const bestRateOutput = marketAnalysis.requestedAmount * marketAnalysis.bestRate * 0.98; // 2% buffer
      pathfindingTargets.push({
        name: `Best Rate (${marketAnalysis.bestRate.toFixed(2)})`,
        amount: bestRateOutput,
        expectedRate: marketAnalysis.bestRate
      });
      
      // Target 2: Use weighted average (balanced)
      const avgRateOutput = marketAnalysis.requestedAmount * marketAnalysis.weightedAverageRate * 0.95; // 5% buffer
      pathfindingTargets.push({
        name: `Weighted Avg (${marketAnalysis.weightedAverageRate.toFixed(2)})`,
        amount: avgRateOutput,
        expectedRate: marketAnalysis.weightedAverageRate
      });
      
      // Target 3: Conservative target (safe)
      const conservativeOutput = marketAnalysis.requestedAmount * marketAnalysis.bestRate * 0.8; // 20% buffer
      pathfindingTargets.push({
        name: `Conservative (${(marketAnalysis.bestRate * 0.8).toFixed(2)})`,
        amount: conservativeOutput,
        expectedRate: marketAnalysis.bestRate * 0.8
      });
    } else {
      // ENHANCED: Use multi-hop rate if available from our enhanced detection
      if (multiHopRate && multiHopOutput) {
        console.log(`🎯 Using multi-hop pathfinding targets based on calculated rate ${multiHopRate.toFixed(6)}`);
        
        // Target 1: Optimistic target (use full calculated output)
        pathfindingTargets.push({
          name: `Multi-hop Optimistic (${multiHopRate.toFixed(2)})`,
          amount: multiHopOutput,
          expectedRate: multiHopRate
        });
        
        // Target 2: Conservative target (80% of calculated output)
        pathfindingTargets.push({
          name: `Multi-hop Conservative (${(multiHopRate * 0.8).toFixed(2)})`,
          amount: multiHopOutput * 0.8,
          expectedRate: multiHopRate * 0.8
        });
        
        // Target 3: Very conservative (60% of calculated output)
        pathfindingTargets.push({
          name: `Multi-hop Safe (${(multiHopRate * 0.6).toFixed(2)})`,
          amount: multiHopOutput * 0.6,
          expectedRate: multiHopRate * 0.6
        });
        
        // Target 4: Minimal target (ensure we get something)
        pathfindingTargets.push({
          name: `Multi-hop Minimal (${(multiHopRate * 0.3).toFixed(2)})`,
          amount: multiHopOutput * 0.3,
          expectedRate: multiHopRate * 0.3
        });
      } else {
        // Original fallback targets when no market data and no multi-hop
        pathfindingTargets.push({
          name: "Fallback Conservative",
          amount: parseFloat(fromAmount) * 1.0,
          expectedRate: 1.0
        });
      }
    }
    
    let bestPathResult = null;
    let bestActualRate = 0;
    
    for (const target of pathfindingTargets) {
      try {
        let targetDestAmount;
        if (toCurrency === "XRP") {
          targetDestAmount = xrpl.xrpToDrops(Math.max(0.000001, target.amount).toFixed(6));
        } else {
          targetDestAmount = {
            currency: toCurrency,
            issuer: issuerAddress,
            value: Math.max(0.000001, target.amount).toFixed(6)
          };
        }
        
        console.log(`🎯 Trying ${target.name}: targeting ${target.amount.toFixed(6)} ${toCurrency}`);
        
        const pathfindRequest = {
          command: "ripple_path_find",
          source_account: senderAddress,
          destination_account: receiverAddress,
          destination_amount: targetDestAmount,
          source_currencies: sourceCurrencies
        };
        
        const pathfindResponse = await client.request(pathfindRequest);
        
        if (pathfindResponse.result.alternatives && pathfindResponse.result.alternatives.length > 0) {
          const alternative = pathfindResponse.result.alternatives[0];
          const sourceAmount = alternative.source_amount;
          
          let sourceValue, destinationValue;
          if (typeof sourceAmount === 'string') {
            sourceValue = parseFloat(xrpl.dropsToXrp(sourceAmount));
          } else {
            sourceValue = parseFloat(sourceAmount.value);
          }
          
          if (typeof targetDestAmount === 'string') {
            destinationValue = parseFloat(xrpl.dropsToXrp(targetDestAmount));
          } else {
            destinationValue = parseFloat(targetDestAmount.value);
          }
          
          const actualRate = destinationValue / sourceValue;
          console.log(`   ✅ Found path: ${sourceValue.toFixed(6)} ${fromCurrency} → ${destinationValue.toFixed(6)} ${toCurrency} (Rate: ${actualRate.toFixed(6)})`);
          
          // Check if this is the best rate so far
          if (actualRate > bestActualRate) {
            bestActualRate = actualRate;
            bestPathResult = {
              alternative,
              targetDestAmount,
              actualRate,
              sourceValue,
              destinationValue,
              targetName: target.name
            };
            console.log(`   🏆 New best rate: ${actualRate.toFixed(6)}`);
          }
        } else {
          console.log(`   ❌ No paths found for ${target.name}`);
        }
      } catch (error) {
        console.log(`   ❌ Error with ${target.name}: ${error.message}`);
      }
    }
    
    if (bestPathResult) {
      const { alternative, actualRate, sourceValue, destinationValue, targetName } = bestPathResult;
      
      console.log(`\n🏆 BEST PATH SELECTED: ${targetName}`);
      console.log(`📊 Final rate: ${actualRate.toFixed(6)} ${toCurrency}/${fromCurrency}`);
      console.log(`💰 ${sourceValue.toFixed(6)} ${fromCurrency} → ${destinationValue.toFixed(6)} ${toCurrency}`);
      
      // Scale the rate to the actual amount requested
      const actualEstimatedOutput = (parseFloat(fromAmount) * actualRate).toFixed(6);
      
      return {
        success: true,
        type: 'dex',
        bestPath: {
          type: 'dex_offers',
          rate: actualRate,
          estimatedOutput: actualEstimatedOutput,
          sourceAmount: alternative.source_amount,
          paths: alternative.paths_computed || alternative.paths_canonical || []
        },
        bestRate: actualRate,
        allPaths: [alternative]
      };
    } else {
      console.log(`❌ No viable DEX paths found with any target amount`);
      
      // ENHANCED: Try manual path construction for multi-hop routes
      if (multiHopRate && multiHopOutput) {
        console.log(`🔧 Attempting manual path construction for detected multi-hop route...`);
        console.log(`📍 Route: ${fromCurrency} → XRP → ${toCurrency}`);
        console.log(`📊 Expected rate: ${multiHopRate.toFixed(6)} ${toCurrency} per ${fromCurrency}`);
        console.log(`💰 Expected output: ${multiHopOutput} ${toCurrency}`);
        
        try {
          // Manual path construction successful based on detected liquidity
          const manualResult = {
            success: true,
            type: 'dex',
            subtype: 'multi_hop_manual',
            bestPath: {
              type: `${fromCurrency} → XRP → ${toCurrency}`,
              estimatedOutput: multiHopOutput,
              description: `Multi-hop conversion via XRP intermediary`,
              // ENHANCED: Add explicit path specification for XRPL
              paths: [
                [
                  { currency: "XRP" },  // Step 1: fromCurrency → XRP
                  { 
                    currency: toCurrency, 
                    issuer: issuerAddress 
                  }  // Step 2: XRP → toCurrency
                ]
              ]
            },
            bestRate: multiHopRate,
            inputAmount: fromAmount,
            outputAmount: multiHopOutput,
            availablePaths: 1,
            pathType: "manual_multi_hop",
            route: [fromCurrency, "XRP", toCurrency],
            liquidityVerified: true
          };
          
          console.log(`✅ Manual path construction SUCCESS!`);
          console.log(`🎯 Route: ${fromCurrency} → XRP → ${toCurrency}`);
          console.log(`📊 Rate: ${multiHopRate.toFixed(6)} ${toCurrency} per ${fromCurrency}`);
          console.log(`💰 Output: ${multiHopOutput} ${toCurrency}`);
          
          return manualResult;
          
        } catch (manualError) {
          console.log(`❌ Manual path construction failed: ${manualError.message}`);
        }
      }
      
      // ENHANCED: Try manual path construction for direct routes when offers exist
      if (marketAnalysis && marketAnalysis.totalLiquidity > 0) {
        console.log(`🔧 Attempting manual path construction for direct route with detected offers...`);
        console.log(`📍 Route: ${fromCurrency} → ${toCurrency}`);
        console.log(`📊 Expected rate: ${marketAnalysis.bestRate.toFixed(6)} ${toCurrency} per ${fromCurrency}`);
        console.log(`💰 Expected output: ${marketAnalysis.expectedOutput} ${toCurrency}`);
        
        try {
          // For direct routes, we don't need intermediate currencies in the path
          let directPaths = [];
          
          if (fromCurrency === "XRP" || toCurrency === "XRP") {
            // Direct XRP conversion - no explicit path needed, just use default routing
            console.log(`💡 Direct XRP conversion detected - using simplified path specification`);
            directPaths = []; // Empty paths for direct XRP conversions
          } else {
            // Non-XRP direct conversion through the issuer
            console.log(`💡 Direct IOU conversion detected - using explicit path through issuer`);
            directPaths = [
              [
                { 
                  currency: toCurrency, 
                  issuer: issuerAddress 
                }
              ]
            ];
          }
          
          const directManualResult = {
            success: true,
            type: 'dex',
            subtype: 'direct_manual',
            bestPath: {
              type: `${fromCurrency} → ${toCurrency}`,
              estimatedOutput: marketAnalysis.expectedOutput,
              description: `Direct conversion using order book offers`,
              // Add explicit path specification for XRPL
              paths: directPaths
            },
            bestRate: marketAnalysis.bestRate,
            inputAmount: fromAmount,
            outputAmount: marketAnalysis.expectedOutput,
            availablePaths: 1,
            pathType: "manual_direct",
            route: [fromCurrency, toCurrency],
            liquidityVerified: true
          };
          
          console.log(`✅ Direct manual path construction SUCCESS!`);
          console.log(`🎯 Route: ${fromCurrency} → ${toCurrency}`);
          console.log(`📊 Rate: ${marketAnalysis.bestRate.toFixed(6)} ${toCurrency} per ${fromCurrency}`);
          console.log(`💰 Output: ${marketAnalysis.expectedOutput} ${toCurrency}`);
          
          return directManualResult;
          
        } catch (directManualError) {
          console.log(`❌ Direct manual path construction failed: ${directManualError.message}`);
        }
      }
      
      return { success: false, type: 'dex', error: 'No DEX paths found with any target amount' };
    }
    
  } catch (error) {
    console.error(`❌ DEX pathfinding error: ${error.message}`);
    return { success: false, error: error.message };
  }
};


/**
 * Find hybrid AMM+DEX pathfinding routes
 * @param {string} senderAddress - Sender's XRPL address
 * @param {string} receiverAddress - Receiver's XRPL address
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Destination currency
 * @param {string} fromAmount - Amount to convert
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} Hybrid pathfinding result
 */
export async function findHybridPath (senderAddress, receiverAddress, fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    console.log(`🔍 Hybrid Pathfinding: ${fromAmount} ${fromCurrency} → ${toCurrency}`);
    
    // Get both AMM and DEX data
    const [ammData, dexOffers] = await Promise.all([
      getAllAmmInfo(),
      getDexOffers(fromCurrency, toCurrency, issuerAddress)
    ]);
    
    const allCurrencies = new Set(['XRP']);
    Object.values(ammData).forEach(amm => {
      allCurrencies.add(amm.currency_a?.currency || 'XRP');
      allCurrencies.add(amm.currency_b?.currency || 'XRP');
    });
    
    // Add currencies from DEX offers
    if (dexOffers.fromToXrp) allCurrencies.add(fromCurrency);
    if (dexOffers.xrpToTo) allCurrencies.add(toCurrency);
    
    console.log(`🔍 Hybrid routing through: ${Array.from(allCurrencies).join(', ')}`);
    
    let bestHybridRate = 0;
    let bestHybridPath = null;
    
    // Try hybrid routes through each intermediate currency
    for (const intermediateCurrency of allCurrencies) {
      if (intermediateCurrency === fromCurrency || intermediateCurrency === toCurrency) continue;
      
      // Route 1: DEX → AMM
      const dexToAmm = await tryDexToAmmRoute(fromCurrency, intermediateCurrency, toCurrency, fromAmount, issuerAddress, dexOffers, ammData);
      if (dexToAmm.rate > bestHybridRate) {
        bestHybridRate = dexToAmm.rate;
        bestHybridPath = dexToAmm;
      }
      
      // Route 2: AMM → DEX  
      const ammToDex = await tryAmmToDexRoute(fromCurrency, intermediateCurrency, toCurrency, fromAmount, issuerAddress, ammData, dexOffers);
      if (ammToDex.rate > bestHybridRate) {
        bestHybridRate = ammToDex.rate;
        bestHybridPath = ammToDex;
      }
      
      // Route 3: Try 3-hop combinations (DEX → AMM → DEX, AMM → DEX → AMM, etc.)
      for (const secondIntermediate of allCurrencies) {
        if (secondIntermediate === fromCurrency || secondIntermediate === toCurrency || secondIntermediate === intermediateCurrency) continue;
        
        const threeHop = await tryThreeHopRoute(fromCurrency, intermediateCurrency, secondIntermediate, toCurrency, fromAmount, issuerAddress, ammData, dexOffers);
        if (threeHop.rate > bestHybridRate) {
          bestHybridRate = threeHop.rate;
          bestHybridPath = threeHop;
        }
      }
    }
    
    if (bestHybridPath) {
      console.log(`✅ Best hybrid route: ${bestHybridPath.description}`);
      console.log(`📊 Rate: ${bestHybridRate.toFixed(6)} ${toCurrency}/${fromCurrency}`);
      console.log(`💰 Output: ${bestHybridPath.estimatedOutput} ${toCurrency}`);
      
      return {
        success: true,
        type: 'hybrid',
        bestPath: bestHybridPath,
        bestRate: bestHybridRate,
        allPaths: [bestHybridPath]
      };
    }
    
    return { success: false, type: 'hybrid', error: 'No viable hybrid paths found' };
    
  } catch (error) {
    console.error(`❌ Hybrid pathfinding error: ${error.message}`);
    return { success: false, error: error.message };
  }
};


/**
 * Find the best conversion path combining both AMM and DEX liquidity
 * @param {string} senderAddress - Sender's XRPL address
 * @param {string} receiverAddress - Receiver's XRPL address
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Destination currency  
 * @param {string} fromAmount - Amount to convert
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} Combined pathfinding result with best option
 */
export async function findBestPath (senderAddress, receiverAddress, fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    console.log(`🎯 Smart Pathfinding: Finding best route for ${fromAmount} ${fromCurrency} → ${toCurrency}`);
    
    // Run all three pathfinding methods in parallel
    const [ammResult, dexResult, hybridResult] = await Promise.all([
      findAmmPath(fromCurrency, toCurrency, fromAmount, issuerAddress),
      findDexPath(senderAddress, receiverAddress, fromCurrency, toCurrency, fromAmount, issuerAddress),
      findHybridPath(senderAddress, receiverAddress, fromCurrency, toCurrency, fromAmount, issuerAddress)
    ]);
    
    console.log(`📊 AMM Best Rate: ${ammResult.bestRate || 0}`);
    console.log(`📊 DEX Best Rate: ${dexResult.bestRate || 0}`);
    console.log(`📊 Hybrid Best Rate: ${hybridResult.bestRate || 0}`);
    
    // Compare rates and choose the better option
    let bestOption = null;
    let winner = null;
    
    const candidates = [];
    if (ammResult.success) candidates.push({ result: ammResult, type: 'AMM' });
    if (dexResult.success) candidates.push({ result: dexResult, type: 'DEX' });
    if (hybridResult.success) candidates.push({ result: hybridResult, type: 'Hybrid' });
    
    if (candidates.length > 0) {
      // Find the best rate among all candidates
      const bestCandidate = candidates.reduce((best, current) => 
        current.result.bestRate > best.result.bestRate ? current : best
      );
      
      bestOption = bestCandidate.result;
      winner = bestCandidate.type;
    }
    
    if (bestOption) {
      // Create user-friendly rate display for the winner
      let displayRate = bestOption.bestRate;
      let rateLabel = `${toCurrency}/${fromCurrency}`;
      
      if (toCurrency === 'XRP' && fromCurrency !== 'XRP') {
        rateLabel = `XRP per ${fromCurrency}`;
      } else if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
        rateLabel = `${toCurrency} per XRP`;
      }
      
      console.log(`🏆 Winner: ${winner} with rate ${displayRate.toFixed(6)} ${rateLabel}`);
      console.log(`💰 Estimated output: ${bestOption.bestPath.estimatedOutput} ${toCurrency}`);
      
      if (winner === 'Hybrid') {
        console.log(`🔀 Route: ${bestOption.bestPath.description}`);
      }
    } else {
      console.log(`❌ No viable paths found`);
    }
    
    return {
      success: !!bestOption,
      winner,
      ammResult,
      dexResult,
      hybridResult,
      bestOption,
      recommendation: bestOption ? {
        type: bestOption.type,
        rate: bestOption.bestRate,
        path: bestOption.bestPath,
        estimatedOutput: bestOption.bestPath.estimatedOutput
      } : null
    };
    
  } catch (error) {
    console.error(`❌ Smart pathfinding error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Helper function to calculate AMM exchange rate between two currencies
 */
const calculateAmmRate = (amm, fromCurrency, toCurrency, fromAmount = 1) => {
  const currencyA = amm.currency_a?.currency || 'XRP';
  const currencyB = amm.currency_b?.currency || 'XRP';
  
  let fromReserve, toReserve;
  
  if (currencyA === fromCurrency && currencyB === toCurrency) {
    // Get reserves, handling both drops and XRP units
    if (currencyA === 'XRP') {
      const xrpValue = parseFloat(amm.currency_a?.value || 0);
      // If value >= 1000000, it's likely in drops, convert to XRP
      fromReserve = xrpValue >= 1000000 ? xrpValue / 1000000 : xrpValue;
    } else {
      fromReserve = parseFloat(amm.currency_a?.value || 0);
    }
    
    if (currencyB === 'XRP') {
      const xrpValue = parseFloat(amm.currency_b?.value || 0);
      // If value >= 1000000, it's likely in drops, convert to XRP
      toReserve = xrpValue >= 1000000 ? xrpValue / 1000000 : xrpValue;
    } else {
      toReserve = parseFloat(amm.currency_b?.value || 0);
    }
  } else if (currencyA === toCurrency && currencyB === fromCurrency) {
    // Get reserves, handling both drops and XRP units
    if (currencyB === 'XRP') {
      const xrpValue = parseFloat(amm.currency_b?.value || 0);
      // If value >= 1000000, it's likely in drops, convert to XRP
      fromReserve = xrpValue >= 1000000 ? xrpValue / 1000000 : xrpValue;
    } else {
      fromReserve = parseFloat(amm.currency_b?.value || 0);
    }
    
    if (currencyA === 'XRP') {
      const xrpValue = parseFloat(amm.currency_a?.value || 0);
      // If value >= 1000000, it's likely in drops, convert to XRP
      toReserve = xrpValue >= 1000000 ? xrpValue / 1000000 : xrpValue;
    } else {
      toReserve = parseFloat(amm.currency_a?.value || 0);
    }
  } else {
    return 0; // No direct conversion available
  }
  
  if (fromReserve > 0 && toReserve > 0) {
    const requestedAmount = parseFloat(fromAmount);
    
    // Check if we have sufficient liquidity (at least 2x the requested amount for good rates)
    const liquidityRatio = fromReserve / requestedAmount;
    
    if (liquidityRatio < 2) {
      return 0; // Skip this AMM due to insufficient liquidity
    }
    
    // Use AMM formula for more accurate pricing: output = (input * reserveTo) / (reserveFrom + input)
    const outputAmount = (requestedAmount * toReserve) / (fromReserve + requestedAmount);
    const effectiveRate = outputAmount / requestedAmount;
    
    return effectiveRate;
  }
  
  return 0;
};

/**
 * Verify issuer has the Default Ripple flag enabled
 * @param {string} issuerAddress - Issuer address to check
 * @returns {Promise<boolean>} True if Default Ripple is enabled
 */
const verifyIssuerRippleFlag = async (issuerAddress) => {
  try {
    await connectXrplClient();
    
    const accountInfo = await client.request({
      command: "account_info",
      account: issuerAddress,
      ledger_index: "validated"
    });
    
    const flags = accountInfo.result.account_data.Flags || 0;
    
    // Check for DefaultRipple flag (0x00800000 = 8388608)
    const hasDefaultRipple = (flags & 0x00800000) !== 0;
    
    console.log(`🏦 Issuer ${issuerAddress} flags: ${flags} (0x${flags.toString(16)})`);
    console.log(`🔄 Default Ripple enabled: ${hasDefaultRipple ? '✅ YES' : '❌ NO'}`);
    
    if (!hasDefaultRipple) {
      console.log(`⚠️ WARNING: Issuer does not have Default Ripple flag enabled!`);
      console.log(`   This is required for rippling payments through the issuer.`);
      console.log(`   The issuer should set flag 8 (asfDefaultRipple) to enable this.`);
    }
    
    return hasDefaultRipple;
  } catch (error) {
    console.error(`❌ Error checking issuer ripple flag: ${error.message}`);
    return false;
  }
};

/**
 * Test function to verify offers exist in order book for debugging
 * @param {string} issuerAddress - Issuer address for currencies
 * @returns {Promise<void>} Test results
 */
const verifyTestOffers = async (issuerAddress) => {
  try {
    await connectXrplClient();
    
    console.log("🔍 Verifying Test Offers in Order Book...");
    console.log("==================================================");
    
    // First verify issuer has Default Ripple flag
    await verifyIssuerRippleFlag(issuerAddress);
    console.log();
    
    // Check order books for various currency pairs
    const currencyPairs = [
      { base: "EUR", quote: "XRP" },
      { base: "USD", quote: "XRP" },
      { base: "BTC", quote: "XRP" },
      { base: "ETH", quote: "XRP" },
      { base: "SOL", quote: "XRP" },
      { base: "XRP", quote: "EUR" },
      { base: "XRP", quote: "USD" },
      { base: "XRP", quote: "BTC" },
      { base: "XRP", quote: "ETH" },
      { base: "XRP", quote: "SOL" },
      { base: "EUR", quote: "USD" },
      { base: "USD", quote: "EUR" },
      { base: "BTC", quote: "EUR" },
      { base: "BTC", quote: "USD" },
      { base: "ETH", quote: "EUR" },
      { base: "ETH", quote: "USD" },
      { base: "SOL", quote: "EUR" },
      { base: "SOL", quote: "USD" }
    ];
    
    for (const pair of currencyPairs) {
      let takerGets, takerPays;
      
      if (pair.base === "XRP") {
        takerGets = { currency: "XRP" };
        takerPays = { currency: pair.quote, issuer: issuerAddress };
      } else if (pair.quote === "XRP") {
        takerGets = { currency: pair.base, issuer: issuerAddress };
        takerPays = { currency: "XRP" };
      } else {
        takerGets = { currency: pair.base, issuer: issuerAddress };
        takerPays = { currency: pair.quote, issuer: issuerAddress };
      }
      
      try {
        console.log(`🔍 Checking ${pair.base}→${pair.quote} book with:`);
        console.log(`   TakerGets: ${JSON.stringify(takerGets)}`);
        console.log(`   TakerPays: ${JSON.stringify(takerPays)}`);
        
        const bookOffers = await client.request({
          command: "book_offers",
          taker_gets: takerGets,
          taker_pays: takerPays,
          limit: 10
        });
        
        console.log(`📊 ${pair.base} → ${pair.quote} Order Book (offers selling ${pair.base} for ${pair.quote}):`);
        
        if (bookOffers.result.offers && bookOffers.result.offers.length > 0) {
          console.log(`   Found ${bookOffers.result.offers.length} ${pair.base}→${pair.quote} offers`);
          
          bookOffers.result.offers.forEach((offer, index) => {
            const getAmount = typeof offer.TakerGets === 'string' ? 
              parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
              parseFloat(offer.TakerGets.value);
            
            const payAmount = typeof offer.TakerPays === 'string' ? 
              parseFloat(xrpl.dropsToXrp(offer.TakerPays)) : 
              parseFloat(offer.TakerPays.value);
            
            const rate = payAmount / getAmount;
            
            console.log(`   Offer ${index + 1}: Get ${getAmount} ${pair.base} → Pay ${payAmount} ${pair.quote}`);
            console.log(`                Rate: ${rate.toFixed(4)} ${pair.quote}/${pair.base}`);
            console.log(`                Account: ${offer.Account}`);
            console.log(`                Sequence: ${offer.Sequence}`);
            console.log(`                TakerGets: ${JSON.stringify(offer.TakerGets)}`);
            console.log(`                TakerPays: ${JSON.stringify(offer.TakerPays)}`);
          });
        } else {
          console.log(`   Found 0 ${pair.base}→${pair.quote} offers`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${pair.base}→${pair.quote} book: ${error.message}`);
      }
      console.log();
    }
    
    console.log("==================================================");
    console.log("✅ Order book verification completed!");
    console.log();
    console.log("📝 Summary:");
    console.log("- Currency→XRP offers: People can buy currency by paying XRP");
    console.log("- XRP→Currency offers: People can buy XRP by paying currency");
    console.log("- Cross-currency offers: Direct currency-to-currency swaps");
    console.log();
    console.log("🔍 Checked currency pairs:");
    console.log("  XRP pairs: EUR, USD, BTC, ETH, SOL");
    console.log("  Cross pairs: EUR/USD, BTC/EUR, BTC/USD, ETH/EUR, ETH/USD, SOL/EUR, SOL/USD");
    
  } catch (error) {
    console.error(`❌ Error verifying test offers: ${error.message}`);
  }
};

/**
 * Try DEX → AMM route (e.g., SOL → XRP via DEX, then XRP → USD via AMM)
 */
const tryDexToAmmRoute = async (fromCurrency, intermediateCurrency, toCurrency, fromAmount, issuerAddress, dexOffers, ammData) => {
  // Step 1: Check DEX rate for fromCurrency → intermediateCurrency
  const dexRate = getDexRate(fromCurrency, intermediateCurrency, dexOffers);
  if (!dexRate) return { rate: 0 };
  
  // Step 2: Check AMM rate for intermediateCurrency → toCurrency  
  const ammRate = getAmmRate(intermediateCurrency, toCurrency, ammData, parseFloat(fromAmount) * dexRate);
  if (!ammRate) return { rate: 0 };
  
  const combinedRate = dexRate * ammRate * 0.995; // 0.5% total fees
  const estimatedOutput = parseFloat(fromAmount) * combinedRate;
  
  return {
    rate: combinedRate,
    estimatedOutput: estimatedOutput.toFixed(6),
    description: `${fromCurrency} → ${intermediateCurrency} (DEX) → ${toCurrency} (AMM)`,
    path: [
      { currency: intermediateCurrency === 'XRP' ? 'XRP' : intermediateCurrency, ...(intermediateCurrency !== 'XRP' && { issuer: issuerAddress }) },
      { currency: toCurrency === 'XRP' ? 'XRP' : toCurrency, ...(toCurrency !== 'XRP' && { issuer: issuerAddress }) }
    ],
    pathType: 'dex_to_amm'
  };
};

/**
 * Try AMM → DEX route (e.g., SOL → XRP via AMM, then XRP → BTC via DEX)
 */
const tryAmmToDexRoute = async (fromCurrency, intermediateCurrency, toCurrency, fromAmount, issuerAddress, ammData, dexOffers) => {
  // Step 1: Check AMM rate for fromCurrency → intermediateCurrency
  const ammRate = getAmmRate(fromCurrency, intermediateCurrency, ammData, parseFloat(fromAmount));
  if (!ammRate) return { rate: 0 };
  
  // Step 2: Check DEX rate for intermediateCurrency → toCurrency
  const dexRate = getDexRate(intermediateCurrency, toCurrency, dexOffers);
  if (!dexRate) return { rate: 0 };
  
  const combinedRate = ammRate * dexRate * 0.995; // 0.5% total fees
  const estimatedOutput = parseFloat(fromAmount) * combinedRate;
  
  return {
    rate: combinedRate,
    estimatedOutput: estimatedOutput.toFixed(6),
    description: `${fromCurrency} → ${intermediateCurrency} (AMM) → ${toCurrency} (DEX)`,
    path: [
      { currency: intermediateCurrency === 'XRP' ? 'XRP' : intermediateCurrency, ...(intermediateCurrency !== 'XRP' && { issuer: issuerAddress }) },
      { currency: toCurrency === 'XRP' ? 'XRP' : toCurrency, ...(toCurrency !== 'XRP' && { issuer: issuerAddress }) }
    ],
    pathType: 'amm_to_dex'
  };
};

/**
 * Try 3-hop routes (DEX → AMM → DEX, AMM → DEX → AMM, etc.)
 */
const tryThreeHopRoute = async (fromCurrency, intermediate1, intermediate2, toCurrency, fromAmount, issuerAddress, ammData, dexOffers) => {
  // Try all combinations of DEX/AMM for 3 hops
  const routes = [
    { type: 'dex_amm_dex', desc: `${fromCurrency} → ${intermediate1} (DEX) → ${intermediate2} (AMM) → ${toCurrency} (DEX)` },
    { type: 'amm_dex_amm', desc: `${fromCurrency} → ${intermediate1} (AMM) → ${intermediate2} (DEX) → ${toCurrency} (AMM)` },
    { type: 'dex_dex_amm', desc: `${fromCurrency} → ${intermediate1} (DEX) → ${intermediate2} (DEX) → ${toCurrency} (AMM)` },
    { type: 'amm_amm_dex', desc: `${fromCurrency} → ${intermediate1} (AMM) → ${intermediate2} (AMM) → ${toCurrency} (DEX)` }
  ];
  
  let bestRoute = { rate: 0 };
  
  for (const route of routes) {
    let rate1, rate2, rate3;
    
    // Calculate rates based on route type
    if (route.type.startsWith('dex')) {
      rate1 = getDexRate(fromCurrency, intermediate1, dexOffers);
    } else {
      rate1 = getAmmRate(fromCurrency, intermediate1, ammData, parseFloat(fromAmount));
    }
    if (!rate1) continue;
    
    if (route.type.includes('_dex_')) {
      rate2 = getDexRate(intermediate1, intermediate2, dexOffers);
    } else {
      rate2 = getAmmRate(intermediate1, intermediate2, ammData, parseFloat(fromAmount) * rate1);
    }
    if (!rate2) continue;
    
    if (route.type.endsWith('dex')) {
      rate3 = getDexRate(intermediate2, toCurrency, dexOffers);
    } else {
      rate3 = getAmmRate(intermediate2, toCurrency, ammData, parseFloat(fromAmount) * rate1 * rate2);
    }
    if (!rate3) continue;
    
    const combinedRate = rate1 * rate2 * rate3 * 0.99; // 1% total fees for 3 hops
    
    if (combinedRate > bestRoute.rate) {
      bestRoute = {
        rate: combinedRate,
        estimatedOutput: (parseFloat(fromAmount) * combinedRate).toFixed(6),
        description: route.desc,
        path: [
          { currency: intermediate1 === 'XRP' ? 'XRP' : intermediate1, ...(intermediate1 !== 'XRP' && { issuer: issuerAddress }) },
          { currency: intermediate2 === 'XRP' ? 'XRP' : intermediate2, ...(intermediate2 !== 'XRP' && { issuer: issuerAddress }) },
          { currency: toCurrency === 'XRP' ? 'XRP' : toCurrency, ...(toCurrency !== 'XRP' && { issuer: issuerAddress }) }
        ],
        pathType: route.type
      };
    }
  }
  
  return bestRoute;
};

/**
 * Helper functions for getting rates - REAL IMPLEMENTATIONS
 */
const getDexOffers = async (fromCurrency, toCurrency, issuerAddress) => {
  await connectXrplClient();
  
  const offers = {
    direct: null,
    fromToXrp: null,
    xrpToTo: null,
    reverse: null
  };
  
  try {
    // Direct offers
    if (fromCurrency !== toCurrency) {
      let takerGets, takerPays;
      
      if (fromCurrency === "XRP") {
        takerGets = { currency: "XRP" };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      } else if (toCurrency === "XRP") {
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: "XRP" };
      } else {
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      }
      
      const directResponse = await client.request({
        command: "book_offers",
        taker_gets: takerGets,
        taker_pays: takerPays,
        limit: 5
      });
      
      offers.direct = directResponse.result.offers || [];
    }
    
    // From → XRP offers (if fromCurrency is not XRP)
    if (fromCurrency !== "XRP") {
      const fromToXrpResponse = await client.request({
        command: "book_offers",
        taker_gets: { currency: fromCurrency, issuer: issuerAddress },
        taker_pays: { currency: "XRP" },
        limit: 5
      });
      offers.fromToXrp = fromToXrpResponse.result.offers || [];
    }
    
    // XRP → To offers (if toCurrency is not XRP)
    if (toCurrency !== "XRP") {
      const xrpToToResponse = await client.request({
        command: "book_offers",
        taker_gets: { currency: "XRP" },
        taker_pays: { currency: toCurrency, issuer: issuerAddress },
        limit: 5
      });
      offers.xrpToTo = xrpToToResponse.result.offers || [];
      
      // Also check reverse offers
      if (offers.xrpToTo.length === 0) {
        const reverseResponse = await client.request({
          command: "book_offers",
          taker_gets: { currency: toCurrency, issuer: issuerAddress },
          taker_pays: { currency: "XRP" },
          limit: 5
        });
        offers.reverse = reverseResponse.result.offers || [];
      }
    }
    
  } catch (error) {
    console.log(`⚠️ Error fetching DEX offers: ${error.message}`);
  }
  
  return offers;
};

const getDexRate = (fromCurrency, toCurrency, dexOffers) => {
  // Direct rate
  if (dexOffers.direct && dexOffers.direct.length > 0) {
    const offer = dexOffers.direct[0];
    const getAmount = typeof offer.TakerGets === 'string' ? 
      parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
      parseFloat(offer.TakerGets.value);
    const payAmount = typeof offer.TakerPays === 'string' ? 
      parseFloat(xrpl.dropsToXrp(offer.TakerPays)) : 
      parseFloat(offer.TakerPays.value);
    return payAmount / getAmount;
  }
  
  // Multi-hop rates
  if (fromCurrency !== "XRP" && toCurrency === "XRP" && dexOffers.fromToXrp && dexOffers.fromToXrp.length > 0) {
    const offer = dexOffers.fromToXrp[0];
    const getAmount = parseFloat(offer.TakerGets.value);
    const payAmount = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
    return payAmount / getAmount;
  }
  
  if (fromCurrency === "XRP" && toCurrency !== "XRP") {
    if (dexOffers.xrpToTo && dexOffers.xrpToTo.length > 0) {
      const offer = dexOffers.xrpToTo[0];
      const getAmount = parseFloat(xrpl.dropsToXrp(offer.TakerGets));
      const payAmount = parseFloat(offer.TakerPays.value);
      return payAmount / getAmount;
    }
    
    if (dexOffers.reverse && dexOffers.reverse.length > 0) {
      const offer = dexOffers.reverse[0];
      const getAmount = parseFloat(offer.TakerGets.value);
      const payAmount = parseFloat(xrpl.dropsToXrp(offer.TakerPays));
      return 1 / (payAmount / getAmount); // Inverse of reverse rate
    }
  }
  
  return 0;
};

const getAmmRate = (fromCurrency, toCurrency, ammData, amount) => {
  // Use existing calculateAmmRate function
  for (const amm of Object.values(ammData)) {
    const rate = calculateAmmRate(amm, fromCurrency, toCurrency, amount);
    if (rate > 0) return rate;
  }
  return 0;
};