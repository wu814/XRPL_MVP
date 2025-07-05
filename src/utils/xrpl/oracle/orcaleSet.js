import { client, connectXrplClient } from "../testnet";
import axios from "axios";



/**
 * Fetch current prices from CoinGecko API
 * @param {Array} cryptoSymbols - Array of crypto symbols (e.g., ['bitcoin', 'ethereum', 'ripple', 'solana'])
 * @param {string} vsCurrency - Quote currency (e.g., 'usd')
 * @returns {Promise<Array>} Array of {symbol, price, quoteAsset} objects
 */
 export async function fetchCoinGeckoPrices(cryptoSymbols, vsCurrency = 'usd') {
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
    const prices = [];
    for (const coinId of cryptoSymbols) {
      if (priceData[coinId] && priceData[coinId][vsCurrency]) {
        // Map CoinGecko IDs to standard symbols
        const symbolMap = {
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
    console.error(`❌ Error fetching prices from CoinGecko:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    throw error;
  }
};

/**
 * Create a multi-asset crypto oracle with live prices from CoinGecko
 * @param {Wallet} ownerWallet - XRPL wallet object
 * @param {number} oracleDocumentID - Unique identifier
 * @param {Array} coinGeckoIDs - Array of CoinGecko coin IDs (e.g., ['bitcoin', 'ethereum', 'ripple', 'solana'])
 * @param {string} vsCurrency - Quote currency (default: 'usd')
 * @returns {Promise<object>} Transaction result
 */
export async function createLiveCryptoOracle(ownerWallet, oracleDocumentID, coinGeckoIDs, vsCurrency = 'usd') {
  try {
    // Fetch current prices from CoinGecko
    const livePrices = await fetchCoinGeckoPrices(coinGeckoIDs, vsCurrency);
    
    if (livePrices.length === 0) {
      throw new Error("No price data retrieved from CoinGecko");
    }
    
    // Convert to oracle format
    const scale = 2;
    const priceDataArray = livePrices.map(crypto => ({
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
    console.error(`❌ Error creating live crypto oracle:`, error.message);
    throw error;
  }
};


/**
 * Create or update a Price Oracle on XRPL with multiple price data series
 * @param {Wallet} ownerWallet - XRPL wallet object
 * @param {number} oracleDocumentID - Unique identifier for this Price Oracle instance
 * @param {string} provider - Provider identifier (will be hex-encoded)
 * @param {string} assetClass - Asset class (will be hex-encoded)
 * @param {Array} priceDataArray - Array of price data objects
 * @returns {Promise<object>} Transaction result
 */
export async function oracleSetMultiAsset(ownerWallet, oracleDocumentID, provider, assetClass, priceDataArray) {
  try {
    await connectXrplClient();

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
    const priceDataSeries = priceDataArray.map(priceData => {
      // Convert asset names to proper XRPL format
      const formatAsset = (asset) => {
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
      TransactionType: "OracleSet",
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
      
      if (response.result.meta.TransactionResult === "tesSUCCESS") {
        console.log(`🎉 Multi-Asset Price Oracle ${oracleDocumentID} created/updated successfully!`);
        console.log(`📋 Transaction Hash: ${response.result.hash}`);
        console.log(`💰 XRP Reserve: ${priceDataSeries.length <= 5 ? '1 XRP' : '2 XRP'} (${priceDataSeries.length} assets)`);
        
        return {
          success: true,
          transactionHash: response.result.hash,
          oracleDocumentID: oracleDocumentID,
          assetCount: priceDataSeries.length,
          xrpReserve: priceDataSeries.length <= 5 ? 1 : 2,
          ledgerIndex: response.result.ledger_index,
          fee: response.result.Fee,
          result: response.result
        };
      } else {
        throw new Error(`Transaction failed: ${response.result.meta.TransactionResult}`);
      }
      
    } catch (error) {
      console.error("❌ Failed to submit OracleSet transaction:", error);
      throw error;
    }

  } catch (error) {
    console.error(`❌ Error in oracleSetMultiAsset:`, error.message);
    throw error;
  }
};
