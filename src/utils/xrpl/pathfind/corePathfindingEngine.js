import xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";
import { 
  withRetry, 
  withTimeout, 
  safeTransactionSubmit, 
  reportError, 
  RetryConfigs,
  ErrorTypes 
} from '../errorHandler.js';

/**
 * 🧠 UNIFIED PATHFINDING ENGINE
 * Single source of truth for all pathfinding, market analysis, and smart calculations
 * Consolidates: corePathfindingEngine + smartTradeAdapter + createSmartOffer intelligence
 */

/**
 * Core Pathfinding Engine - Shared foundation for all pathfinding operations
 * Eliminates redundancy between createSmartOffer, Smart Trade, and pure pathfinding
 */

/**
 * Core market analysis - shared by all pathfinding operations
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency  
 * @param {string} fromAmount - Amount to analyze
 * @param {string} issuerAddress - Issuer address for tokens
 * @param {object} options - Analysis options
 * @returns {Promise<object>} Comprehensive market analysis
 */
export async function analyzeMarket(fromCurrency, toCurrency, fromAmount, issuerAddress, options = {}) {
  try {
    await connectXrplClient();
    
    const {
      includeAMM = true,
      includeDEX = true,
      includeHybrid = true,
      slippageBuffer = 0.05, // 5% default slippage buffer
      maxHops = 3,
      purpose = 'analysis', // 'analysis', 'trading', 'offer_creation', 'exact_output_analysis'
      targetOutput = null // For exact output mode
    } = options;
    
    console.log(`🔍 Core Market Analysis: ${fromAmount} ${fromCurrency} → ${toCurrency} (${purpose})`);
    
    const analysis = {
      fromCurrency,
      toCurrency,
      fromAmount: parseFloat(fromAmount),
      issuerAddress,
      purpose,
      timestamp: new Date().toISOString(),
      routes: {
        amm: null,
        dex: null,
        hybrid: null
      },
      bestRoute: null,
      marketDepth: null,
      liquidityAnalysis: null,
      success: false
    };
    
    // Parallel analysis of all liquidity sources
    const analysisPromises = [];
    
    if (includeAMM) {
      analysisPromises.push(analyzeAMMRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress, purpose === 'exact_output_analysis', targetOutput));
    }
    
    if (includeDEX) {
      analysisPromises.push(analyzeDEXRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress));
    }
    
    if (includeHybrid) {
      analysisPromises.push(analyzeHybridRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress));
    }
    
    const results = await Promise.all(analysisPromises);
    const [ammAnalysis, dexAnalysis, hybridAnalysis] = results;
    
    // Store route analysis
    if (includeAMM) analysis.routes.amm = ammAnalysis;
    if (includeDEX) analysis.routes.dex = dexAnalysis;
    if (includeHybrid) analysis.routes.hybrid = hybridAnalysis;
    
    // Determine best route with detailed comparison
    const candidates = [];
    if (ammAnalysis?.success) candidates.push({ type: 'AMM', analysis: ammAnalysis });
    if (dexAnalysis?.success) candidates.push({ type: 'DEX', analysis: dexAnalysis });
    if (hybridAnalysis?.success) candidates.push({ type: 'Hybrid', analysis: hybridAnalysis });
    
    console.log(`🔍 Route Comparison Summary:`);
    candidates.forEach(candidate => {
      const path = candidate.analysis.bestPath;
      // For exact output mode, show the target amount instead of inflated estimates
      const displayOutput = (purpose === 'exact_output_analysis' && options.targetOutput) ? 
        options.targetOutput.toFixed(6) : 
        path.amountOut?.toFixed(6);
      console.log(`  📊 ${candidate.type}: Rate ${candidate.analysis.bestRate?.toFixed(6)}, Output ${displayOutput}, Path: ${path.path}`);
    });
    
    if (candidates.length > 0) {
      // ✅ FIXED: Always use rate comparison for optimal routing
      // Higher rate = better exchange rate = less input needed for same output
      let bestCandidate;
      if (purpose === 'exact_output_analysis') {
        console.log(`🎯 EXACT OUTPUT MODE: Comparing by exchange rate efficiency (higher rate = better)`);
        bestCandidate = candidates.reduce((best, current) => {
          console.log(`  🔄 Comparing ${current.type} (rate: ${current.analysis.bestRate?.toFixed(6)}) vs ${best.type} (rate: ${best.analysis.bestRate?.toFixed(6)})`);
          
          // ✅ Higher rate is ALWAYS better - it means you get more output per unit of input
          // This applies to both exact input and exact output modes
          if (current.analysis.bestRate > best.analysis.bestRate) {
            console.log(`    ✅ ${current.type} has better rate (${current.analysis.bestRate?.toFixed(6)} > ${best.analysis.bestRate?.toFixed(6)})`);
              return current;
          } else {
            console.log(`    ⚪ ${best.type} maintains better rate (${best.analysis.bestRate?.toFixed(6)} >= ${current.analysis.bestRate?.toFixed(6)})`);
              return best;
            }
        });
      } else {
        // Standard mode: higher rate is better
        bestCandidate = candidates.reduce((best, current) => {
          console.log(`  🔄 Comparing ${current.type} (${current.analysis.bestRate?.toFixed(6)}) vs ${best.type} (${best.analysis.bestRate?.toFixed(6)})`);
          return current.analysis.bestRate > best.analysis.bestRate ? current : best;
        });
      }
      
      analysis.bestRoute = {
        type: bestCandidate.type,
        rate: bestCandidate.analysis.bestRate,
        estimatedOutput: options.isExactOutput && options.targetOutput ? 
          options.targetOutput.toFixed(6) : 
          (bestCandidate.analysis.bestPath.amountOut ? 
          bestCandidate.analysis.bestPath.amountOut.toFixed(6) : 
            bestCandidate.analysis.bestPath.estimatedOutput),
        path: bestCandidate.analysis.bestPath,
        slippage: calculateSlippage(bestCandidate.analysis, slippageBuffer)
      };
      
      analysis.success = true;
      
      console.log(`🏆 Best Route: ${analysis.bestRoute.type} (Rate: ${analysis.bestRoute.rate.toFixed(6)})`);
      console.log(`🛤️ Path: ${analysis.bestRoute.path.path}`);
    } else {
      console.log(`❌ No viable routes found`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Core market analysis error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      fromCurrency,
      toCurrency,
      fromAmount
    };
  }
};

/**
 * Analyze AMM routes with enhanced liquidity detection
 */
export async function analyzeAMMRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress, isExactOutput = false, targetOutput = null) {
  try {
    console.log(`🔵 AMM Route Analysis...`);
    if (isExactOutput && targetOutput) {
      console.log(`🎯 EXACT OUTPUT MODE: Finding minimum ${fromCurrency} input to get exactly ${targetOutput} ${toCurrency}`);
    }
    
    // Get LIVE AMM data using universal function - NO CACHING for accuracy
    const { getAmmData, getAmmInfo } = require("../../utils/ammUtils");
    const ammRegistry = getAmmData();
    const ammData = {};
    
    // Get live data for each pool using universal function
    for (const [pairKey, poolInfo] of Object.entries(ammRegistry)) {
      try {
        const liveInfo = await getAmmInfo(poolInfo.amm_account);
        if (liveInfo) {
          ammData[pairKey] = {
            amm_account: liveInfo.amm_account,
            currency_a: {
              currency: liveInfo.asset1.currency,
              issuer: liveInfo.asset1.issuer,
              value: liveInfo.asset1.value
            },
            currency_b: {
              currency: liveInfo.asset2.currency,
              issuer: liveInfo.asset2.issuer,
              value: liveInfo.asset2.value
            },
            trading_fee: liveInfo.trading_fee
          };
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get live data for ${pairKey}: ${error.message}`);
      }
    }
    const routes = [];
    let bestRate = 0;
    let bestPath = null;
    
    console.log(`📊 Analyzing ${Object.keys(ammData).length} AMM pools`);
    
    // Direct AMM routes
    for (const [ammId, amm] of Object.entries(ammData)) {
      let directRoute;
      if (isExactOutput && targetOutput) {
        // Calculate exact input needed for target output
        const requiredInput = calculateAMMInputForOutput(amm, fromCurrency, toCurrency, targetOutput);
        if (requiredInput && requiredInput > 0) {
          const rate = targetOutput / requiredInput;
          directRoute = {
            rate: rate,
            amountOut: targetOutput,
            requiredInput: requiredInput,
            liquidityRatio: calculateLiquidityRatio(amm, fromCurrency, requiredInput),
            path: `${fromCurrency} → ${toCurrency} (AMM)`,
            ammAccount: amm.amm_account
          };
        }
      } else {
        directRoute = analyzeDirectAMMRoute(amm, fromCurrency, toCurrency, fromAmount);
      }
      
      if (directRoute && directRoute.rate > 0) {
        routes.push(directRoute);
        if (directRoute.rate > bestRate) {
          bestRate = directRoute.rate;
          bestPath = directRoute;
        }
      }
    }
    
    // Multi-hop AMM routes
    const multiHopRoutes = analyzeMultiHopAMMRoutes(ammData, fromCurrency, toCurrency, fromAmount, issuerAddress, isExactOutput, targetOutput);
    routes.push(...multiHopRoutes);
    
    // Update best if multi-hop is better
    multiHopRoutes.forEach(route => {
      if (route.rate > bestRate) {
        bestRate = route.rate;
        bestPath = route;
      }
    });
    
    return {
      success: routes.length > 0,
      type: 'amm',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length
    };
    
  } catch (error) {
    console.error(`❌ AMM analysis error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Analyze DEX order book routes with depth analysis
 */
export async function analyzeDEXRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    console.log(`🟡 DEX Route Analysis...`);
    
    const orderBooks = await getOrderBookData(fromCurrency, toCurrency, issuerAddress);
    const routes = [];
    let bestRate = 0;
    let bestPath = null;
    
    // Direct DEX routes
    if (orderBooks.direct && orderBooks.direct.length > 0) {
      const directRoute = analyzeDirectDEXRoute(orderBooks.direct, fromCurrency, toCurrency, fromAmount);
      if (directRoute.rate > 0) {
        routes.push(directRoute);
        bestRate = directRoute.rate;
        bestPath = directRoute;
      }
    }
    
    // Multi-hop DEX routes (via XRP)
    if (orderBooks.multiHop.fromToXrp.length > 0 && orderBooks.multiHop.xrpToTo.length > 0) {
      const multiHopRoute = analyzeMultiHopDEXRoute(orderBooks.multiHop, fromCurrency, toCurrency, fromAmount);
      if (multiHopRoute.rate > 0) {
        routes.push(multiHopRoute);
        if (multiHopRoute.rate > bestRate) {
          bestRate = multiHopRoute.rate;
          bestPath = multiHopRoute;
        }
      }
    }
    
    return {
      success: routes.length > 0,
      type: 'dex',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length,
      orderBookDepth: calculateOrderBookDepth(orderBooks)
    };
    
  } catch (error) {
    console.error(`❌ DEX analysis error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Analyze hybrid AMM+DEX routes
 */
export async function analyzeHybridRoutes(fromCurrency, toCurrency, fromAmount, issuerAddress) {
  try {
    console.log(`🟣 Hybrid Route Analysis...`);
    
    // Get both AMM and DEX data using universal function
    const { getAmmData, getAmmInfo } = require("../../utils/ammUtils");
    const ammRegistry = getAmmData();
    const ammData = {};
    
    // Get live AMM data for hybrid routes
    for (const [pairKey, poolInfo] of Object.entries(ammRegistry)) {
      try {
        const liveInfo = await getAmmInfo(poolInfo.amm_account);
        if (liveInfo) {
          ammData[pairKey] = {
            amm_account: liveInfo.amm_account,
            currency_a: {
              currency: liveInfo.asset1.currency,
              issuer: liveInfo.asset1.issuer,
              value: liveInfo.asset1.value
            },
            currency_b: {
              currency: liveInfo.asset2.currency,
              issuer: liveInfo.asset2.issuer,
              value: liveInfo.asset2.value
            },
            trading_fee: liveInfo.trading_fee
          };
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get live data for ${pairKey}: ${error.message}`);
      }
    }
    
    const orderBooks = await getOrderBookData(fromCurrency, toCurrency, issuerAddress);
    
    const routes = [];
    let bestRate = 0;
    let bestPath = null;
    
    // Find intermediate currencies available in both AMM and DEX
    const ammCurrencies = new Set(['XRP']);
    Object.values(ammData).forEach(amm => {
      if (amm.currency_a?.currency) ammCurrencies.add(amm.currency_a.currency);
      if (amm.currency_b?.currency) ammCurrencies.add(amm.currency_b.currency);
    });
    
    // Try hybrid routes through each intermediate currency
    for (const intermediateCurrency of ammCurrencies) {
      if (intermediateCurrency === fromCurrency || intermediateCurrency === toCurrency) continue;
      
      // DEX → AMM route
      const dexToAmmRoute = analyzeHybridRoute(
        'dex_to_amm',
        fromCurrency, intermediateCurrency, toCurrency,
        fromAmount, orderBooks, ammData, issuerAddress
      );
      
      if (dexToAmmRoute.rate > 0) {
        routes.push(dexToAmmRoute);
        if (dexToAmmRoute.rate > bestRate) {
          bestRate = dexToAmmRoute.rate;
          bestPath = dexToAmmRoute;
        }
      }
      
      // AMM → DEX route
      const ammToDexRoute = analyzeHybridRoute(
        'amm_to_dex',
        fromCurrency, intermediateCurrency, toCurrency,
        fromAmount, orderBooks, ammData, issuerAddress
      );
      
      if (ammToDexRoute.rate > 0) {
        routes.push(ammToDexRoute);
        if (ammToDexRoute.rate > bestRate) {
          bestRate = ammToDexRoute.rate;
          bestPath = ammToDexRoute;
        }
      }
    }
    
    return {
      success: routes.length > 0,
      type: 'hybrid',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length
    };
    
  } catch (error) {
    console.error(`❌ Hybrid analysis error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Get comprehensive order book data for all relevant currency pairs
 */
export async function getOrderBookData(fromCurrency, toCurrency, issuerAddress) {
  const orderBooks = {
    direct: [],
    multiHop: {
      fromToXrp: [],
      xrpToTo: [],
      reverse: []
    }
  };
  
  try {
    await connectXrplClient();
    
    // Direct order book
    if (fromCurrency !== toCurrency) {
      let takerGets, takerPays;
      
      if (fromCurrency === "XRP") {
        takerGets = { currency: "XRP" };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      } else if (toCurrency === "XRP") {
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: "XRP" };
      } else {
        // FINAL FIX: Your offer has TakerGets=EUR, TakerPays=USD
        // To find this offer, we need to query with the SAME structure
        takerGets = { currency: fromCurrency, issuer: issuerAddress };
        takerPays = { currency: toCurrency, issuer: issuerAddress };
      }
      
      const directResponse = await client.request({
        command: "book_offers",
        taker_gets: takerGets,
        taker_pays: takerPays,
        limit: 20 // Get more offers for better depth analysis
      });
      
      orderBooks.direct = directResponse.result.offers || [];
      
      // DEBUG: Log what offers were found
      console.log(`🔍 DEBUG: Querying ${fromCurrency} → ${toCurrency} order book:`);
      console.log(`   TakerGets: ${JSON.stringify(takerGets)}`);
      console.log(`   TakerPays: ${JSON.stringify(takerPays)}`);
      console.log(`   Found ${orderBooks.direct.length} offers`);
      
      if (orderBooks.direct.length > 0) {
        orderBooks.direct.forEach((offer, index) => {
          console.log(`   Offer ${index + 1}:`);
          console.log(`     TakerGets: ${JSON.stringify(offer.TakerGets)}`);
          console.log(`     TakerPays: ${JSON.stringify(offer.TakerPays)}`);
          console.log(`     Account: ${offer.Account}`);
        });
      } else {
        console.log(`   ❌ No offers found in this order book`);
      }
    }
    
    // Multi-hop routes via XRP
    if (fromCurrency !== "XRP") {
      const fromToXrpResponse = await client.request({
        command: "book_offers",
        taker_gets: { currency: fromCurrency, issuer: issuerAddress },
        taker_pays: { currency: "XRP" },
        limit: 10
      });
      orderBooks.multiHop.fromToXrp = fromToXrpResponse.result.offers || [];
    }
    
    if (toCurrency !== "XRP") {
      const xrpToToResponse = await client.request({
        command: "book_offers",
        taker_gets: { currency: "XRP" },
        taker_pays: { currency: toCurrency, issuer: issuerAddress },
        limit: 10
      });
      orderBooks.multiHop.xrpToTo = xrpToToResponse.result.offers || [];
      
      // Check reverse offers if no direct XRP→toCurrency offers
      if (orderBooks.multiHop.xrpToTo.length === 0) {
        const reverseResponse = await client.request({
          command: "book_offers",
          taker_gets: { currency: toCurrency, issuer: issuerAddress },
          taker_pays: { currency: "XRP" },
          limit: 10
        });
        orderBooks.multiHop.reverse = reverseResponse.result.offers || [];
      }
    }
    
  } catch (error) {
    console.error(`❌ Error fetching order book data: ${error.message}`);
  }
  
  return orderBooks;
};

// Removed calculateConfidence - routes are chosen purely based on rate efficiency

/**
 * Calculate expected slippage for a route
 */
export function calculateSlippage(routeAnalysis, slippageBuffer) {
  let baseSlippage = 0.01; // 1% base slippage
  
  if (routeAnalysis.type === 'amm') {
    // AMM slippage based on trade size vs liquidity
    if (routeAnalysis.bestPath.liquidityRatio < 5) baseSlippage += 0.05;
    else if (routeAnalysis.bestPath.liquidityRatio < 20) baseSlippage += 0.02;
  } else if (routeAnalysis.type === 'dex') {
    // DEX slippage based on order book depth
    if (routeAnalysis.orderBookDepth < 3) baseSlippage += 0.03;
    else if (routeAnalysis.orderBookDepth < 10) baseSlippage += 0.01;
  } else if (routeAnalysis.type === 'hybrid') {
    // Hybrid routes have higher slippage
    baseSlippage += 0.02;
  }
  
  return baseSlippage + slippageBuffer;
};

// Real implementations for specific route analysis functions
export function analyzeDirectAMMRoute(amm, fromCurrency, toCurrency, fromAmount) {
  try {
    const asset1 = amm.currency_a;
    const asset2 = amm.currency_b;
    
    // Determine which asset is which currency
    let fromAsset, toAsset, fromBalance, toBalance;
    
    if ((asset1.currency === fromCurrency) && (asset2.currency === toCurrency)) {
      fromAsset = asset1;
      toAsset = asset2;
      fromBalance = parseFloat(asset1.value);
      toBalance = parseFloat(asset2.value);
    } else if ((asset2.currency === fromCurrency) && (asset1.currency === toCurrency)) {
      fromAsset = asset2;
      toAsset = asset1;
      fromBalance = parseFloat(asset2.value);
      toBalance = parseFloat(asset1.value);
    } else {
      return { rate: 0 };
    }
    
    // Get AMM trading fee from live data (fallback to 0 if not available)
    const tradingFeeBasisPoints = amm.trading_fee || 0; // Use live trading fee, no assumptions
    const tradingFeeDecimal = tradingFeeBasisPoints / 10000; // Convert to decimal
    
    // Calculate exchange rate using constant product formula WITH AMM fees
    // For AMM with fees (CORRECT LOGIC): 
    // 1. Use full input amount in constant product formula
    // 2. Calculate theoretical output
    // 3. Apply trading fee to output (reduce final amount received)
    
    const inputAmount = parseFloat(fromAmount);
    
    // Step 1: Constant product calculation with full input
    const k = fromBalance * toBalance;
    const newFromBalance = fromBalance + inputAmount;
    const newToBalance = k / newFromBalance;
    const theoreticalOutput = toBalance - newToBalance;
    
    if (theoreticalOutput <= 0) {
      return { rate: 0 };
    }
    
    // Step 2: Apply trading fee to output (fee is deducted from what you receive)
    const amountOut = theoreticalOutput * (1 - tradingFeeDecimal);
    
    // Calculate effective rate (actual output after fees / input)
    const rate = amountOut / inputAmount;
    const liquidityRatio = Math.min(fromBalance, toBalance) / inputAmount;
    
    // Add debugging for fee calculations
    const feeAmount = theoreticalOutput * tradingFeeDecimal;
    const priceImpact = ((theoreticalOutput / toBalance) * 100);
    
    return {
      rate,
      amountOut,
      liquidityRatio,
      fromBalance,
      toBalance,
      ammAccount: amm.amm_account,
      path: `${fromCurrency} → ${toCurrency} (AMM)`,
      // Additional debugging info
      tradingFee: tradingFeeBasisPoints,
      feeAmount: feeAmount,
      theoreticalOutput: theoreticalOutput,
      priceImpact: priceImpact
    };
    
  } catch (error) {
    console.error(`❌ Direct AMM route analysis error: ${error.message}`);
    return { rate: 0 };
  }
};

export function analyzeMultiHopAMMRoutes(ammData, fromCurrency, toCurrency, fromAmount, issuerAddress, isExactOutput = false, targetOutput = null) {
  const routes = [];
  
  try {
    // Convert ammData object to array of AMM pools
    const ammPools = Object.values(ammData);
    
    console.log(`🔄 Analyzing multi-hop AMM routes for ${fromCurrency} → ${toCurrency}`);
    console.log(`📊 Available pools: ${ammPools.map(p => `${p.currency_a?.currency || 'XRP'}/${p.currency_b?.currency || 'XRP'}`).join(', ')}`);
    
    // Find all possible intermediate currencies
    const intermediateCurrencies = new Set(['XRP']);
    ammPools.forEach(amm => {
      if (amm.currency_a?.currency && amm.currency_a.currency !== fromCurrency && amm.currency_a.currency !== toCurrency) {
        intermediateCurrencies.add(amm.currency_a.currency);
      }
      if (amm.currency_b?.currency && amm.currency_b.currency !== fromCurrency && amm.currency_b.currency !== toCurrency) {
        intermediateCurrencies.add(amm.currency_b.currency);
      }
    });
    
    console.log(`🔀 Testing intermediate currencies: ${Array.from(intermediateCurrencies).join(', ')}`);
    
    // Analyze multi-hop routes through each intermediate currency
    for (const intermediateCurrency of intermediateCurrencies) {
      // Skip invalid routes (same currency hops)
      if (intermediateCurrency === fromCurrency || intermediateCurrency === toCurrency) continue;
      // Find pools for fromCurrency → intermediateCurrency
    const fromPools = ammPools.filter(amm => 
        (amm.currency_a?.currency === fromCurrency && amm.currency_b?.currency === intermediateCurrency) ||
        (amm.currency_b?.currency === fromCurrency && amm.currency_a?.currency === intermediateCurrency) ||
        (fromCurrency === 'XRP' && (amm.currency_a?.currency === intermediateCurrency || amm.currency_b?.currency === intermediateCurrency)) ||
        (intermediateCurrency === 'XRP' && (amm.currency_a?.currency === fromCurrency || amm.currency_b?.currency === fromCurrency))
      );
      
      // Find pools for intermediateCurrency → toCurrency
    const toPools = ammPools.filter(amm => 
        (amm.currency_a?.currency === intermediateCurrency && amm.currency_b?.currency === toCurrency) ||
        (amm.currency_b?.currency === intermediateCurrency && amm.currency_a?.currency === toCurrency) ||
        (intermediateCurrency === 'XRP' && (amm.currency_a?.currency === toCurrency || amm.currency_b?.currency === toCurrency)) ||
        (toCurrency === 'XRP' && (amm.currency_a?.currency === intermediateCurrency || amm.currency_b?.currency === intermediateCurrency))
      );
      
      console.log(`💱 ${fromCurrency} → ${intermediateCurrency}: ${fromPools.length} pools, ${intermediateCurrency} → ${toCurrency}: ${toPools.length} pools`);
      
      // Test all combinations
    for (const fromPool of fromPools) {
      for (const toPool of toPools) {
        if (fromPool.amm_account === toPool.amm_account) continue; // Skip same pool
        
          try {
            if (isExactOutput && targetOutput) {
              // EXACT OUTPUT MODE: Calculate backwards from target
              // Step 1: How much intermediate currency needed for target output?
              const secondHopRequired = calculateAMMInputForOutput(toPool, intermediateCurrency, toCurrency, targetOutput);
              if (!secondHopRequired || secondHopRequired <= 0) continue;
              
              // Step 2: How much from currency needed for that intermediate amount?
              const firstHopRequired = calculateAMMInputForOutput(fromPool, fromCurrency, intermediateCurrency, secondHopRequired);
              if (!firstHopRequired || firstHopRequired <= 0) continue;
              
              const totalRate = targetOutput / firstHopRequired;
              const minLiquidityRatio = Math.min(
                calculateLiquidityRatio(fromPool, fromCurrency, firstHopRequired),
                calculateLiquidityRatio(toPool, intermediateCurrency, secondHopRequired)
              );
              
              console.log(`  🎯 EXACT OUTPUT Multi-hop: ${firstHopRequired.toFixed(6)} ${fromCurrency} → ${secondHopRequired.toFixed(6)} ${intermediateCurrency} → ${targetOutput} ${toCurrency} (rate: ${totalRate.toFixed(6)})`);
              
              routes.push({
                rate: totalRate,
                amountOut: targetOutput,
                requiredInput: firstHopRequired,
                liquidityRatio: minLiquidityRatio,
                path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency} (AMM)`,
                hops: [
                  { input: firstHopRequired, output: secondHopRequired, pool: fromPool },
                  { input: secondHopRequired, output: targetOutput, pool: toPool }
                ],
                intermediateCurrency: intermediateCurrency,
                pools: [fromPool.amm_account, toPool.amm_account]
              });
              
            } else {
              // STANDARD MODE: Calculate forwards from fixed input
              const firstHop = analyzeDirectAMMRoute(fromPool, fromCurrency, intermediateCurrency, fromAmount);
        if (firstHop.rate <= 0) continue;
        
            console.log(`  🔸 First hop (${fromCurrency} → ${intermediateCurrency}): ${fromAmount} → ${firstHop.amountOut?.toFixed(6)} (rate: ${firstHop.rate?.toFixed(6)})`);
            
            // Second hop: intermediateCurrency → toCurrency
            const secondHop = analyzeDirectAMMRoute(toPool, intermediateCurrency, toCurrency, firstHop.amountOut);
        if (secondHop.rate <= 0) continue;
            
            console.log(`  🔸 Second hop (${intermediateCurrency} → ${toCurrency}): ${firstHop.amountOut?.toFixed(6)} → ${secondHop.amountOut?.toFixed(6)} (rate: ${secondHop.rate?.toFixed(6)})`);
        
        const totalRate = secondHop.amountOut / fromAmount;
            const minLiquidityRatio = Math.min(firstHop.liquidityRatio || 0, secondHop.liquidityRatio || 0);
            
            console.log(`  ✅ Multi-hop total: ${fromAmount} ${fromCurrency} → ${secondHop.amountOut?.toFixed(6)} ${toCurrency} (rate: ${totalRate?.toFixed(6)})`);
        
        routes.push({
          rate: totalRate,
          amountOut: secondHop.amountOut,
          liquidityRatio: minLiquidityRatio,
              path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency} (AMM)`,
              hops: [firstHop, secondHop],
              intermediateCurrency: intermediateCurrency,
              pools: [fromPool.amm_account, toPool.amm_account]
            });
            }
            
          } catch (hopError) {
            console.error(`❌ Error analyzing hop via ${intermediateCurrency}: ${hopError.message}`);
          }
        }
      }
    }
    
    // Sort routes by rate (best first)
    if (isExactOutput) {
      // For exact output, sort by least input required (highest rate)
      routes.sort((a, b) => b.rate - a.rate);
    } else {
      routes.sort((a, b) => b.rate - a.rate);
    }
    
    if (routes.length > 0) {
      const bestRoute = routes[0];
      if (isExactOutput) {
        console.log(`🏆 Best multi-hop route: ${bestRoute.path} (needs ${bestRoute.requiredInput?.toFixed(6)} ${fromCurrency} for ${targetOutput} ${toCurrency})`);
      } else {
        console.log(`🏆 Best multi-hop route: ${bestRoute.path} (rate: ${bestRoute.rate?.toFixed(6)})`);
      }
    } else {
      console.log(`❌ No viable multi-hop routes found`);
    }
    
  } catch (error) {
    console.error(`❌ Multi-hop AMM routes analysis error: ${error.message}`);
  }
  
  return routes;
};

/**
 * Calculate required input for AMM to get exact output (reverse calculation)
 */
export function calculateAMMInputForOutput(amm, fromCurrency, toCurrency, targetOutput) {
  try {
    const asset1 = amm.currency_a;
    const asset2 = amm.currency_b;
    
    // Determine pool direction based on actual AMM data structure
    let poolInput, poolOutput;
    
    if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
      // Selling XRP for another currency
      if (asset1 && asset1.currency === 'XRP') {
        poolInput = parseFloat(asset1.value);
        poolOutput = asset2 ? parseFloat(asset2.value) : parseFloat(amm.amount2) / 1000000;
      } else if (asset2 && asset2.currency === 'XRP') {
        poolInput = parseFloat(asset2.value);
        poolOutput = asset1 ? parseFloat(asset1.value) : parseFloat(amm.amount) / 1000000;
      } else if (!asset1) {
        // XRP is asset1 (stored as amount)
        poolInput = parseFloat(amm.amount) / 1000000;
        poolOutput = asset2 ? parseFloat(asset2.value) : parseFloat(amm.amount2) / 1000000;
      } else if (!asset2) {
        // XRP is asset2 (stored as amount2)
        poolInput = parseFloat(amm.amount2) / 1000000;
        poolOutput = asset1 ? parseFloat(asset1.value) : parseFloat(amm.amount) / 1000000;
      } else {
        return null; // XRP not found in this pool
      }
    } else if (toCurrency === 'XRP' && fromCurrency !== 'XRP') {
      // Buying XRP with another currency
      if (asset1 && asset1.currency === fromCurrency) {
        poolInput = parseFloat(asset1.value);
        poolOutput = asset2 && asset2.currency === 'XRP' ? parseFloat(asset2.value) : parseFloat(amm.amount2) / 1000000;
      } else if (asset2 && asset2.currency === fromCurrency) {
        poolInput = parseFloat(asset2.value);
        poolOutput = asset1 && asset1.currency === 'XRP' ? parseFloat(asset1.value) : parseFloat(amm.amount) / 1000000;
      } else if (!asset1 && fromCurrency === asset2?.currency) {
        // XRP is asset1, fromCurrency is asset2
        poolInput = parseFloat(asset2.value);
        poolOutput = parseFloat(amm.amount) / 1000000;
      } else if (!asset2 && fromCurrency === asset1?.currency) {
        // XRP is asset2, fromCurrency is asset1
        poolInput = parseFloat(asset1.value);
        poolOutput = parseFloat(amm.amount2) / 1000000;
      } else {
        return null; // Currencies not found in this pool
      }
    } else if (fromCurrency !== 'XRP' && toCurrency !== 'XRP') {
      // Both are IOUs
      if (asset1 && asset1.currency === fromCurrency && asset2 && asset2.currency === toCurrency) {
        poolInput = parseFloat(asset1.value);
        poolOutput = parseFloat(asset2.value);
      } else if (asset2 && asset2.currency === fromCurrency && asset1 && asset1.currency === toCurrency) {
        poolInput = parseFloat(asset2.value);
        poolOutput = parseFloat(asset1.value);
      } else {
        return null; // Currencies not found in this pool
      }
    } else {
      return null; // Invalid combination (XRP → XRP)
    }
    
    if (poolInput <= 0 || poolOutput <= 0) return null;
    
    // Get trading fee
    const tradingFeeBasisPoints = amm.trading_fee || 0;
    const tradingFeeDecimal = tradingFeeBasisPoints / 10000;
    
    // AMM constant product formula for exact output (reverse calculation):
    // k = poolInput * poolOutput
    // newPoolOutput = poolOutput - targetOutput
    // newPoolInput = k / newPoolOutput
    // requiredInput = newPoolInput - poolInput
    // With fees: actualRequiredInput = requiredInput / (1 - tradingFeeDecimal)
    
    const k = poolInput * poolOutput;
    const newPoolOutput = poolOutput - targetOutput;
    
    if (newPoolOutput <= 0) return null; // Not enough liquidity
    
    const newPoolInput = k / newPoolOutput;
    const requiredInputBeforeFees = newPoolInput - poolInput;
    
    if (requiredInputBeforeFees <= 0) return null;
    
    // Apply trading fee
    const requiredInput = requiredInputBeforeFees / (1 - tradingFeeDecimal);
    
    return requiredInput;
    
  } catch (error) {
    console.error(`❌ Error calculating AMM input for output: ${error.message}`);
    return null;
  }
};

/**
 * Calculate liquidity ratio for a trade
 */
export function calculateLiquidityRatio(amm, fromCurrency, tradeAmount) {
  try {
    const asset1 = amm.currency_a;
    const asset2 = amm.currency_b;
    
    let poolSize;
    
    if ((fromCurrency === 'XRP' && !asset1) || (asset1 && asset1.currency === fromCurrency)) {
      poolSize = asset1 ? parseFloat(asset1.value) : parseFloat(amm.amount) / 1000000;
    } else if ((fromCurrency === 'XRP' && !asset2) || (asset2 && asset2.currency === fromCurrency)) {
      poolSize = asset2 ? parseFloat(asset2.value) : parseFloat(amm.amount2) / 1000000;
    } else {
      return 0;
    }
    
    return poolSize / tradeAmount;
    
  } catch (error) {
    return 0;
  }
};

export function analyzeDirectDEXRoute(offers, fromCurrency, toCurrency, fromAmount) {
  try {
    if (!offers || offers.length === 0) return { rate: 0 };
    
    let remainingAmount = fromAmount;
    let totalReceived = 0;
    let offersUsed = 0;
    
    for (const offer of offers) {
      if (remainingAmount <= 0) break;
      
      // Parse offer amounts
      let offerGives, offerWants;
      
      if (typeof offer.TakerGets === 'string') {
        offerGives = parseFloat(offer.TakerGets) / 1000000; // XRP drops to XRP
      } else {
        offerGives = parseFloat(offer.TakerGets.value);
      }
      
      if (typeof offer.TakerPays === 'string') {
        offerWants = parseFloat(offer.TakerPays) / 1000000; // XRP drops to XRP
      } else {
        offerWants = parseFloat(offer.TakerPays.value);
      }
      
      // CRITICAL FIX: Handle reverse offer crossing
      // Your offer: TakerGets=40 EUR, TakerPays=40 USD (offer creator sells EUR for USD)
      // We want: EUR → USD (we want to sell EUR and get USD)
      // This is a REVERSE crossing - we take the opposite side of their offer
      
      // For reverse crossing: if they give 40 EUR for 40 USD, we can give 40 USD for 40 EUR
      // But we want EUR→USD, so we calculate: how much USD we get per EUR we give
      const reverseRate = offerWants / offerGives; // USD per EUR we can get
      
      // Determine how much we can take from this offer (limited by what they're offering)
      const amountToTake = Math.min(remainingAmount, offerGives); // Limited by their EUR amount
      const amountReceived = amountToTake * reverseRate; // USD we receive
      
      console.log(`   🔄 Reverse crossing: Give ${amountToTake} ${fromCurrency} → Get ${amountReceived} ${toCurrency} (rate: ${reverseRate})`);
      
      totalReceived += amountReceived;
      remainingAmount -= amountToTake;
      offersUsed++;
    }
    
    if (totalReceived <= 0) return { rate: 0 };
    
    const avgRate = totalReceived / fromAmount;
    
    return {
      rate: avgRate,
      amountOut: totalReceived,
      offersUsed,
      orderBookDepth: offers.length, // Add this for confidence calculation
      path: `${fromCurrency} → ${toCurrency} (DEX)`
    };
    
  } catch (error) {
    console.error(`❌ Direct DEX route analysis error: ${error.message}`);
    return { rate: 0 };
  }
};

export function analyzeMultiHopDEXRoute(multiHopData, fromCurrency, toCurrency, fromAmount) {
  try {
    // Analyze fromCurrency → XRP → toCurrency route
    const firstHop = analyzeDirectDEXRoute(multiHopData.fromToXrp, fromCurrency, 'XRP', fromAmount);
    if (firstHop.rate <= 0) return { rate: 0 };
    
    let secondHop;
    if (multiHopData.xrpToTo.length > 0) {
      secondHop = analyzeDirectDEXRoute(multiHopData.xrpToTo, 'XRP', toCurrency, firstHop.amountOut);
    } else if (multiHopData.reverse.length > 0) {
      // Use reverse offers: toCurrency → XRP, but calculate in reverse
      const reverseAnalysis = analyzeDirectDEXRoute(multiHopData.reverse, toCurrency, 'XRP', 1);
      if (reverseAnalysis.rate > 0) {
        const reverseRate = 1 / reverseAnalysis.rate;
        secondHop = {
          rate: reverseRate,
          amountOut: firstHop.amountOut * reverseRate,
          path: `XRP → ${toCurrency} (DEX reverse)`
        };
      }
    }
    
    if (!secondHop || secondHop.rate <= 0) return { rate: 0 };
    
    const totalRate = secondHop.amountOut / fromAmount;
    
    return {
      rate: totalRate,
      amountOut: secondHop.amountOut,
      path: `${fromCurrency} → XRP → ${toCurrency} (DEX)`,
      hops: [firstHop, secondHop]
    };
    
  } catch (error) {
    console.error(`❌ Multi-hop DEX route analysis error: ${error.message}`);
    return { rate: 0 };
  }
};

export function analyzeHybridRoute(routeType, fromCurrency, intermediateCurrency, toCurrency, fromAmount, orderBooks, ammData, issuerAddress) {
  try {
    if (routeType === 'dex_to_amm') {
      // DEX: fromCurrency → intermediateCurrency, then AMM: intermediateCurrency → toCurrency
      const dexHop = analyzeDirectDEXRoute(orderBooks.direct, fromCurrency, intermediateCurrency, fromAmount);
      if (dexHop.rate <= 0) return { rate: 0 };
      
      const relevantAmm = Object.values(ammData).find(amm => 
        (amm.currency_a.currency === intermediateCurrency && amm.currency_b.currency === toCurrency) ||
        (amm.currency_b.currency === intermediateCurrency && amm.currency_a.currency === toCurrency)
      );
      
      if (!relevantAmm) return { rate: 0 };
      
      const ammHop = analyzeDirectAMMRoute(relevantAmm, intermediateCurrency, toCurrency, dexHop.amountOut);
      if (ammHop.rate <= 0) return { rate: 0 };
      
      return {
        rate: ammHop.amountOut / fromAmount,
        amountOut: ammHop.amountOut,
        path: `${fromCurrency} → ${intermediateCurrency} (DEX) → ${toCurrency} (AMM)`,
        hops: [dexHop, ammHop]
      };
      
    } else if (routeType === 'amm_to_dex') {
      // AMM: fromCurrency → intermediateCurrency, then DEX: intermediateCurrency → toCurrency
      const relevantAmm = Object.values(ammData).find(amm => 
        (amm.currency_a.currency === fromCurrency && amm.currency_b.currency === intermediateCurrency) ||
        (amm.currency_b.currency === fromCurrency && amm.currency_a.currency === intermediateCurrency)
      );
      
      if (!relevantAmm) return { rate: 0 };
      
      const ammHop = analyzeDirectAMMRoute(relevantAmm, fromCurrency, intermediateCurrency, fromAmount);
      if (ammHop.rate <= 0) return { rate: 0 };
      
      const dexHop = analyzeDirectDEXRoute(orderBooks.direct, intermediateCurrency, toCurrency, ammHop.amountOut);
      if (dexHop.rate <= 0) return { rate: 0 };
      
      return {
        rate: dexHop.amountOut / fromAmount,
        amountOut: dexHop.amountOut,
        path: `${fromCurrency} → ${intermediateCurrency} (AMM) → ${toCurrency} (DEX)`,
        hops: [ammHop, dexHop]
      };
    }
    
    return { rate: 0 };
    
  } catch (error) {
    console.error(`❌ Hybrid route analysis error: ${error.message}`);
    return { rate: 0 };
  }
};

export function calculateOrderBookDepth(orderBooks) {
  return orderBooks.direct.length + orderBooks.multiHop.fromToXrp.length + orderBooks.multiHop.xrpToTo.length;
};

/**
 * Verify issuer has the Default Ripple flag enabled
 * @param {string} issuerAddress - Issuer address to check
 * @returns {Promise<boolean>} True if Default Ripple is enabled
 */
export async function verifyIssuerRippleFlag(issuerAddress) {
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
export async function verifyTestOffers(issuerAddress) {
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
 * Execute smart trade with precision targeting using Core Engine
 * @param {object} userWallet - User's wallet
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} targetAmount - Target amount to receive
 * @param {string} issuerAddress - Issuer address
 * @param {object} options - Trading options
 * @returns {Promise<object>} Smart trade result
 */
export async function executeSmartTrade(userWallet, fromCurrency, toCurrency, targetAmount, issuerAddress, options = {}) {
  try {
    const {
      maxBuffer = 0.8, // 80% max buffer
      minBuffer = 0.3,  // 30% min buffer
      realityMultiplier = 0.75, // 75% reality check
      maxAttempts = 3,
      purpose = 'smart_trade',
      timeout = 120000 // 2 minute timeout for smart trades
    } = options;
    
    console.log(`🎯 Smart Trade: ${targetAmount} ${toCurrency} needed, paying with ${fromCurrency}`);
    console.log(`📊 Config: Buffer ${(minBuffer * 100).toFixed(0)}%-${(maxBuffer * 100).toFixed(0)}%, Reality ${(realityMultiplier * 100).toFixed(0)}%, Attempts ${maxAttempts}`);
    
    // Step 1: Analyze market using Core Engine with error handling
    console.log(`📊 Analyzing market for precision targeting...`);
    
    const marketAnalysis = await withRetry(
      async () => {
        return await withTimeout(
          async () => {
            return await analyzeMarket(
              fromCurrency,
              toCurrency,
              '1', // Base amount for rate calculation
              issuerAddress,
              {
                purpose,
                includeAMM: true,
                includeDEX: true,
                includeHybrid: true,
                slippageBuffer: 0.1 // 10% analysis buffer
              }
            );
          },
          30000, // 30 second timeout for market analysis
          { operation: 'market_analysis', fromCurrency, toCurrency }
        );
      },
      RetryConfigs.PATHFINDING,
      { operation: 'smart_trade_market_analysis', fromCurrency, toCurrency }
    );
    
    if (!marketAnalysis.success) {
      throw new Error(`Market analysis failed: ${marketAnalysis.error}`);
    }
    
    const bestRoute = marketAnalysis.bestRoute;
    console.log(`🏆 Best route: ${bestRoute.type} (Rate: ${bestRoute.rate.toFixed(6)}, Confidence: ${(bestRoute.confidence * 100).toFixed(1)}%)`);
    
    // Step 2: Calculate precise input amount with progressive buffer strategy
    const baseRate = bestRoute.rate;
    const targetAmountNum = parseFloat(targetAmount);
    
    let attempt = 0;
    let lastResult = null;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`\n🎯 Precision Attempt ${attempt}/${maxAttempts}`);
      
      // Progressive buffer calculation
      const bufferRange = maxBuffer - minBuffer;
      const bufferIncrement = bufferRange / (maxAttempts - 1);
      const currentBuffer = minBuffer + (bufferIncrement * (attempt - 1));
      
      console.log(`📊 Using ${(currentBuffer * 100).toFixed(1)}% buffer for attempt ${attempt}`);
      
      // Calculate required input with reality check and buffer
      const theoreticalInput = targetAmountNum / baseRate;
      const realityAdjustedInput = theoreticalInput / realityMultiplier;
      const bufferedInput = realityAdjustedInput * (1 + currentBuffer);
      
      console.log(`💡 Calculation breakdown:`);
      console.log(`   Theoretical input: ${theoreticalInput.toFixed(6)} ${fromCurrency}`);
      console.log(`   Reality adjusted (${(realityMultiplier * 100)}%): ${realityAdjustedInput.toFixed(6)} ${fromCurrency}`);
      console.log(`   Buffered input: ${bufferedInput.toFixed(6)} ${fromCurrency}`);
      
      // Step 3: Execute conversion with enhanced error handling
      console.log(`🚀 Executing conversion: ${bufferedInput.toFixed(6)} ${fromCurrency} → ${targetAmount} ${toCurrency}`);
      
      try {
        const { sendCrossCurrency } = require('../transactionController/sendCrossCurrency');
        
        const conversionResult = await withRetry(
          async () => {
            return await withTimeout(
              async () => {
                return await sendCrossCurrency(
                  userWallet,
                  userWallet.classicAddress, // Send to self for conversion
                  fromCurrency,
                  bufferedInput.toFixed(6),
                  toCurrency,
                  issuerAddress,
                  10, // 10% slippage tolerance for Smart Trade
                  null // no destination tag
                );
              },
              timeout / maxAttempts, // Divide timeout by attempts
              { 
                operation: 'cross_currency_conversion', 
                attempt, 
                fromCurrency, 
                toCurrency, 
                amount: bufferedInput.toFixed(6) 
              }
            );
          },
          RetryConfigs.TRANSACTION_SUBMIT,
          { 
            operation: 'smart_trade_conversion', 
            attempt, 
            fromCurrency, 
            toCurrency,
            targetAmount
          }
        );
        
        console.log(`📊 sendCrossCurrency response:`, JSON.stringify(conversionResult, null, 2));
        
        if (conversionResult.success) {
          // Step 4: Validate conversion output
          let deliveredAmount = 0;
          try {
            const amountDeliveredStr = conversionResult.amountDelivered;
            console.log(`🔍 Raw amountDelivered: "${amountDeliveredStr}"`);
            
            if (typeof amountDeliveredStr === 'string') {
              const numericMatch = amountDeliveredStr.match(/[\d.]+/);
              if (numericMatch) {
                deliveredAmount = parseFloat(numericMatch[0]);
                console.log(`✅ Parsed delivered amount: ${deliveredAmount}`);
              } else {
                console.log(`❌ No numeric match found in: "${amountDeliveredStr}"`);
              }
            } else {
              deliveredAmount = parseFloat(amountDeliveredStr) || 0;
              console.log(`✅ Direct parsed delivered amount: ${deliveredAmount}`);
            }
          } catch (parseError) {
            console.log(`⚠️ Error parsing delivered amount: ${parseError.message}`);
            deliveredAmount = 0;
          }
          
          const shortfall = targetAmountNum - deliveredAmount;
          const shortfallPercent = (shortfall / targetAmountNum) * 100;
          
          console.log(`📊 Conversion Results:`);
          console.log(`   Delivered: ${deliveredAmount.toFixed(6)} ${toCurrency}`);
          console.log(`   Required: ${targetAmountNum.toFixed(6)} ${toCurrency}`);
          console.log(`   Shortfall: ${shortfall.toFixed(6)} ${toCurrency} (${shortfallPercent.toFixed(2)}%)`);
          
          if (deliveredAmount >= targetAmountNum) {
            console.log(`✅ Smart Trade SUCCESS! Delivered ${deliveredAmount.toFixed(6)} ${toCurrency}`);
            
            return {
              success: true,
              inputAmount: bufferedInput.toFixed(6),
              inputCurrency: fromCurrency,
              outputAmount: deliveredAmount.toFixed(6),
              outputCurrency: toCurrency,
              targetAmount: targetAmount,
              actualRate: deliveredAmount / bufferedInput,
              predictedRate: baseRate,
              rateAccuracy: ((deliveredAmount / bufferedInput) / baseRate) * 100,
              buffer: currentBuffer,
              attempt: attempt,
              route: bestRoute.type,
              confidence: bestRoute.confidence,
              transactionHash: conversionResult.txHash,
              excess: deliveredAmount > targetAmountNum ? (deliveredAmount - targetAmountNum).toFixed(6) : '0'
            };
          } else {
            console.log(`⚠️ Attempt ${attempt} insufficient: ${shortfallPercent.toFixed(2)}% shortfall`);
            lastResult = {
              attempt,
              inputAmount: bufferedInput.toFixed(6),
              deliveredAmount: deliveredAmount.toFixed(6),
              shortfall: shortfall.toFixed(6),
              shortfallPercent: shortfallPercent.toFixed(2)
            };
            
            if (attempt === maxAttempts) {
              console.log(`❌ All attempts exhausted. Final shortfall: ${shortfallPercent.toFixed(2)}%`);
              break;
            }
          }
        } else {
          console.log(`❌ Conversion failed on attempt ${attempt}: ${conversionResult.error}`);
          lastResult = {
            attempt,
            error: conversionResult.error,
            inputAmount: bufferedInput.toFixed(6)
          };
          
          if (attempt === maxAttempts) {
            break;
          }
        }
      } catch (conversionError) {
        console.log(`❌ Conversion threw error on attempt ${attempt}: ${conversionError.message}`);
        lastResult = {
          attempt,
          error: conversionError.message,
          inputAmount: bufferedInput.toFixed(6)
        };
        
        if (attempt === maxAttempts) {
          break;
        }
      }
    }
    
    // If we get here, all attempts failed
    return {
      success: false,
      error: 'Smart trade failed after all attempts',
      targetAmount: targetAmount,
      targetCurrency: toCurrency,
      sourceCurrency: fromCurrency,
      attempts: maxAttempts,
      lastResult,
      route: bestRoute.type,
      predictedRate: baseRate,
      confidence: bestRoute.confidence
    };
    
  } catch (error) {
    const enhancedError = reportError(error, {
      operation: 'executeSmartTrade',
      fromCurrency,
      toCurrency,
      targetAmount,
      issuerAddress,
      options
    });
    
    console.error(`❌ Smart trade error: ${enhancedError.message}`);
    
    return {
      success: false,
      error: enhancedError.message,
      errorType: enhancedError.type,
      retryable: enhancedError.retryable,
      targetAmount,
      targetCurrency: toCurrency,
      sourceCurrency: fromCurrency,
      timestamp: enhancedError.timestamp
    };
  }
};

/**
 * Calculate precise buffer for AMM trades using Core Engine analysis
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} amount - Trade amount
 * @param {string} issuerAddress - Issuer address
 * @returns {Promise<object>} Buffer calculation result
 */
export async function calculatePreciseBuffer(fromCurrency, toCurrency, amount, issuerAddress) {
  try {
    console.log(`🧮 Calculating precise buffer for ${amount} ${fromCurrency} → ${toCurrency}`);
    
    const analysis = await analyzeMarket(
      fromCurrency,
      toCurrency,
      amount,
      issuerAddress,
      {
        purpose: 'buffer_calculation',
        includeAMM: true,
        includeDEX: true,
        includeHybrid: false // Focus on direct routes for buffer calc
      }
    );
    
    if (!analysis.success) {
      return {
        success: false,
        error: 'Market analysis failed for buffer calculation',
        fallbackBuffer: 0.5 // 50% fallback buffer
      };
    }
    
    const bestRoute = analysis.bestRoute;
    let calculatedBuffer = 0.05;
    
    // Route-specific buffer calculations
    if (bestRoute.type === 'AMM') {
      // AMM buffer based on liquidity and slippage
      const liquidityRatio = bestRoute.path.liquidityRatio || 10;
      const slippageBuffer = bestRoute.slippage || 0.03;
      
      if (liquidityRatio < 5) {
        calculatedBuffer += 0.15; // 15% for low liquidity
      } else if (liquidityRatio < 20) {
        calculatedBuffer += 0.08; // 8% for medium liquidity
          } else {
        calculatedBuffer += 0.03; // 3% for high liquidity
      }
      
      calculatedBuffer += slippageBuffer;
      
    } else if (bestRoute.type === 'DEX') {
      // DEX buffer based on order book depth
      const orderBookDepth = analysis.routes.dex?.orderBookDepth || 1;
      
      if (orderBookDepth < 3) {
        calculatedBuffer += 0.12; // 12% for thin order book
      } else if (orderBookDepth < 10) {
        calculatedBuffer += 0.06; // 6% for medium depth
          } else {
        calculatedBuffer += 0.02; // 2% for deep order book
      }
      
    } else {
      // Hybrid routes get higher buffer
      calculatedBuffer += 0.10; // 10% for hybrid complexity
    }
    
    // Confidence adjustment
    const confidenceAdjustment = (1 - bestRoute.confidence) * 0.1; // Up to 10% for low confidence
    calculatedBuffer += confidenceAdjustment;
    
    // Cap the buffer at reasonable limits
    calculatedBuffer = Math.min(calculatedBuffer, 0.8); // Max 80%
    calculatedBuffer = Math.max(calculatedBuffer, 0.05); // Min 5%
    
    console.log(`📊 Buffer calculation:`);
    console.log(`   Route: ${bestRoute.type}`);
    console.log(`   Confidence: ${(bestRoute.confidence * 100).toFixed(1)}%`);
    console.log(`   Calculated buffer: ${(calculatedBuffer * 100).toFixed(1)}%`);
    
    return {
      success: true,
      buffer: calculatedBuffer,
      route: bestRoute.type,
      confidence: bestRoute.confidence,
      breakdown: {
        baseBuffer: 0.05,
        routeBuffer: calculatedBuffer - 0.05 - confidenceAdjustment,
        confidenceAdjustment,
        total: calculatedBuffer
      }
    };
    
  } catch (error) {
    console.error(`❌ Buffer calculation error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      fallbackBuffer: 0.3 // 30% fallback buffer
    };
  }
};

/**
 * 📊 MARKET INTELLIGENCE FOR OFFERS
 * Consolidated smart offer logic - analyze markets and provide competitive pricing
 */

/**
 * Get competitive offer pricing based on current market
 * @param {string} sellCurrency - Currency to sell
 * @param {string} sellAmount - Amount to sell
 * @param {string} buyCurrency - Currency to buy
 * @param {string} buyAmount - Amount to buy (or "market" for market rate)
 * @param {string} issuerAddress - Issuer address
 * @param {object} options - Pricing options
 * @returns {Promise<object>} Market-informed pricing
 */
export async function getCompetitiveOfferPricing(sellCurrency, sellAmount, buyCurrency, buyAmount, issuerAddress, options = {}) {
  try {
    const {
      competitiveBuffer = 0.01, // 1% buffer to be competitive
      slippagePercent = 5
    } = options;
    
    console.log(`📊 Analyzing market for competitive offer pricing...`);
    
    const marketAnalysis = await analyzeMarket(
      sellCurrency,
      buyCurrency,
      sellAmount,
      issuerAddress,
      { 
        purpose: 'offer_creation',
        slippageBuffer: slippagePercent / 100
      }
    );
    
    let finalBuyAmount = buyAmount;
    let offerRate;
    let isCompetitive = true;
    let marketAnalysisData = null;
    
    if (marketAnalysis.success) {
      const marketRate = marketAnalysis.bestRoute.rate;
      const marketOutput = parseFloat(sellAmount) * marketRate;
      
      marketAnalysisData = {
        currentMarketRate: marketRate,
        marketValue: marketOutput,
        routeType: marketAnalysis.bestRoute.type
      };
      
      console.log(`📈 Current Market Rate: ${marketRate.toFixed(6)} (via ${marketAnalysis.bestRoute.type})`);
      console.log(`💰 Market Value: ${marketOutput.toFixed(6)} ${buyCurrency}`);
      
      if (buyAmount === 'market') {
        // Set buy amount based on market rate with competitive buffer
        finalBuyAmount = (marketOutput * (1 - competitiveBuffer)).toFixed(6);
        console.log(`⚡ Setting competitive offer at: ${finalBuyAmount} ${buyCurrency} (${(competitiveBuffer * 100).toFixed(1)}% better than market)`);
      } else {
        // Check if our desired rate is competitive
        const ourRate = parseFloat(buyAmount) / parseFloat(sellAmount);
        const competitiveRate = marketRate * (1 - competitiveBuffer);
        
        if (ourRate < competitiveRate) {
          console.log(`⚠️ Warning: Your offer rate (${ourRate.toFixed(6)}) is less competitive than market rate (${marketRate.toFixed(6)})`);
          console.log(`💡 Consider adjusting to at least ${(competitiveRate * parseFloat(sellAmount)).toFixed(6)} ${buyCurrency} for better execution`);
          isCompetitive = false;
        } else {
          console.log(`✅ Your offer rate is competitive with current market`);
        }
      }
      
      offerRate = parseFloat(finalBuyAmount) / parseFloat(sellAmount);
    } else {
      console.log(`ℹ️ No market data available for rate analysis, proceeding with your specified rate`);
      if (buyAmount === 'market') {
        throw new Error("Cannot create market order - no market data available");
      }
      offerRate = parseFloat(finalBuyAmount) / parseFloat(sellAmount);
    }
    
    return {
      success: true,
      finalBuyAmount,
      offerRate,
      isCompetitive,
      marketAnalysis: marketAnalysisData
    };
    
      } catch (error) {
    console.error(`❌ Competitive pricing analysis error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Analyze order book depth and provide positioning recommendations
 * @param {string} sellCurrency - Currency being sold
 * @param {string} buyCurrency - Currency being bought
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} Order book analysis
 */
export async function analyzeOrderBookDepth(sellCurrency, buyCurrency, issuerAddress) {
  try {
    await connectXrplClient();
    
    // Prepare currency objects for order book lookup
    let baseCurrency, counterCurrency;
    
    if (sellCurrency === "XRP") {
      baseCurrency = { currency: "XRP" };
    } else {
      baseCurrency = {
        currency: sellCurrency,
        issuer: issuerAddress
      };
    }
    
    if (buyCurrency === "XRP") {
      counterCurrency = { currency: "XRP" };
    } else {
      counterCurrency = {
        currency: buyCurrency,
        issuer: issuerAddress
      };
    }
    
    // Get order book data
    const orderBookRequest = {
      command: "book_offers",
      taker_gets: baseCurrency,
      taker_pays: counterCurrency,
      limit: 50
    };
    
    const orderBookResponse = await client.request(orderBookRequest);
    const offers = orderBookResponse.result.offers || [];
    
    const recommendations = [];
    
    if (offers.length === 0) {
      recommendations.push("No competing offers found - you could set a favorable rate");
    } else {
      // Analyze the spread and depth
      const rates = offers.map(offer => calculateOfferRate(offer)).filter(rate => rate > 0);
      
      if (rates.length > 0) {
        const bestRate = Math.max(...rates);
        const worstRate = Math.min(...rates);
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
        
        recommendations.push(`${offers.length} competing offers found`);
        recommendations.push(`Best rate: ${bestRate.toFixed(6)}, Worst: ${worstRate.toFixed(6)}, Avg: ${avgRate.toFixed(6)}`);
        
        if (offers.length < 5) {
          recommendations.push("Low competition - good opportunity for favorable rates");
        } else if (offers.length > 20) {
          recommendations.push("High competition - consider very competitive pricing");
        }
        
        // Check concentration
        const topFiveVolume = offers.slice(0, 5).reduce((total, offer) => {
          const volume = typeof offer.TakerGets === 'string' ? 
            parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
            parseFloat(offer.TakerGets.value);
          return total + volume;
        }, 0);
        
        const totalVolume = offers.reduce((total, offer) => {
          const volume = typeof offer.TakerGets === 'string' ? 
            parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
            parseFloat(offer.TakerGets.value);
          return total + volume;
        }, 0);
        
        if (totalVolume > 0 && topFiveVolume / totalVolume > 0.8) {
          recommendations.push("Order book concentrated in top offers - consider competitive pricing");
        }
      }
    }
    
    return {
      success: true,
      orderCount: offers.length,
      recommendations,
      offers: offers.slice(0, 10) // Return top 10 for analysis
    };
    
  } catch (error) {
    console.error(`❌ Order book analysis error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      recommendations: ["Order book analysis unavailable - proceed with manual rate setting"]
    };
  }
};

/**
 * Calculate rate from an offer object
 * @param {object} offer - XRPL offer object
 * @returns {number} Exchange rate
 */
export function calculateOfferRate(offer) {
  try {
    const getsAmount = typeof offer.TakerGets === 'string' ? 
      parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
      parseFloat(offer.TakerGets.value);
      
    const paysAmount = typeof offer.TakerPays === 'string' ? 
      parseFloat(xrpl.dropsToXrp(offer.TakerPays)) : 
      parseFloat(offer.TakerPays.value);
      
    return paysAmount / getsAmount;
  } catch (error) {
    return 0;
  }
}; 