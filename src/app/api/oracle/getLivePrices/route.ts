import { NextRequest, NextResponse } from "next/server";
import { getOracleData } from "@/utils/xrpl/oracle/orcaleData";
import { fetchCoinGeckoPrices } from "@/utils/xrpl/oracle/orcaleSet";

interface GetLivePricesRequest {
  account: string;
  oracleDocumentId: number;
  ledgerIndex?: string;
}

interface AssetPair {
  baseAsset: string;
  quoteAsset: string;
}

interface LivePriceData {
  baseAsset: string;
  quoteAsset: string;
  price: number | null;
  lastUpdated: number | null;
  formattedPrice: string | null;
  available: boolean;
  source: string;
}

interface CoinGeckoPrice {
  symbol: string;
  price: number;
  lastUpdated: number;
}

// Import the types from the oracle data file
interface PriceDataSeries {
  PriceData: {
    BaseAsset: string;
    QuoteAsset: string;
    AssetPrice: string | number;
    Scale: number;
    AssetPriceDecimal?: number;
  };
}

/**
 * Extract price data from oracle's PriceDataSeries as fallback
 * @param priceDataSeries - Oracle's PriceDataSeries array
 * @returns Array of price data objects
 */
function extractOraclePrices(priceDataSeries: PriceDataSeries[]): LivePriceData[] {
  console.log("\n🔮 Extracting prices from oracle data as fallback...");
  
  return priceDataSeries.map((series, index) => {
    const priceData = series.PriceData;
    const baseAsset = priceData.BaseAsset;
    const quoteAsset = priceData.QuoteAsset;
    const oraclePrice = priceData.AssetPriceDecimal || 0;
    
    console.log(`\n${index + 1}. ${baseAsset}/${quoteAsset}:`);
    console.log(`   💵 Oracle Price: $${oraclePrice.toFixed(2)}`);
    console.log(`    Raw Price: ${priceData.AssetPrice} (scale: ${priceData.Scale})`);
    
    return {
      baseAsset: baseAsset,
      quoteAsset: quoteAsset,
      price: oraclePrice,
      lastUpdated: null, // Oracle doesn't store individual asset update times
      formattedPrice: oraclePrice.toFixed(2),
      available: true,
      source: 'oracle'
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const { account, oracleDocumentId, ledgerIndex = "validated" }: GetLivePricesRequest = await request.json();

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
      let livePricesData: LivePriceData[] = [];
      let dataSource = "Oracle Data (Fallback)";
      
      if (result.oracle.PriceDataSeries && result.oracle.PriceDataSeries.length > 0) {
        // Extract the asset pairs from the oracle
        const assetPairs: AssetPair[] = result.oracle.PriceDataSeries.map(series => ({
          baseAsset: series.PriceData.BaseAsset,
          quoteAsset: series.PriceData.QuoteAsset
        }));
        
        // Map assets to CoinGecko IDs
        const symbolToCoinGeckoId: Record<string, string> = {
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
          .filter((id): id is string => !!id); // Remove undefined values
        
        // Try to fetch live prices from CoinGecko first
        if (coinIds.length > 0) {
          try {
            console.log("\n🌐 Attempting to fetch current live prices from CoinGecko...");
            
            // Fetch current live prices
            const livePrices: CoinGeckoPrice[] = await fetchCoinGeckoPrices(coinIds, 'usd');
            
            console.log("\n💰 Live Price Data (CoinGecko):");
            livePricesData = assetPairs.map((pair, index) => {
              const livePrice = livePrices.find(p => p.symbol === pair.baseAsset);
              
              console.log(`\n${index + 1}. ${pair.baseAsset}/${pair.quoteAsset}:`);
              if (livePrice) {
                console.log(`   �� Current Live Price: $${livePrice.price.toFixed(2)}`);
                console.log(`   ⏰ Last Updated: ${new Date(livePrice.lastUpdated * 1000).toLocaleString()}`);
                
                return {
                  baseAsset: pair.baseAsset,
                  quoteAsset: pair.quoteAsset,
                  price: livePrice.price,
                  lastUpdated: livePrice.lastUpdated,
                  formattedPrice: livePrice.price.toFixed(2),
                  available: true,
                  source: 'coingecko'
                };
              } else {
                console.log(`   ❌ Live price not available`);
                return {
                  baseAsset: pair.baseAsset,
                  quoteAsset: pair.quoteAsset,
                  price: null,
                  lastUpdated: null,
                  formattedPrice: null,
                  available: false,
                  source: 'coingecko'
                };
              }
            });
            
            dataSource = "CoinGecko API";
            console.log(`\n🌐 Data Source: ${dataSource}`);
            console.log(`📅 Fetched: Just now`);
            
          } catch (coinGeckoError) {
            console.error("❌ CoinGecko API failed:", coinGeckoError instanceof Error ? coinGeckoError.message : 'Unknown error');
            console.log("🔄 Falling back to oracle data...");
            
            // Fallback to oracle data
            livePricesData = extractOraclePrices(result.oracle.PriceDataSeries);
            dataSource = "Oracle Data (Fallback)";
            console.log(`\n🔮 Data Source: ${dataSource}`);
            console.log(`📅 Oracle Last Updated: ${new Date(result.oracle.LastUpdateTime * 1000).toLocaleString()}`);
          }
        } else {
          console.log("\n⚠️ No supported assets found for CoinGecko API");
          console.log("🔄 Using oracle data instead...");
          
          // Use oracle data directly
          livePricesData = extractOraclePrices(result.oracle.PriceDataSeries);
          dataSource = "Oracle Data (Direct)";
          console.log(`\n🔮 Data Source: ${dataSource}`);
          console.log(`📅 Oracle Last Updated: ${new Date(result.oracle.LastUpdateTime * 1000).toLocaleString()}`);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Prices retrieved successfully",
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
        dataSource: dataSource,
        fetchedAt: new Date().toISOString(),
        ledgerIndex: result.ledgerIndex,
        fallbackUsed: dataSource.includes("Fallback") || dataSource.includes("Direct")
      });
    }

  } catch (error) {
    console.error("❌ Failed to get oracle data:", error instanceof Error ? error.message : 'Unknown error');
    const errorMessage = error instanceof Error ? error.message : 'Failed to get prices';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
