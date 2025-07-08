import { NextResponse } from "next/server";
import { getOracleData } from "@/utils/xrpl/oracle/orcaleData";
import { fetchCoinGeckoPrices } from "@/utils/xrpl/oracle/orcaleSet";

export async function POST(request) {
  try {
    const { account, oracleDocumentId, ledgerIndex = "validated" } = await request.json();

    // Validate required fields
    if (!account || !oracleDocumentId) {
      return NextResponse.json(
        { error: "Missing required fields: account and oracleDocumentId are required" },
        { status: 400 }
      );
    }

    // First, get the oracle structure from XRPL
    const result = await getOracleData(account, oracleDocumentId, ledgerIndex);
    
    if (result.success) {
      console.log("✅ Oracle structure retrieved successfully!");
      console.log("\n📊 Oracle Information:");
      console.log(`🆔 Oracle ID: ${oracleDocumentId}`);
      console.log(`👤 Owner: ${result.oracle.Owner}`);
      console.log(`🏢 Provider: ${result.oracle.Provider}`);
      console.log(`📂 Asset Class: ${result.oracle.AssetClass}`);
      console.log(`⏰ Oracle Created: ${new Date(result.oracle.LastUpdateTime * 1000).toISOString()}`);
      console.log(`💰 XRP Reserve: ${result.oracle.PriceDataSeries?.length <= 5 ? '1 XRP' : '2 XRP'} (${result.oracle.PriceDataSeries?.length || 0} assets)`);
      
      let livePricesData = [];
      
      if (result.oracle.PriceDataSeries && result.oracle.PriceDataSeries.length > 0) {
        // Extract the asset pairs from the oracle
        const assetPairs = result.oracle.PriceDataSeries.map(series => ({
          baseAsset: series.PriceData.BaseAsset,
          quoteAsset: series.PriceData.QuoteAsset
        }));
        
        // Map assets to CoinGecko IDs
        const symbolToCoinGeckoId = {
          'BTC': 'bitcoin',
          'ETH': 'ethereum', 
          'XRP': 'ripple',
          'SOL': 'solana',
          'ADA': 'cardano',
          'DOT': 'polkadot',
          'LINK': 'chainlink',
          'LTC': 'litecoin',
          'BCH': 'bitcoin-cash',
          'XLM': 'stellar',
          'EUR': 'euro-coin'  // EUR uses EURC price data
        };
        
        const coinIds = assetPairs
          .map(pair => symbolToCoinGeckoId[pair.baseAsset])
          .filter(id => id); // Remove undefined values
        
        if (coinIds.length > 0) {
          console.log("\n🌐 Fetching current live prices...");
          
          // Fetch current live prices
          const livePrices = await fetchCoinGeckoPrices(coinIds, 'usd');
          
          console.log("\n💰 Live Price Data:");
          livePricesData = assetPairs.map((pair, index) => {
            const livePrice = livePrices.find(p => p.symbol === pair.baseAsset);
            
            console.log(`\n${index + 1}. ${pair.baseAsset}/${pair.quoteAsset}:`);
            if (livePrice) {
              console.log(`   💵 Current Live Price: $${livePrice.price.toFixed(2)}`);
              console.log(`   ⏰ Last Updated: ${new Date(livePrice.lastUpdated * 1000).toLocaleString()}`);
              
              return {
                baseAsset: pair.baseAsset,
                quoteAsset: pair.quoteAsset,
                price: livePrice.price,
                lastUpdated: livePrice.lastUpdated,
                formattedPrice: livePrice.price.toFixed(2),
                available: true
              };
            } else {
              console.log(`   ❌ Live price not available`);
              return {
                baseAsset: pair.baseAsset,
                quoteAsset: pair.quoteAsset,
                price: null,
                lastUpdated: null,
                formattedPrice: null,
                available: false
              };
            }
          });
          
          console.log(`\n🌐 Data Source: Live from CoinGecko API`);
          console.log(`📅 Fetched: Just now`);
        } else {
          console.log("\n⚠️ No supported assets found for live price fetching");
          console.log("Supported: BTC, ETH, XRP, SOL, ADA, DOT, LINK, LTC, BCH, XLM");
        }
      }

      return NextResponse.json({
        success: true,
        message: "Live prices retrieved successfully",
        oracle: {
          id: oracleDocumentId,
          owner: result.oracle.Owner,
          provider: result.oracle.Provider,
          assetClass: result.oracle.AssetClass,
          lastUpdateTime: result.oracle.LastUpdateTime,
          xrpReserve: result.oracle.PriceDataSeries?.length <= 5 ? '1 XRP' : '2 XRP',
          assetsCount: result.oracle.PriceDataSeries?.length || 0
        },
        livePrices: livePricesData,
        dataSource: "CoinGecko API",
        fetchedAt: new Date().toISOString(),
        ledgerIndex: result.ledgerIndex
      });
    }

  } catch (error) {
    console.error("❌ Failed to get oracle data:", error.message);
    return NextResponse.json(
      { error: error.message || "Failed to get live prices" },
      { status: 500 }
    );
  }
} 