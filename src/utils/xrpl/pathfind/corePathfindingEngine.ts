import * as xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";

// Type definitions
interface MarketAnalysisOptions {
  includeAMM?: boolean;
  includeDEX?: boolean;
  includeHybrid?: boolean;
  slippageBuffer?: number;
  maxHops?: number;
  purpose?: 'analysis' | 'trading' | 'offer_creation' | 'exact_output_analysis';
  targetOutput?: number | null;
  isExactOutput?: boolean;
}

interface MarketAnalysis {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  issuerAddress: string;
  purpose: string;
  timestamp: string;
  routes: {
    amm: RouteAnalysis | null;
    dex: RouteAnalysis | null;
    hybrid: RouteAnalysis | null;
  };
  bestRoute: BestRoute | null;
  marketDepth: any | null;
  liquidityAnalysis: any | null;
  success: boolean;
  error?: string;
}

interface RouteAnalysis {
  success: boolean;
  type: string;
  bestRate: number;
  bestPath: PathInfo;
  allRoutes: PathInfo[];
  routeCount: number;
  error?: string;
  orderBookDepth?: number;
}

interface PathInfo {
  rate: number;
  amountOut?: number;
  requiredInput?: number;
  liquidityRatio?: number;
  path: string;
  ammAccount?: string;
  hops?: Array<{
    input?: number;
    output?: number;
    pool?: any;
    rate: number;
    path: string;
  }>;
  intermediateCurrency?: string;
  pools?: string[];
  offersUsed?: number;
  orderBookDepth?: number;
  fromBalance?: number;
  toBalance?: number;
  tradingFee?: number;
  feeAmount?: number;
  theoreticalOutput?: number;
  priceImpact?: number;
  error?: string;
}

interface BestRoute {
  type: string;
  rate: number;
  estimatedOutput: string;
  path: PathInfo;
}

interface AMMData {
  [key: string]: {
    amm_account: string;
    currency_a: {
      currency: string;
      issuer: string;
      value: string;
    };
    currency_b: {
      currency: string;
      issuer: string;
      value: string;
    };
    trading_fee: number;
  };
}

interface OrderBookData {
  direct: any[];
  multiHop: {
    fromToXrp: any[];
    xrpToTo: any[];
    reverse: any[];
  };
}

interface OrderBookAnalysis {
  success: boolean;
  orderCount: number;
  recommendations: string[];
  offers: any[];
  error?: string;
}

export async function analyzeMarket(
  fromCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  issuerAddress: string, 
  options: MarketAnalysisOptions = {}
): Promise<MarketAnalysis> {
  try {
    await connectXrplClient();
    
    const {
      includeAMM = true,
      includeDEX = true,
      includeHybrid = true,
      slippageBuffer = 0.00,
      maxHops = 3,
      purpose = 'analysis',
      targetOutput = null
    } = options;
    
    console.log(`🔍 Core Market Analysis: ${fromAmount} ${fromCurrency} → ${toCurrency} (${purpose})`);
    
    const analysis: MarketAnalysis = {
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
      const displayOutput = (purpose === 'exact_output_analysis' && options.targetOutput) ? 
        options.targetOutput.toFixed(6) : 
        path.amountOut?.toFixed(6);
      console.log(`  📊 ${candidate.type}: Rate ${candidate.analysis.bestRate?.toFixed(6)}, Output ${displayOutput}, Path: ${path.path}`);
    });
    
    if (candidates.length > 0) {
      let bestCandidate;
      if (purpose === 'exact_output_analysis') {
        console.log(`🎯 EXACT OUTPUT MODE: Comparing by exchange rate efficiency (higher rate = better)`);
        bestCandidate = candidates.reduce((best, current) => {
          console.log(`  🔄 Comparing ${current.type} (rate: ${current.analysis.bestRate?.toFixed(6)}) vs ${best.type} (rate: ${best.analysis.bestRate?.toFixed(6)})`);
          
          if (current.analysis.bestRate > best.analysis.bestRate) {
            console.log(`    ✅ ${current.type} has better rate (${current.analysis.bestRate?.toFixed(6)} > ${best.analysis.bestRate?.toFixed(6)})`);
            return current;
          } else {
            console.log(`    ⚪ ${best.type} maintains better rate (${best.analysis.bestRate?.toFixed(6)} >= ${current.analysis.bestRate?.toFixed(6)})`);
            return best;
          }
        });
      } else {
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
      };
      
      analysis.success = true;
      
      console.log(`🏆 Best Route: ${analysis.bestRoute.type} (Rate: ${analysis.bestRoute.rate.toFixed(6)})`);
      console.log(`🛤️ Path: ${analysis.bestRoute.path.path}`);
    } else {
      console.log(`❌ No viable routes found`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Core market analysis error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      fromCurrency,
      toCurrency,
      fromAmount: parseFloat(fromAmount),
      issuerAddress,
      purpose: 'analysis',
      timestamp: new Date().toISOString(),
      routes: { amm: null, dex: null, hybrid: null },
      bestRoute: null,
      marketDepth: null,
      liquidityAnalysis: null
    };
  }
}

async function analyzeAMMRoutes(
  fromCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  issuerAddress: string, 
  isExactOutput: boolean = false, 
  targetOutput: number | null = null
): Promise<RouteAnalysis> {
  try {
    console.log(`🔵 AMM Route Analysis...`);
    if (isExactOutput && targetOutput) {
      console.log(`🎯 EXACT OUTPUT MODE: Finding minimum ${fromCurrency} input to get exactly ${targetOutput} ${toCurrency}`);
    }
    
    // Get LIVE AMM data using universal function - NO CACHING for accuracy
    const { getAllAMMData, getAMMInfo } = await import("../amm/ammUtils.js");
    const ammRegistry = await getAllAMMData();
    const ammData: AMMData = {};
    
    // Get live data for each pool using universal function
    for (const [pairKey, poolInfo] of Object.entries(ammRegistry)) {
      try {
        const liveInfo = await getAMMInfo(poolInfo.amm_account);

        if (liveInfo) {
          ammData[pairKey] = {
            amm_account: liveInfo.amm_account,
            currency_a: {
              currency: liveInfo.amount.currency,
              issuer: liveInfo.amount.issuer,
              value: liveInfo.amount.value
            },
            currency_b: {
              currency: liveInfo.amount2.currency,
              issuer: liveInfo.amount2.issuer,
              value: liveInfo.amount2.value
            },
            trading_fee: liveInfo.trading_fee
          };
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get live data for ${pairKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const routes: PathInfo[] = [];
    let bestRate = 0;
    let bestPath: PathInfo | null = null;
    
    console.log(`📊 Analyzing ${Object.keys(ammData).length} AMM pools`);
    
    // Direct AMM routes
    for (const [ammId, amm] of Object.entries(ammData)) {
      let directRoute: PathInfo | null = null;
      
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
    if (multiHopRoutes.success && multiHopRoutes.allRoutes) {
      routes.push(...multiHopRoutes.allRoutes);
      
      // Update best if multi-hop is better
      multiHopRoutes.allRoutes.forEach(route => {
        if (route.rate > bestRate) {
          bestRate = route.rate;
          bestPath = route;
        }
      });
    }
    
    if (!bestPath) {
      return {
        success: false,
        type: 'AMM',
        bestRate: 0,
        bestPath: {
          rate: 0,
          path: `${fromCurrency} → ${toCurrency}`,
          amountOut: 0
        },
        allRoutes: [],
        routeCount: 0,
        error: 'No viable AMM routes found'
      };
    }
    
    return {
      success: routes.length > 0,
      type: 'AMM',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length
    };
    
  } catch (error) {
    console.error(`❌ AMM analysis error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      type: 'AMM',
      bestRate: 0,
      bestPath: {
        rate: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        amountOut: 0
      },
      allRoutes: [],
      routeCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function analyzeDEXRoutes(
  fromCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  issuerAddress: string
): Promise<RouteAnalysis> {
  try {
    console.log(`🟡 DEX Route Analysis...`);
    
    const orderBooks = await getOrderBookData(fromCurrency, toCurrency, issuerAddress);
    const routes: PathInfo[] = [];
    let bestRate = 0;
    let bestPath: PathInfo | null = null;
    
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
    
    if (!bestPath) {
      return {
        success: false,
        type: 'DEX',
        bestRate: 0,
        bestPath: {
          rate: 0,
          path: `${fromCurrency} → ${toCurrency}`,
          amountOut: 0
        },
        allRoutes: [],
        routeCount: 0,
        error: 'No viable DEX routes found'
      };
    }
    
    return {
      success: routes.length > 0,
      type: 'DEX',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length,
      orderBookDepth: calculateOrderBookDepth(orderBooks)
    };
    
  } catch (error) {
    console.error(`❌ DEX analysis error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      type: 'DEX',
      bestRate: 0,
      bestPath: {
        rate: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        amountOut: 0
      },
      allRoutes: [],
      routeCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function analyzeHybridRoutes(
  fromCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  issuerAddress: string
): Promise<RouteAnalysis> {
  try {
    console.log(`🟣 Hybrid Route Analysis...`);
    
    // Get both AMM and DEX data using universal function
    const { getAllAMMData, getAMMInfo } = await import("../amm/ammUtils.js");
    const ammRegistry = await getAllAMMData();
    const ammData: AMMData = {};
    
    // Get live AMM data for hybrid routes
    for (const [pairKey, poolInfo] of Object.entries(ammRegistry)) {
      try {
        const liveInfo = await getAMMInfo(poolInfo.amm_account);
        if (liveInfo) {
          ammData[pairKey] = {
            amm_account: liveInfo.amm_account,
            currency_a: {
              currency: liveInfo.amount.currency,
              issuer: liveInfo.amount.issuer,
              value: liveInfo.amount.value
            },
            currency_b: {
              currency: liveInfo.amount2.currency,
              issuer: liveInfo.amount2.issuer,
              value: liveInfo.amount2.value
            },
            trading_fee: liveInfo.trading_fee
          };
        }
      } catch (error) {
        console.warn(`⚠️ Failed to get live data for ${pairKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const orderBooks = await getOrderBookData(fromCurrency, toCurrency, issuerAddress);
    
    const routes: PathInfo[] = [];
    let bestRate = 0;
    let bestPath: PathInfo | null = null;
    
    // Find intermediate currencies available in both AMM and DEX
    const ammCurrencies = new Set(['XRP']);
    Object.values(ammData).forEach(amm => {
      if (amm.currency_a?.currency) ammCurrencies.add(amm.currency_a.currency);
      if (amm.currency_b?.currency) ammCurrencies.add(amm.currency_b.currency);
    });
    
    // Try hybrid routes through each intermediate currency
    for (const intermediateCurrency of Array.from(ammCurrencies)) {
      if (intermediateCurrency === fromCurrency || intermediateCurrency === toCurrency) continue;
      
      // Try AMM → DEX route
      const ammDexRoute = analyzeHybridRoute(
        'AMM_DEX', 
        fromCurrency, 
        intermediateCurrency, 
        toCurrency, 
        fromAmount, 
        orderBooks, 
        ammData, 
        issuerAddress
      );
      
      if (ammDexRoute.rate > 0) {
        routes.push(ammDexRoute);
        if (ammDexRoute.rate > bestRate) {
          bestRate = ammDexRoute.rate;
          bestPath = ammDexRoute;
        }
      }
      
      // Try DEX → AMM route
      const dexAMMRoute = analyzeHybridRoute(
        'DEX_AMM', 
        fromCurrency, 
        intermediateCurrency, 
        toCurrency, 
        fromAmount, 
        orderBooks, 
        ammData, 
        issuerAddress
      );
      
      if (dexAMMRoute.rate > 0) {
        routes.push(dexAMMRoute);
        if (dexAMMRoute.rate > bestRate) {
          bestRate = dexAMMRoute.rate;
          bestPath = dexAMMRoute;
        }
      }
    }
    
    if (!bestPath) {
      return {
        success: false,
        type: 'Hybrid',
        bestRate: 0,
        bestPath: {
          rate: 0,
          path: `${fromCurrency} → ${toCurrency}`,
          amountOut: 0
        },
        allRoutes: [],
        routeCount: 0,
        error: 'No viable hybrid routes found'
      };
    }
    
    return {
      success: routes.length > 0,
      type: 'Hybrid',
      bestRate,
      bestPath,
      allRoutes: routes,
      routeCount: routes.length
    };
    
  } catch (error) {
    console.error(`❌ Hybrid analysis error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      type: 'Hybrid',
      bestRate: 0,
      bestPath: {
        rate: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        amountOut: 0
      },
      allRoutes: [],
      routeCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get order book data for a currency pair
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} issuerAddress - Issuer address
 * @returns {Promise<OrderBookData>} Order book data
 */
export async function getOrderBookData(fromCurrency: string, toCurrency: string, issuerAddress: string): Promise<OrderBookData> {
  const orderBooks: OrderBookData = {
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
      let takerGets: any, takerPays: any;
      
      if (fromCurrency === "XRP") {
        takerGets = { currency: toCurrency, issuer: issuerAddress };
        takerPays = { currency: "XRP" };
      } else if (toCurrency === "XRP") {
        takerGets = { currency: "XRP" };
        takerPays = { currency: fromCurrency, issuer: issuerAddress };
      } else {
        takerGets = { currency: toCurrency, issuer: issuerAddress };   // What we want
        takerPays = { currency: fromCurrency, issuer: issuerAddress }; // What we're giving
      }
      
      const directResponse = await client.request({
        command: "book_offers",
        taker_gets: takerGets,
        taker_pays: takerPays,
        limit: 20
      });
      
      orderBooks.direct = directResponse.result.offers || [];
      
      console.log(`🔍 DEBUG: Querying ${fromCurrency} → ${toCurrency} order book:`);
      console.log(`   TakerGets: ${JSON.stringify(takerGets)}`);
      console.log(`   TakerPays: ${JSON.stringify(takerPays)}`);
      console.log(`   Found ${orderBooks.direct.length} offers`);
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
    console.error(`❌ Error fetching order book data: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return orderBooks;
}

/**
 * Calculate rate from an offer object
 * @param {any} offer - XRPL offer object
 * @returns {number} Exchange rate
 */
export function calculateOfferRate(offer: any): number {
  try {
    const getsAmount = typeof offer.TakerGets === 'string' ? 
      xrpl.dropsToXrp(offer.TakerGets) : 
      parseFloat(offer.TakerGets.value);
      
    const paysAmount = typeof offer.TakerPays === 'string' ? 
      xrpl.dropsToXrp(offer.TakerPays) : 
      parseFloat(offer.TakerPays.value);
      
    return paysAmount / getsAmount;
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate order book depth from order book data
 * @param {OrderBookData} orderBooks - Order book data
 * @returns {number} Total depth
 */
export function calculateOrderBookDepth(orderBooks: OrderBookData): number {
  return orderBooks.direct.length + orderBooks.multiHop.fromToXrp.length + orderBooks.multiHop.xrpToTo.length;
}

/**
 * Analyze order book depth and provide recommendations
 * @param {OrderBookData} orderBooks - Order book data
 * @returns {OrderBookAnalysis} Analysis results
 */
export function analyzeOrderBookDepth(orderBooks: OrderBookData): OrderBookAnalysis {
  try {
    const totalOffers = calculateOrderBookDepth(orderBooks);
    const directOffers = orderBooks.direct.length;
    const multiHopOffers = orderBooks.multiHop.fromToXrp.length + orderBooks.multiHop.xrpToTo.length;
    
    const recommendations = [];
    
    if (totalOffers === 0) {
      recommendations.push("No liquidity available for this currency pair");
    } else if (totalOffers < 10) {
      recommendations.push("Low liquidity - consider smaller trade sizes");
    } else if (totalOffers < 50) {
      recommendations.push("Moderate liquidity - monitor for better opportunities");
    } else {
      recommendations.push("Good liquidity - competitive pricing expected");
    }
    
    if (directOffers === 0 && multiHopOffers > 0) {
      recommendations.push("Only multi-hop routes available - higher fees expected");
    }
    
    return {
      success: true,
      orderCount: totalOffers,
      recommendations,
      offers: [...orderBooks.direct, ...orderBooks.multiHop.fromToXrp, ...orderBooks.multiHop.xrpToTo]
    };
    
  } catch (error) {
    return {
      success: false,
      orderCount: 0,
      recommendations: [],
      offers: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Analyze direct AMM route between two currencies
 * @param {any} amm - AMM data
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} fromAmount - Amount to trade
 * @returns {PathInfo} Route information
 */
export function analyzeDirectAMMRoute(amm: any, fromCurrency: string, toCurrency: string, fromAmount: string): PathInfo {
  try {
    const fromBalance = parseFloat(amm.currency_a.currency === fromCurrency ? amm.currency_a.value : amm.currency_b.value);
    const toBalance = parseFloat(amm.currency_a.currency === toCurrency ? amm.currency_a.value : amm.currency_b.value);
    
    // Calculate output using constant product formula
    const k = fromBalance * toBalance;
    const newFromBalance = fromBalance + parseFloat(fromAmount);
    const newToBalance = k / newFromBalance;
    const amountOut = toBalance - newToBalance;
    
    // Calculate rate
    const rate = amountOut / parseFloat(fromAmount);
    
    // Calculate trading fee
    const tradingFee = amm.trading_fee || 0.003; // Default 0.3%
    const feeAmount = amountOut * tradingFee;
    const finalOutput = amountOut - feeAmount;
    
    // Calculate price impact
    const theoreticalOutput = (parseFloat(fromAmount) * toBalance) / fromBalance;
    const priceImpact = ((theoreticalOutput - finalOutput) / theoreticalOutput) * 100;
    
    return {
      rate,
      amountOut: finalOutput,
      path: `${fromCurrency} → ${toCurrency}`,
      ammAccount: amm.amm_account,
      fromBalance,
      toBalance,
      tradingFee,
      feeAmount,
      theoreticalOutput,
      priceImpact,
      liquidityRatio: fromBalance / (fromBalance + parseFloat(fromAmount))
    };
  } catch (error) {
    return {
      rate: 0,
      amountOut: 0,
      path: `${fromCurrency} → ${toCurrency}`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Analyze multi-hop AMM routes
 * @param {AMMData} ammData - AMM data for all pools
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} fromAmount - Amount to trade
 * @param {string} issuerAddress - Issuer address
 * @param {boolean} isExactOutput - Whether this is exact output mode
 * @param {number} targetOutput - Target output amount
 * @returns {RouteAnalysis} Route analysis
 */
export function analyzeMultiHopAMMRoutes(
  ammData: AMMData, 
  fromCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  issuerAddress: string, 
  isExactOutput: boolean = false, 
  targetOutput: number | null = null
): RouteAnalysis {
  try {
    const routes: PathInfo[] = [];
    
    // Find pools that contain the from currency
    const fromPools = Object.values(ammData).filter(amm => 
      amm.currency_a.currency === fromCurrency || amm.currency_b.currency === fromCurrency
    );
    
    // Find pools that contain the to currency
    const toPools = Object.values(ammData).filter(amm => 
      amm.currency_a.currency === toCurrency || amm.currency_b.currency === toCurrency
    );
    
    // Find intermediate currencies (currencies that appear in both from and to pools)
    const intermediateCurrencies = new Set<string>();
    
    fromPools.forEach(fromPool => {
      const otherCurrency = fromPool.currency_a.currency === fromCurrency ? 
        fromPool.currency_b.currency : fromPool.currency_a.currency;
      if (otherCurrency !== fromCurrency && otherCurrency !== toCurrency) {
        intermediateCurrencies.add(otherCurrency);
      }
    });
    
    toPools.forEach(toPool => {
      const otherCurrency = toPool.currency_a.currency === toCurrency ? 
        toPool.currency_b.currency : toPool.currency_a.currency;
      if (otherCurrency !== fromCurrency && otherCurrency !== toCurrency) {
        intermediateCurrencies.add(otherCurrency);
      }
    });
    
    // Generate routes through intermediate currencies
    Array.from(intermediateCurrencies).forEach(intermediateCurrency => {
      const fromPool = fromPools.find(amm => 
        (amm.currency_a.currency === fromCurrency && amm.currency_b.currency === intermediateCurrency) ||
        (amm.currency_b.currency === fromCurrency && amm.currency_a.currency === intermediateCurrency)
      );
      
      const toPool = toPools.find(amm => 
        (amm.currency_a.currency === intermediateCurrency && amm.currency_b.currency === toCurrency) ||
        (amm.currency_b.currency === intermediateCurrency && amm.currency_a.currency === toCurrency)
      );
      
      if (fromPool && toPool) {
        // Calculate first hop
        const firstHop = analyzeDirectAMMRoute(fromPool, fromCurrency, intermediateCurrency, fromAmount);
        
        if (firstHop.amountOut && firstHop.amountOut > 0) {
          // Calculate second hop
          const secondHop = analyzeDirectAMMRoute(toPool, intermediateCurrency, toCurrency, firstHop.amountOut.toString());
          
          if (secondHop.amountOut && secondHop.amountOut > 0) {
            const totalRate = secondHop.amountOut / parseFloat(fromAmount);
            
            routes.push({
              rate: totalRate,
              amountOut: secondHop.amountOut,
              path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
              intermediateCurrency,
              pools: [fromPool.amm_account, toPool.amm_account],
              hops: [firstHop, secondHop],
              fromBalance: firstHop.fromBalance,
              toBalance: secondHop.toBalance,
              tradingFee: (firstHop.tradingFee || 0) + (secondHop.tradingFee || 0),
              feeAmount: (firstHop.feeAmount || 0) + (secondHop.feeAmount || 0),
              theoreticalOutput: secondHop.theoreticalOutput,
              priceImpact: Math.max(firstHop.priceImpact || 0, secondHop.priceImpact || 0)
            });
          }
        }
      }
    });
    
    if (routes.length === 0) {
      return {
        success: false,
        type: 'Multi-Hop AMM',
        bestRate: 0,
        bestPath: {
          rate: 0,
          path: `${fromCurrency} → ${toCurrency}`,
          amountOut: 0
        },
        allRoutes: [],
        routeCount: 0,
        error: 'No viable multi-hop AMM routes found'
      };
    }
    
    // Sort routes by rate (best first)
    routes.sort((a, b) => b.rate - a.rate);
    
    return {
      success: true,
      type: 'Multi-Hop AMM',
      bestRate: routes[0].rate,
      bestPath: routes[0],
      allRoutes: routes,
      routeCount: routes.length
    };
    
  } catch (error) {
    return {
      success: false,
      type: 'Multi-Hop AMM',
      bestRate: 0,
      bestPath: {
        rate: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        amountOut: 0
      },
      allRoutes: [],
      routeCount: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Calculate required input for a target output in AMM
 * @param {any} amm - AMM data
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {number} targetOutput - Target output amount
 * @returns {number} Required input amount
 */
export function calculateAMMInputForOutput(amm: any, fromCurrency: string, toCurrency: string, targetOutput: number): number {
  try {
    const fromBalance = parseFloat(amm.currency_a.currency === fromCurrency ? amm.currency_a.value : amm.currency_b.value);
    const toBalance = parseFloat(amm.currency_a.currency === toCurrency ? amm.currency_a.value : amm.currency_b.value);
    
    // Using constant product formula: (x + dx) * (y - dy) = k
    // where k = x * y, and we want dy = targetOutput
    const k = fromBalance * toBalance;
    const newToBalance = toBalance - targetOutput;
    const newFromBalance = k / newToBalance;
    const requiredInput = newFromBalance - fromBalance;
    
    // Add trading fee
    const tradingFee = amm.trading_fee || 0.003;
    const feeAdjustedInput = requiredInput / (1 - tradingFee);
    
    return Math.max(0, feeAdjustedInput);
  } catch (error) {
    return 0;
  }
}

/**
 * Calculate liquidity ratio for an AMM
 * @param {any} amm - AMM data
 * @param {string} fromCurrency - Source currency
 * @param {number} tradeAmount - Trade amount
 * @returns {number} Liquidity ratio
 */
export function calculateLiquidityRatio(amm: any, fromCurrency: string, tradeAmount: number): number {
  try {
    const fromBalance = parseFloat(amm.currency_a.currency === fromCurrency ? amm.currency_a.value : amm.currency_b.value);
    return fromBalance / (fromBalance + tradeAmount);
  } catch (error) {
    return 0;
  }
}

/**
 * Analyze direct DEX route using order book
 * @param {any[]} offers - Array of offers
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} fromAmount - Amount to trade
 * @returns {PathInfo} Route information
 */
export function analyzeDirectDEXRoute(offers: any[], fromCurrency: string, toCurrency: string, fromAmount: string): PathInfo {
  try {
    if (!offers || offers.length === 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        error: 'No offers available'
      };
    }
    
    // Sort offers by best rate (highest rate first for selling fromCurrency)
    const sortedOffers = offers.sort((a, b) => {
      const rateA = calculateOfferRate(a);
      const rateB = calculateOfferRate(b);
      return rateB - rateA;
    });
    
    let remainingAmount = parseFloat(fromAmount);
    let totalOutput = 0;
    let offersUsed = 0;
    
    for (const offer of sortedOffers) {
      if (remainingAmount <= 0) break;
      
      const offerRate = calculateOfferRate(offer);
      if (offerRate <= 0) continue;
      
      const offerAmount = typeof offer.TakerGets === 'string' ? 
        xrpl.dropsToXrp(offer.TakerGets) : 
        parseFloat(offer.TakerGets.value);
      
      const tradeAmount = Math.min(remainingAmount, offerAmount);
      const output = tradeAmount * offerRate;
      
      totalOutput += output;
      remainingAmount -= tradeAmount;
      offersUsed++;
    }
    
    if (remainingAmount > 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → ${toCurrency}`,
        error: `Insufficient liquidity. Remaining: ${remainingAmount}`
      };
    }
    
    const averageRate = totalOutput / parseFloat(fromAmount);
    
    return {
      rate: averageRate,
      amountOut: totalOutput,
      path: `${fromCurrency} → ${toCurrency}`,
      offersUsed,
      orderBookDepth: offers.length
    };
    
  } catch (error) {
    return {
      rate: 0,
      amountOut: 0,
      path: `${fromCurrency} → ${toCurrency}`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Analyze multi-hop DEX route
 * @param {any} multiHopData - Multi-hop order book data
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {string} fromAmount - Amount to trade
 * @returns {PathInfo} Route information
 */
export function analyzeMultiHopDEXRoute(multiHopData: any, fromCurrency: string, toCurrency: string, fromAmount: string): PathInfo {
  try {
    // This is a simplified implementation - you may want to expand this
    // based on your specific multi-hop logic
    
    const fromToXrpOffers = multiHopData.fromToXrp || [];
    const xrpToToOffers = multiHopData.xrpToTo || [];
    
    if (fromToXrpOffers.length === 0 || xrpToToOffers.length === 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → XRP → ${toCurrency}`,
        error: 'Insufficient multi-hop liquidity'
      };
    }
    
    // Calculate first hop (fromCurrency to XRP)
    const firstHop = analyzeDirectDEXRoute(fromToXrpOffers, fromCurrency, 'XRP', fromAmount);
    
    if (!firstHop.amountOut || firstHop.amountOut <= 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → XRP → ${toCurrency}`,
        error: 'First hop failed'
      };
    }
    
    // Calculate second hop (XRP to toCurrency)
    const secondHop = analyzeDirectDEXRoute(xrpToToOffers, 'XRP', toCurrency, (firstHop.amountOut || 0).toString());
    
    if (!secondHop.amountOut || secondHop.amountOut <= 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → XRP → ${toCurrency}`,
        error: 'Second hop failed'
      };
    }
    
    const totalRate = secondHop.amountOut / parseFloat(fromAmount);
    
    return {
      rate: totalRate,
      amountOut: secondHop.amountOut,
      path: `${fromCurrency} → XRP → ${toCurrency}`,
      intermediateCurrency: 'XRP',
      offersUsed: (firstHop.offersUsed || 0) + (secondHop.offersUsed || 0),
      orderBookDepth: (firstHop.orderBookDepth || 0) + (secondHop.orderBookDepth || 0)
    };
    
  } catch (error) {
    return {
      rate: 0,
      amountOut: 0,
      path: `${fromCurrency} → XRP → ${toCurrency}`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Analyze hybrid route combining AMM and DEX
 * @param {string} routeType - Type of hybrid route
 * @param {string} fromCurrency - Source currency
 * @param {string} intermediateCurrency - Intermediate currency
 * @param {string} toCurrency - Target currency
 * @param {string} fromAmount - Amount to trade
 * @param {any} orderBooks - Order book data
 * @param {any} ammData - AMM data
 * @param {string} issuerAddress - Issuer address
 * @returns {PathInfo} Route information
 */
export function analyzeHybridRoute(
  routeType: string, 
  fromCurrency: string, 
  intermediateCurrency: string, 
  toCurrency: string, 
  fromAmount: string, 
  orderBooks: any, 
  ammData: any, 
  issuerAddress: string
): PathInfo {
  try {
    let firstHop: PathInfo;
    let secondHop: PathInfo;
    
    if (routeType === 'AMM_DEX') {
      // First hop: AMM (fromCurrency → intermediateCurrency)
      const amm = Object.values(ammData).find((amm: any) => 
        (amm.currency_a.currency === fromCurrency && amm.currency_b.currency === intermediateCurrency) ||
        (amm.currency_b.currency === fromCurrency && amm.currency_a.currency === intermediateCurrency)
      );
      
      if (!amm) {
        return {
          rate: 0,
          amountOut: 0,
          path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
          error: 'AMM pool not found for first hop'
        };
      }
      
      firstHop = analyzeDirectAMMRoute(amm, fromCurrency, intermediateCurrency, fromAmount);
      
      if (!firstHop.amountOut || firstHop.amountOut <= 0) {
        return {
          rate: 0,
          amountOut: 0,
          path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
          error: 'First hop AMM failed'
        };
      }
      
      // Second hop: DEX (intermediateCurrency → toCurrency)
      const offers = orderBooks.direct || [];
      secondHop = analyzeDirectDEXRoute(offers, intermediateCurrency, toCurrency, firstHop.amountOut.toString());
      
    } else if (routeType === 'DEX_AMM') {
      // First hop: DEX (fromCurrency → intermediateCurrency)
      const offers = orderBooks.direct || [];
      firstHop = analyzeDirectDEXRoute(offers, fromCurrency, intermediateCurrency, fromAmount);
      
      if (!firstHop.amountOut || firstHop.amountOut <= 0) {
        return {
          rate: 0,
          amountOut: 0,
          path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
          error: 'First hop DEX failed'
        };
      }
      
      // Second hop: AMM (intermediateCurrency → toCurrency)
      const amm = Object.values(ammData).find((amm: any) => 
        (amm.currency_a.currency === intermediateCurrency && amm.currency_b.currency === toCurrency) ||
        (amm.currency_b.currency === intermediateCurrency && amm.currency_a.currency === toCurrency)
      );
      
      if (!amm) {
        return {
          rate: 0,
          amountOut: 0,
          path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
          error: 'AMM pool not found for second hop'
        };
      }
      
      secondHop = analyzeDirectAMMRoute(amm, intermediateCurrency, toCurrency, firstHop.amountOut.toString());
      
    } else {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
        error: `Unknown hybrid route type: ${routeType}`
      };
    }
    
    if (!secondHop.amountOut || secondHop.amountOut <= 0) {
      return {
        rate: 0,
        amountOut: 0,
        path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
        error: 'Second hop failed'
      };
    }
    
    const totalRate = secondHop.amountOut / parseFloat(fromAmount);
    
    return {
      rate: totalRate,
      amountOut: secondHop.amountOut,
      path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
      intermediateCurrency,
      hops: [firstHop, secondHop],
      offersUsed: (firstHop.offersUsed || 0) + (secondHop.offersUsed || 0),
      orderBookDepth: (firstHop.orderBookDepth || 0) + (secondHop.orderBookDepth || 0)
    };
    
  } catch (error) {
    return {
      rate: 0,
      amountOut: 0,
      path: `${fromCurrency} → ${intermediateCurrency} → ${toCurrency}`,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
