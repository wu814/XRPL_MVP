import * as xrpl from "xrpl";
import { client, connectXrplClient } from "../testnet";
import { findBestPath } from "../pathfind/corePathfindingEngine";
import createOffer from "./createOffer";
import createImmediateOrCancelOffer from "./createImmediateOrCancelOffer";
import createFillOrKillOffer from "./createFillOrKillOffer";
import createPassiveOffer from "./createPassiveOffer";
import createSellOffer from "./createSellOffer";

/**
 * Create a smart offer with pathfinding-based rate optimization
 * @param {object} wallet - The wallet creating the offer
 * @param {string} sellCurrency - Currency to sell
 * @param {string} sellAmount - Amount to sell
 * @param {string} buyCurrency - Currency to buy
 * @param {string} buyAmount - Amount to buy (or "market" for market rate)
 * @param {string} issuerAddress - Issuer address for tokens
 * @param {object} options - Additional options (orderType, slippage, etc.)
 * @returns {Promise<object>} Smart offer result
 */
export default async function createSmartOffer(
  wallet,
  sellCurrency,
  sellAmount,
  buyCurrency,
  buyAmount,
  issuerAddress,
  options = {}
) {
  try {
    await connectXrplClient();
    
    const {
      orderType = 'regular', // 'regular', 'immediate', 'fill_or_kill', 'passive'
      slippagePercent = 0,
      checkMarketFirst = true,
      competitiveBuffer = 0.01 // 1% buffer to be competitive
    } = options;
    
    console.log(`🎯 Smart Offer: Sell ${sellAmount} ${sellCurrency} for ${buyAmount === 'market' ? 'market rate' : buyAmount} ${buyCurrency}`);
    
    let finalBuyAmount = buyAmount;
    let offerRate;
    let isCompetitive = true;
    
    // Step 1: Market rate analysis if requested
    if (checkMarketFirst || buyAmount === 'market') {
      console.log(`📊 Analyzing market rates...`);
      
      const marketAnalysis = await findBestPath(
        wallet.classicAddress,
        wallet.classicAddress,
        sellCurrency,
        buyCurrency,
        sellAmount,
        issuerAddress
      );
      
      if (marketAnalysis.success) {
        const marketRate = marketAnalysis.bestOption.bestRate;
        const marketOutput = parseFloat(sellAmount) * marketRate;
        
        console.log(`📈 Current Market Rate: ${marketRate.toFixed(6)} (via ${marketAnalysis.winner})`);
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
    } else {
      offerRate = parseFloat(finalBuyAmount) / parseFloat(sellAmount);
    }
    
    // Step 2: Check order book depth for better positioning
    const orderBookAnalysis = await analyzeOrderBook(sellCurrency, buyCurrency, issuerAddress);
    if (orderBookAnalysis.recommendations.length > 0) {
      console.log(`📚 Order Book Insights:`);
      orderBookAnalysis.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    // Step 3: Prepare offer objects
    let takerPays, takerGets;
    
    // TakerPays = what the taker pays = what we get (buy currency)
    if (buyCurrency === "XRP") {
      takerPays = xrpl.xrpToDrops(finalBuyAmount);
    } else {
      takerPays = {
        currency: buyCurrency,
        issuer: issuerAddress,
        value: finalBuyAmount
      };
    }
    
    // TakerGets = what the taker gets = what we sell
    if (sellCurrency === "XRP") {
      takerGets = xrpl.xrpToDrops(sellAmount);
    } else {
      takerGets = {
        currency: sellCurrency,
        issuer: issuerAddress,
        value: sellAmount
      };
    }
    
    console.log(`📝 Final Offer Details:`);
    console.log(`   Rate: ${offerRate.toFixed(6)} ${buyCurrency}/${sellCurrency}`);
    console.log(`   Selling: ${sellAmount} ${sellCurrency}`);
    console.log(`   Asking: ${finalBuyAmount} ${buyCurrency}`);
    console.log(`   Competitive: ${isCompetitive ? '✅' : '⚠️'}`);
    
    // Step 4: Create the offer based on type
    let result;
    
    switch (orderType) {
      case 'immediate':
        result = await createImmediateOrCancelOffer(wallet, takerPays, takerGets);
        break;
      case 'fill_or_kill':
        result = await createFillOrKillOffer(wallet, takerPays, takerGets);
        break;
      case 'passive':
        result = await createPassiveOffer(wallet, takerPays, takerGets);
        break;
      case 'sell':
        result = await createSellOffer(wallet, takerPays, takerGets);
        break;
      default: // regular
        result = await createOffer(wallet, takerPays, takerGets);
        break;
    }
    
    // Enhance result with analysis data
    if (result.success) {
      result.marketAnalysis = {
        isCompetitive,
        offerRate,
        orderType,
        finalBuyAmount
      };
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Smart offer creation error: ${error.message}`);
    throw new Error(`Smart offer creation failed: ${error.message}`);
  }
}

/**
 * Analyze order book depth and provide positioning recommendations
 * @param {string} sellCurrency - Currency being sold
 * @param {string} buyCurrency - Currency being bought
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} Order book analysis
 */
export async function analyzeOrderBook(sellCurrency, buyCurrency, issuerAddress) {
  try {
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
    
    if (offers.length > 0) {
      const bestOffer = offers[0];
      const worstOffer = offers[offers.length - 1];
      
      // Calculate best and worst rates
      const bestRate = calculateOfferRate(bestOffer);
      const worstRate = calculateOfferRate(worstOffer);
      const spread = Math.abs(bestRate - worstRate);
      
      recommendations.push(`Best rate in book: ${bestRate.toFixed(6)}`);
      
      if (spread > bestRate * 0.05) { // 5% spread
        recommendations.push(`Wide spread detected (${((spread/bestRate)*100).toFixed(1)}%) - consider competitive pricing`);
      }
      
      if (offers.length < 5) {
        recommendations.push(`Thin order book (${offers.length} offers) - your order may have significant impact`);
      }
      
      // Check for large orders that might indicate support/resistance
      const largeOrders = offers.filter(offer => {
        const amount = typeof offer.TakerGets === 'string' ? 
          parseFloat(xrpl.dropsToXrp(offer.TakerGets)) : 
          parseFloat(offer.TakerGets.value);
        return amount > 1000; // Adjust threshold as needed
      });
      
      if (largeOrders.length > 0) {
        recommendations.push(`${largeOrders.length} large orders detected - potential support/resistance levels`);
      }
    } else {
      recommendations.push(`Empty order book - your offer may be the first`);
    }
    
    return {
      offers,
      recommendations,
      depth: offers.length
    };
    
  } catch (error) {
    console.error(`Error analyzing order book: ${error.message}`);
    return {
      offers: [],
      recommendations: [`Order book analysis unavailable: ${error.message}`],
      depth: 0
    };
  }
}

/**
 * Calculate rate from an offer object
 * @param {object} offer - XRPL offer object
 * @returns {number} Exchange rate
 */
function calculateOfferRate(offer) {
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
} 