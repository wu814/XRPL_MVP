import { client, connectXRPLClient } from "../testnet";
import { Wallet } from "xrpl";
import axios from "axios";

interface CoinGeckoPrice {
  symbol: string;
  price: number;
  quoteAsset: string;
  lastUpdated: number;
}

interface PriceData {
  baseAsset: string;
  quoteAsset: string;
  assetPrice: number;
  scale: number;
}

interface OracleSetResult {
  success: boolean;
  transactionHash: string;
  oracleDocumentID: number;
  assetCount: number;
  xrpReserve: number;
  ledgerIndex: number;
  result: any;
}

interface PriceDataSeries {
  PriceData: {
    BaseAsset: string;
    QuoteAsset: string;
    AssetPrice: number;
    Scale: number;
  };
}

/**
 * Fetch current prices from CoinGecko API
 * @param cryptoSymbols - Array of crypto symbols (e.g., ['bitcoin', 'ethereum', 'ripple', 'solana'])
 * @param vsCurrency - Quote currency (e.g., 'usd')
 * @returns Array of {symbol, price, quoteAsset} objects
 */
export async function fetchCoinGeckoPrices(
  cryptoSymbols: string[], 
  vsCurrency: string = 'usd'
): Promise<CoinGeckoPrice[]> {
  try {
    // Ensure vsCurrency is lowercase for CoinGecko API
    vsCurrency = vsCurrency.toLowerCase();
    
    console.log(`🌐 Fetching current prices from CoinGecko for: ${cryptoSymbols.join(', ')}`);
    
    // CoinGecko API endpoint for simple price data
    const url = `https://api.coingecko.com/api/v3/simple/price`;
    const params = {
      ids: cryptoSymbols.join(','),
      vs_currencies: vsCurrency,
      include_last_updated_at: true
    };
    
    const response = await axios.get(url, { params });
    const priceData = response.data;
    
    console.log(`✅ Successfully fetched prices from CoinGecko`);
    
    // Convert CoinGecko response to our format
    const prices: CoinGeckoPrice[] = [];
    for (const coinId of cryptoSymbols) {
      if (priceData[coinId] && priceData[coinId][vsCurrency]) {
        // Map CoinGecko IDs to standard symbols
        const symbolMap: Record<string, string> = {
          'bitcoin': 'BTC',
          'ethereum': 'ETH', 
          'ripple': 'XRP',
          'solana': 'SOL',
          'cardano': 'ADA',
          'polkadot': 'DOT',
          'chainlink': 'LINK',
          'litecoin': 'LTC',
          'bitcoin-cash': 'BCH',
          'stellar': 'XLM',
          'euro-coin': 'EUR'  // Use EURC price data to represent EUR
        };
        
        const symbol = symbolMap[coinId] || coinId.toUpperCase();
        const price = priceData[coinId][vsCurrency];
        
        prices.push({
          symbol: symbol,
          price: price,
          quoteAsset: vsCurrency.toUpperCase(),
          lastUpdated: priceData[coinId].last_updated_at
        });
        
        console.log(`   💰 ${symbol}/${vsCurrency.toUpperCase()}: $${price}`);
      } else {
        console.warn(`⚠️ No price data found for ${coinId}`);
      }
    }
    
    return prices;
    
  } catch (error) {
    console.error(`❌ Error fetching prices from CoinGecko:`, error instanceof Error ? error.message : String(error));
    if (axios.isAxiosError(error) && error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    throw error;
  }
}

/**
 * Create a multi-asset crypto oracle with live prices from CoinGecko
 * @param ownerWallet - XRPL wallet object
 * @param oracleDocumentID - Unique identifier
 * @param coinGeckoIDs - Array of CoinGecko coin IDs (e.g., ['bitcoin', 'ethereum', 'ripple', 'solana'])
 * @param vsCurrency - Quote currency (default: 'usd')
 * @returns Transaction result
 */
export async function createLiveCryptoOracle(
  ownerWallet: Wallet, 
  oracleDocumentID: number, 
  coinGeckoIDs: string[], 
  vsCurrency: string = 'usd'
): Promise<OracleSetResult> {
  try {
    // Fetch current prices from CoinGecko
    const livePrices = await fetchCoinGeckoPrices(coinGeckoIDs, vsCurrency);
    
    if (livePrices.length === 0) {
      throw new Error("No price data retrieved from CoinGecko");
    }
    
    // Convert to oracle format
    const scale = 2;
    const priceDataArray: PriceData[] = livePrices.map(crypto => ({
      baseAsset: crypto.symbol,
      quoteAsset: crypto.quoteAsset,
      assetPrice: Math.round(crypto.price * Math.pow(10, scale)),
      scale: scale
    }));
    
    console.log(`🔮 Creating oracle with ${priceDataArray.length} live prices from CoinGecko`);
    
    return await oracleSetMultiAsset(
      ownerWallet,
      oracleDocumentID,
      "CoinGecko",           // Provider
      "cryptocurrency",      // Asset class
      priceDataArray
    );
    
  } catch (error) {
    console.error(`❌ Error creating live crypto oracle:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create or update a Price Oracle on XRPL with multiple price data series
 * @param ownerWallet - XRPL wallet object
 * @param oracleDocumentID - Unique identifier for this Price Oracle instance
 * @param provider - Provider identifier (will be hex-encoded)
 * @param assetClass - Asset class (will be hex-encoded)
 * @param priceDataArray - Array of price data objects
 * @returns Transaction result
 */
export async function oracleSetMultiAsset(
  ownerWallet: Wallet, 
  oracleDocumentID: number, 
  provider: string, 
  assetClass: string, 
  priceDataArray: PriceData[]
): Promise<OracleSetResult> {
  try {
    await connectXRPLClient();

    // Convert provider and assetClass to hex encoding
    const providerHex = Buffer.from(provider, 'utf8').toString('hex').toUpperCase();
    const assetClassHex = Buffer.from(assetClass, 'utf8').toString('hex').toUpperCase();

    console.log(`🔮 Creating/Updating Multi-Asset Price Oracle (ID: ${oracleDocumentID})`);
    console.log(`   📊 Assets: ${priceDataArray.length} price pairs`);
    console.log(`   🏢 Provider: ${provider} (hex: ${providerHex})`);
    console.log(`   📂 Asset Class: ${assetClass} (hex: ${assetClassHex})`);
    
    // Display all assets being added
    priceDataArray.forEach((priceData, index) => {
      console.log(`   ${index + 1}. ${priceData.baseAsset}/${priceData.quoteAsset}: ${priceData.assetPrice} (scale: ${priceData.scale})`);
    });

    // Build PriceDataSeries array
    const priceDataSeries: PriceDataSeries[] = priceDataArray.map(priceData => {
      // Convert asset names to proper XRPL format
      const formatAsset = (asset: string): string => {
        if (asset.length <= 3) {
          return asset; // Standard 3-char codes
        } else {
          // For assets longer than 3 characters, hex-encode them
          // XRPL requires 160-bit (40 hex chars) for currency codes
          return Buffer.from(asset, 'utf8').toString('hex').toUpperCase().padEnd(40, '0');
        }
      };

      return {
        PriceData: {
          BaseAsset: formatAsset(priceData.baseAsset),
          QuoteAsset: formatAsset(priceData.quoteAsset),
          AssetPrice: priceData.assetPrice,
          Scale: priceData.scale
        }
      };
    });

    const oracleSetTx = {
      TransactionType: "OracleSet" as const,
      Account: ownerWallet.classicAddress,
      OracleDocumentID: oracleDocumentID,
      Provider: providerHex,
      AssetClass: assetClassHex,
      LastUpdateTime: Math.floor(Date.now() / 1000), // Current Unix time
      PriceDataSeries: priceDataSeries
    };

    console.log(`📜 Submitting OracleSet transaction with ${priceDataSeries.length} assets...`);

    try {
      const response = await client.submitAndWait(oracleSetTx, { 
        autofill: true, 
        wallet: ownerWallet 
      });
      
      console.log("✅ OracleSet Transaction Result:", response);
      
      if ((response.result.meta as any).TransactionResult === "tesSUCCESS") {
        console.log(`🎉 Multi-Asset Price Oracle ${oracleDocumentID} created/updated successfully!`);
        console.log(`📋 Transaction Hash: ${response.result.hash}`);
        console.log(`💰 XRP Reserve: ${priceDataSeries.length <= 5 ? '0.2 XRP' : '0.4 XRP'} (${priceDataSeries.length} assets)`);

        
        return {
          success: true,
          transactionHash: response.result.hash,
          oracleDocumentID: oracleDocumentID,
          assetCount: priceDataSeries.length,
          xrpReserve: priceDataSeries.length <= 5 ? 0.2 : 0.4,
          ledgerIndex: response.result.ledger_index,
          result: response.result
        };
      } else {
        throw new Error(`Transaction failed: ${(response.result.meta as any).TransactionResult}`);
      }
      
    } catch (error) {
      console.error("❌ Failed to submit OracleSet transaction:", error);
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error in oracleSetMultiAsset:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
