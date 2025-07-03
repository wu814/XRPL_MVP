import { connectXrplClient, client } from '../testnet';
import * as xrpl from 'xrpl';

/**
 * Automated workflow: Mint NFT and immediately list on DEX for USD (Business Wallet preferred)
 * @param {string} uri - Metadata URI for the NFT
 * @param {number|string} priceUSD - Price in USD for the DEX listing (e.g., "10" for $10)
 * @param {string} destination - Optional destination wallet to lock the offer
 * @param {number} taxon - NFT Taxon (defaults to RECEIPT_TAXON)
 * @returns {Promise<Object>} Result object with both NFT and offer details
 */

const RECEIPT_TAXON = 1001; // Constant taxon for all receipt NFTs
const NFT_FLAGS = {
  tfBurnable: 0x00000001,      // NFT can be burned
  tfOnlyXRP: 0x00000002,       // Only allow XRP for offers
  tfTrustLine: 0x00000004,     // Allow trustline holders
  tfTransferable: 0x00000008   // NFT is transferable
};


/**
 * Helper function to extract NFTokenID from transaction metadata
 * @param {Object} meta - Transaction metadata
 * @returns {string|null} NFTokenID if found
 */
const extractNFTokenID = (meta) => {
  // First check the direct nftoken_id field (XRPL 2.0+ format)
  if (meta.nftoken_id) {
    return meta.nftoken_id;
  }
  
  // Fallback to AffectedNodes structure (older format)
  if (meta.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFToken") {
        return node.CreatedNode.NewFields.NFTokenID;
      }
      // Also check ModifiedNode for NFTokenPage updates
      if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "NFTokenPage") {
        const finalFields = node.ModifiedNode.FinalFields;
        const previousFields = node.ModifiedNode.PreviousFields;
        if (finalFields && finalFields.NFTokens) {
          // Find the newly added NFToken
          const prevTokens = previousFields?.NFTokens || [];
          const newTokens = finalFields.NFTokens || [];
          if (newTokens.length > prevTokens.length) {
            // Return the newest NFToken ID
            return newTokens[newTokens.length - 1].NFToken;
          }
        }
      }
    }
  }
  return null;
};


/**
 * Mint a Receipt NFT for a completed payment using Business Wallet
 * @param {string} uri - Metadata URI (e.g., "https://yourdomain.com/receipts/inv_8329.json")
 * @param {number} taxon - NFT Taxon (defaults to RECEIPT_TAXON)
 * @returns {Promise<Object>} Result object with NFTokenID on success
 */
const mintReceiptNFT = async (businessWalletSeed, uri, taxon = RECEIPT_TAXON) => {
  try {
    await connectXrplClient();
    
    // Load Business Wallet for minting
    const minterWallet = xrpl.Wallet.fromSeed(businessWalletSeed);
    
    console.log(`🎫 Minting receipt NFT with Business Wallet...`);
    console.log(`   📄 URI: ${uri}`);
    console.log(`   🏪 Minter: ${minterWallet.classicAddress}`);
    console.log(`   🏷️ Taxon: ${taxon}`);
    
    // Validate URI
    if (!uri || uri.length === 0) {
      throw new Error("URI is required for NFT minting");
    }
    
    // Convert URI to hex encoding
    const uriHex = Buffer.from(uri, 'utf8').toString('hex').toUpperCase();
    console.log("🎫 URI Hex:", uriHex);
    
    // Create NFTokenMint transaction
    const mintTransaction = {
      TransactionType: "NFTokenMint",
      Account: minterWallet.classicAddress,
      URI: uriHex,
      Flags: NFT_FLAGS.tfBurnable | NFT_FLAGS.tfTransferable, // Allow burning and transferring
      NFTokenTaxon: taxon
    };
    
    console.log(`📜 Submitting NFTokenMint transaction...`);
    console.log(`   🔗 URI (hex): ${uriHex}`);
    
    // Submit and wait for validation
    const response = await client.submitAndWait(mintTransaction, { 
      autofill: true, 
      wallet: minterWallet 
    });
    
    console.log("✅ NFTokenMint Transaction Result:", response);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      // Extract NFTokenID from transaction metadata
      const nftTokenID = extractNFTokenID(response.result.meta);
      
      if (nftTokenID) {
        console.log(`🎉 Receipt NFT minted successfully!`);
        console.log(`   🆔 NFTokenID: ${nftTokenID}`);
        console.log(`   📋 Transaction Hash: ${response.result.hash}`);
        
        return {
          success: true,
          nftTokenID: nftTokenID,
          transactionHash: response.result.hash,
          uri: uri,
          uriHex: uriHex,
          taxon: taxon,
          minter: minterWallet.classicAddress,
          ledgerIndex: response.result.ledger_index,
          businessWallet: minterWallet.classicAddress
        };
      } else {
        throw new Error("NFTokenID not found in transaction metadata");
      }
      
    } else {
      throw new Error(`Transaction failed: ${response.result.meta.TransactionResult}`);
    }
    
  } catch (error) {
    console.error(`❌ Error minting receipt NFT:`, error.message);
    return {
      success: false,
      error: error.message,
      uri: uri
    };
  }
};


/**
 * Helper function to extract offer ID from transaction metadata
 * @param {Object} meta - Transaction metadata
 * @returns {string|null} Offer ID if found
 */
const extractOfferID = (meta) => {
  if (meta.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFTokenOffer") {
        return node.CreatedNode.LedgerIndex;
      }
    }
  }
  return null;
};



/**
 * Create a DEX sell offer for NFT priced in USD (Business Wallet's preferred currency)
 * @param {string} nftTokenID - The NFToken ID to create a sell offer for
 * @param {number|string} priceUSD - Price in USD (e.g., 10 for $10 USD)
 * @param {string} destination - Optional destination wallet (User Wallet address)
 * @returns {Promise<Object>} Result object with offer details
 */
export async function createNFTSellOfferUSD(businessWalletSeed, issuerWalletAddress, nftTokenID, priceUSD, destination = null) {
  try {
    await connectXrplClient();
    
    // Load Business Wallet for creating offers
    const businessWallet = xrpl.Wallet.fromSeed(businessWalletSeed);

    
    // Validate and sanitize price input
    let validPriceUSD = priceUSD;
    if (!priceUSD || priceUSD.toString().trim() === "" || isNaN(parseFloat(priceUSD))) {
      validPriceUSD = "10"; // Default to $10 USD if no valid price provided
      console.log(`⚠️ Invalid or empty price provided, using default: $${validPriceUSD} USD`);
    }
    
    const parsedPrice = parseFloat(validPriceUSD);
    if (parsedPrice <= 0) {
      throw new Error("Price must be greater than $0 USD");
    }
    
    console.log(`💰 Creating NFT sell offer on DEX (USD)...`);
    console.log(`   🆔 NFTokenID: ${nftTokenID}`);
    console.log(`   🏢 Seller: ${businessWallet.classicAddress}`);
    console.log(`   💵 Price: $${validPriceUSD} USD`);
    console.log(`   🏛️ USD Issuer: ${issuerWalletAddress}`);
    if (destination) {
      console.log(`   👤 Destination: ${destination}`);
    }
    
    // Create NFTokenCreateOffer transaction (sell offer for USD)
    const createOfferTransaction = {
      TransactionType: "NFTokenCreateOffer",
      Account: businessWallet.classicAddress,
      NFTokenID: nftTokenID,
      Amount: {
        currency: "USD",
        value: validPriceUSD.toString(),
        issuer: issuerWalletAddress
      },
      Flags: 1 // tfSellNFToken flag (this is a sell offer)
    };
    
    // Add destination if specified (locks offer to specific wallet)
    if (destination) {
      createOfferTransaction.Destination = destination;
    }
    
    console.log(`📜 Submitting NFTokenCreateOffer transaction...`);
    console.log(`   💵 Price: $${validPriceUSD} USD (${issuerWalletAddress})`);
    
    // Submit and wait for validation
    const response = await client.submitAndWait(createOfferTransaction, { 
      autofill: true, 
      wallet: businessWallet 
    });
    
    console.log("✅ NFTokenCreateOffer Transaction Result:", response);
    
    if (response.result.meta.TransactionResult === "tesSUCCESS") {
      // Extract offer ID from transaction metadata
      const offerID = extractOfferID(response.result.meta);
      
      console.log(`🎉 NFT sell offer created successfully on DEX!`);
      console.log(`   🆔 Offer ID: ${offerID}`);
      console.log(`   📋 Transaction Hash: ${response.result.hash}`);
      
      return {
        success: true,
        offerID: offerID,
        nftTokenID: nftTokenID,
        transactionHash: response.result.hash,
        seller: businessWallet.classicAddress,
        destination: destination,
        price: validPriceUSD,
        currency: "USD",
        issuer: issuerWalletAddress,
        ledgerIndex: response.result.ledger_index,
        offerType: "sell"
      };
      
    } else {
      throw new Error(`Transaction failed: ${response.result.meta.TransactionResult}`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating NFT sell offer:`, error.message);
    return {
      success: false,
      error: error.message,
      nftTokenID: nftTokenID
    };
  }
};



export async function mintAndListNFTUSD(businessWalletSeed, issuerWalletAddress, uri, priceUSD, destination = null, taxon = RECEIPT_TAXON) {
  console.log(`🚀 Starting automated NFT mint & DEX listing workflow (USD)...`);
  console.log(`   📄 URI: ${uri}`);
  console.log(`   💵 DEX Price: $${priceUSD} USD`);
  if (destination) {
    console.log(`   👤 Locked to: ${destination}`);
  }
  
  try {
    // Step 1: Mint the NFT
    console.log(`\n🎫 Step 1: Minting NFT...`);
    const mintResult = await mintReceiptNFT(businessWalletSeed, uri, taxon);
    
    if (!mintResult.success) {
      throw new Error(`NFT minting failed: ${mintResult.error}`);
    }
    
    console.log(`✅ NFT minted successfully!`);
    console.log(`   🆔 NFT Token ID: ${mintResult.nftTokenID}`);
    
    // Small delay to ensure transaction is fully processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Create sell offer on DEX for USD
    console.log(`\n💵 Step 2: Creating USD sell offer on DEX...`);
    const sellResult = await createNFTSellOfferUSD(businessWalletSeed, issuerWalletAddress, mintResult.nftTokenID, priceUSD, destination);
    
    if (!sellResult.success) {
      console.log(`⚠️ NFT minted but sell offer failed: ${sellResult.error}`);
      return {
        success: true,
        workflow: "partial",
        nft: mintResult,
        sellOffer: sellResult,
        message: "NFT minted successfully but DEX listing failed"
      };
    }
    
    console.log(`✅ Sell offer created successfully!`);
    console.log(`   🆔 Offer ID: ${sellResult.offerID}`);
    
    // Return complete workflow result
    return {
      success: true,
      workflow: "complete",
      message: `✅ NFT minted and listed successfully!\n\n🎫 NFT ID: ${mintResult.nftTokenID}\n💰 Listed for: $${priceUSD} USD\n🆔 Offer ID: ${sellResult.offerID}`,
      nft: {
        nftTokenID: mintResult.nftTokenID,
        transactionHash: mintResult.transactionHash,
        uri: mintResult.uri,
        minter: mintResult.businessWallet
      },
      sellOffer: {
        offerID: sellResult.offerID,
        price: sellResult.price,
        currency: sellResult.currency,
        issuer: sellResult.issuer,
        transactionHash: sellResult.transactionHash,
        seller: sellResult.seller,
        destination: sellResult.destination
      },
      summary: {
        nftTokenID: mintResult.nftTokenID,
        offerID: sellResult.offerID,
        price: `$${priceUSD} USD`,
        businessWallet: mintResult.businessWallet,
        uri: uri,
        readyForPurchase: true
      }
    };
    
  } catch (error) {
    console.error(`❌ Automated workflow failed:`, error.message);
    return {
      success: false,
      workflow: "failed",
      message: `❌ NFT workflow failed: ${error.message}`,
      error: error.message,
      uri: uri,
      priceUSD: priceUSD
    };
  }
};


/**
 * Purchase NFT with User Wallet using smart currency conversion
 * @param {string} offerID - The offer ID to accept
 * @param {string} paymentCurrency - Currency to pay with (e.g., "EUR", "USD", "XRP")
 * @param {string} userWalletType - Wallet type ("userWallet" or specific user wallet)
 * @returns {Promise<Object>} Result object with purchase details
 */
export async function purchaseNFTWithSmartTrade(issuerWalletAddress, offerID, paymentCurrency, userWalletSeed) {
  try {
    await connectXrplClient();
    
    // Load User Wallet for purchasing
    const userWallet = xrpl.Wallet.fromSeed(userWalletSeed);
    if (!userWallet) {
      throw new Error(`payment walletnot found. Please create it first.`);
    }
    
    
    console.log(`🛒 Smart NFT Purchase with User Wallet...`);
    console.log(`   🆔 Offer ID: ${offerID}`);
    console.log(`   👤 Buyer: ${userWallet.classicAddress}`);
    console.log(`   💰 Preferred Payment Currency: ${paymentCurrency}`);
    
    // Step 1: Identify NFT currency and required amount
    console.log(`🔍 Step 1: Identifying NFT currency and required amount...`);
    let requiredAmount = null;
    let nftCurrency = null;
    let nftTokenID = null;
    
    console.log(`🔍 Querying NFT sell offer details for ${offerID}...`);
    
    try {
      // Method 1: Query the offer directly by its ledger index
      const offerResponse = await client.request({
        command: "ledger_entry",
        index: offerID,
        ledger_index: "validated"
      });
      
      if (offerResponse.result.node && offerResponse.result.node.LedgerEntryType === "NFTokenOffer") {
        const offer = offerResponse.result.node;
        nftTokenID = offer.NFTokenID;
        
        if (typeof offer.Amount === 'object') {
          // IOU currency (USD, EUR, BTC, etc.)
          requiredAmount = parseFloat(offer.Amount.value);
          nftCurrency = offer.Amount.currency;
          console.log(`💰 ✅ NFT offer found! Requires exactly: ${requiredAmount} ${nftCurrency}`);
          console.log(`   🎫 NFT ID: ${nftTokenID}`);
          console.log(`   🆔 Offer ID: ${offerID}`);
        } else if (typeof offer.Amount === 'string') {
          // XRP currency
          requiredAmount = parseFloat(xrpl.dropsToXrp(offer.Amount));
          nftCurrency = "XRP";
          console.log(`💰 ✅ NFT offer found! Requires exactly: ${requiredAmount} ${nftCurrency}`);
          console.log(`   🎫 NFT ID: ${nftTokenID}`);
          console.log(`   🆔 Offer ID: ${offerID}`);
        } else {
          throw new Error("NFT offer has invalid amount format");
        }
      } else {
        throw new Error("NFT offer not found or invalid");
      }
      
    } catch (nftOfferError) {
      console.log(`⚠️ NFT offer query failed: ${nftOfferError.message}`);
      throw new Error(`Offer ${offerID} not found. Please check the offer ID is correct and still active.`);
    }
    
    // Step 2: Handle direct payment (no conversion needed)
    if (paymentCurrency.toUpperCase() === nftCurrency.toUpperCase()) {
      console.log(`💰 Direct ${nftCurrency} payment (no conversion needed)...`);
      
      const acceptOfferTransaction = {
        TransactionType: "NFTokenAcceptOffer",
        Account: userWallet.classicAddress,
        NFTokenSellOffer: offerID
      };
      
      console.log(`📜 Submitting NFTokenAcceptOffer transaction...`);
      
      const response = await client.submitAndWait(acceptOfferTransaction, { 
        autofill: true, 
        wallet: userWallet 
      });
      
      if (response.result.meta.TransactionResult === "tesSUCCESS") {
        console.log(`🎉 NFT purchased successfully with ${nftCurrency}!`);
        console.log(`   📋 Transaction Hash: ${response.result.hash}`);
        
        return {
          success: true,
          message: `🎉 NFT purchased successfully!\n\n🎫 NFT ID: ${nftTokenID}\n💰 Paid: ${requiredAmount} ${nftCurrency}\n📋 Transaction: ${response.result.hash}`,
          transactionHash: response.result.hash,
          buyer: userWallet.classicAddress,
          offerID: offerID,
          paymentCurrency: nftCurrency,
          conversionUsed: false,
          ledgerIndex: response.result.ledger_index
        };
      } else {
        throw new Error(`Transaction failed: ${response.result.meta.TransactionResult}`);
      }
    }
    
    // Step 3: Convert payment currency to NFT currency using existing sendCrossCurrency
    console.log(`💱 Step 3: Converting ${paymentCurrency} → ${nftCurrency} using existing sendCrossCurrency`);
    
    const { sendCrossCurrency } = require('../transaction/sendCrossCurrency');
    
    // Use existing sendCrossCurrency for the conversion (personal swap to same wallet)
    const conversionResult = await sendCrossCurrency(
      userWallet,
      userWallet.classicAddress, // Send to self (personal swap)
      paymentCurrency,
      null, // Let it calculate the amount needed
      nftCurrency, // NFT currency (could be USD, BTC, EUR, etc.)
      issuerWalletAddress,
      0, // 0% slippage - same as smart trade option 6
      null, // no destination tag
      "exact_output", // Get exactly the amount needed
      requiredAmount.toString() // Exactly what the NFT costs
    );
    
    if (!conversionResult.success) {
      throw new Error(`Currency conversion failed: ${conversionResult.error}`);
    }
      
    console.log(`✅ Currency conversion completed!`);
    console.log(`   📋 Transaction Hash: ${conversionResult.txHash}`);
    console.log(`   💰 Amount Sent: ${conversionResult.amountSent}`);
    console.log(`   💵 Amount Delivered: ${Number(conversionResult.amountDelivered).toFixed(2)}`);
      
    const conversionHash = conversionResult.txHash;
    
    // Step 4: Purchase NFT with converted currency (SEPARATE TRANSACTION)
    console.log(`🎫 Step 4: Purchasing NFT with converted ${nftCurrency}...`);
    
    // TRANSACTION 2: Accept NFT offer
    const acceptOfferTransaction = {
      TransactionType: "NFTokenAcceptOffer",
      Account: userWallet.classicAddress,
      NFTokenSellOffer: offerID
    };
    
    console.log(`📜 Submitting NFTokenAcceptOffer transaction...`);
    
    const nftResponse = await client.submitAndWait(acceptOfferTransaction, { 
      autofill: true, 
      wallet: userWallet 
    });
    
    if (nftResponse.result.meta.TransactionResult === "tesSUCCESS") {
      console.log(`🎉 NFT purchased successfully!`);
      console.log(`   🎯 Business received: ${requiredAmount} ${nftCurrency}`);
      console.log(`   💰 User paid: ${conversionResult.amountSent}`);
      console.log(`   📋 NFT Purchase Hash: ${nftResponse.result.hash}`);
      console.log(`   💱 Conversion Hash: ${conversionHash}`);
      
      return {
        success: true,
        message: `🎉 NFT purchased successfully!\n\n🎫 NFT ID: ${nftTokenID}\n💱 Converted: ${conversionResult.amountSent} → ${conversionResult.amountDelivered}\n📋 Purchase: ${nftResponse.result.hash}\n🔄 Conversion: ${conversionHash}`,
        nftTransactionHash: nftResponse.result.hash,
        conversionTransactionHash: conversionHash,
        buyer: userWallet.classicAddress,
        offerID: offerID,
        paymentCurrency: paymentCurrency,
        nftCurrency: nftCurrency,
        conversionUsed: true,
        amounts: {
          required: requiredAmount,
          requiredCurrency: nftCurrency,
          requiredUSD: requiredAmount, // Legacy compatibility
          amountSent: conversionResult.amountSent,
          amountDelivered: conversionResult.amountDelivered,
          inputUsed: conversionResult.amountSent, // What index.js expects
          inputCurrency: paymentCurrency,
          excessUSD: 0 // No excess in exact output mode
        },
        ledgerIndex: nftResponse.result.ledger_index
      };
    } else {
      throw new Error(`NFT purchase failed: ${nftResponse.result.meta.TransactionResult}`);
    }
    
  } catch (error) {
    console.error(`❌ Error in smart NFT purchase:`, error.message);
    return {
      success: false,
      error: error.message,
      offerID: offerID,
      paymentCurrency: paymentCurrency
    };
  }
};
