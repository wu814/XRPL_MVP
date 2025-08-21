import { connectXRPLClient, client } from "../testnet";
import {
  dropsToXrp,
  NFTokenMint,
  NFTokenCreateOffer,
  NFTokenAcceptOffer,
} from "xrpl";
import { Wallet } from "xrpl";
import {
  isTypedTransactionSuccessful,
  handleTransactionError,
} from "@/utils/xrpl/errorHandler";
import {
  NFTMintAndListResult,
  NFTMintResult,
  NFTSellOfferResult,
  NFTPurchaseResult,
} from "@/types/xrpl/nftXRPLTypes";

/**
 * Automated workflow: Mint NFT and immediately list on DEX for USD (Business Wallet preferred)
 * @param uri - Metadata URI for the NFT
 * @param priceUSD - Price in USD for the DEX listing (e.g., "10" for $10)
 * @param destination - Optional destination wallet to lock the offer
 * @param taxon - NFT Taxon (defaults to RECEIPT_TAXON)
 * @returns Result object with both NFT and offer details
 */

const RECEIPT_TAXON = 1001; // Constant taxon for all receipt NFTs
const NFT_FLAGS = {
  tfBurnable: 0x00000001, // NFT can be burned
  tfOnlyXRP: 0x00000002, // Only allow XRP for offers
  tfTrustLine: 0x00000004, // Allow trustline holders
  tfTransferable: 0x00000008, // NFT is transferable
};

interface NFTokenOffer {
  NFTokenID: string;
  Amount:
    | {
        currency: string;
        value: string;
        issuer: string;
      }
    | string;
  LedgerEntryType: string;
}

interface LedgerEntryResponse {
  result: {
    node?: NFTokenOffer;
    ledger_index?: number;
  };
}

/**
 * Helper function to extract NFTokenID from transaction metadata
 * @param meta - Transaction metadata
 * @returns NFTokenID if found
 */
const extractNFTokenID = (meta: any): string | null => {
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
      if (
        node.ModifiedNode &&
        node.ModifiedNode.LedgerEntryType === "NFTokenPage"
      ) {
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
 * @param minterWallet - Wallet to mint the NFT
 * @param uri - Metadata URI (e.g., "https://yourdomain.com/receipts/inv_8329.json")
 * @param taxon - NFT Taxon (defaults to RECEIPT_TAXON)
 * @returns Result object with NFTokenID on success
 */
const mintReceiptNFT = async (
  minterWallet: Wallet,
  uri: string,
  taxon: number = RECEIPT_TAXON,
): Promise<NFTMintResult> => {
  await connectXRPLClient();

  // Validate URI
  if (!uri || uri.length === 0) {
    throw new Error("URI is required for NFT minting");
  }

  // Convert URI to hex encoding
  const uriHex = Buffer.from(uri, "utf8").toString("hex").toUpperCase();
  console.log("🎫 URI Hex:", uriHex);

  // Create NFTokenMint transaction
  const mintTransaction: NFTokenMint = {
    TransactionType: "NFTokenMint",
    Account: minterWallet.classicAddress,
    URI: uriHex,
    Flags: NFT_FLAGS.tfBurnable | NFT_FLAGS.tfTransferable, // Allow burning and transferring
    NFTokenTaxon: taxon,
  };

  console.log(`📜 Submitting NFTokenMint transaction...`);
  console.log(`   🔗 URI (hex): ${uriHex}`);

  // Submit and wait for validation
  const result = await client.submitAndWait<NFTokenMint>(mintTransaction, {
    autofill: true,
    wallet: minterWallet,
  });

  console.log("✅ NFTokenMint Transaction Result:", result);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "mintReceiptNFT");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      },
    };
  }

  // Extract NFTokenID from transaction metadata
  const nftTokenID = extractNFTokenID(result.result.meta);

  if (nftTokenID) {
    console.log(`🎉 Receipt NFT minted successfully!`);
    console.log(`   🆔 NFTokenID: ${nftTokenID}`);
    console.log(`   📋 Transaction Hash: ${result.result.hash}`);

    return {
      success: true,
      nftTokenID: nftTokenID,
      transactionHash: result.result.hash,
      uri: uri,
      minterWallet: minterWallet.classicAddress,
    };
  } else {
    return {
      success: false,
      error: {
        code: "NFTokenID_NOT_FOUND",
        message: "NFTokenID not found in transaction metadata",
      },
    };
  }
};

/**
 * Helper function to extract offer ID from transaction metadata
 * @param meta - Transaction metadata
 * @returns Offer ID if found
 */
const extractOfferID = (meta: any): string | null => {
  if (meta.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if (
        node.CreatedNode &&
        node.CreatedNode.LedgerEntryType === "NFTokenOffer"
      ) {
        return node.CreatedNode.LedgerIndex;
      }
    }
  }
  return null;
};

/**
 * Create a DEX sell offer for NFT priced in USD (Business Wallet's preferred currency)
 * @param businessWallet - Business wallet creating the offer
 * @param issuerWalletAddress - USD issuer wallet address
 * @param nftTokenID - The NFToken ID to create a sell offer for
 * @param priceUSD - Price in USD (e.g., 10 for $10 USD)
 * @param destination - Optional destination wallet (User Wallet address)
 * @returns Result object with offer details
 */
export async function createNFTSellOfferUSD(
  businessWallet: Wallet,
  issuerWalletAddress: string,
  nftTokenID: string,
  priceUSD: string | number,
  destination: string | null = null,
): Promise<NFTSellOfferResult> {
  await connectXRPLClient();

  // Validate and sanitize price input
  let validPriceUSD = priceUSD;
  if (
    !priceUSD ||
    priceUSD.toString().trim() === "" ||
    isNaN(parseFloat(priceUSD.toString()))
  ) {
    validPriceUSD = "10"; // Default to $10 USD if no valid price provided
    console.log(
      `⚠️ Invalid or empty price provided, using default: $${validPriceUSD} USD`,
    );
  }

  const parsedPrice = parseFloat(validPriceUSD.toString());
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
  const createOfferTransaction: NFTokenCreateOffer = {
    TransactionType: "NFTokenCreateOffer",
    Account: businessWallet.classicAddress,
    NFTokenID: nftTokenID,
    Amount: {
      currency: "USD",
      value: validPriceUSD.toString(),
      issuer: issuerWalletAddress,
    },
    Flags: 1, // tfSellNFToken flag (this is a sell offer)
  };

  // Add destination if specified (locks offer to specific wallet)
  if (destination) {
    createOfferTransaction.Destination = destination;
  }

  console.log(`📜 Submitting NFTokenCreateOffer transaction...`);
  console.log(`   💵 Price: $${validPriceUSD} USD (${issuerWalletAddress})`);

  // Submit and wait for validation
  const result = await client.submitAndWait<NFTokenCreateOffer>(
    createOfferTransaction,
    {
      autofill: true,
      wallet: businessWallet,
    },
  );

  console.log("✅ NFTokenCreateOffer Transaction Result:", result);

  if (!isTypedTransactionSuccessful(result)) {
    const errorInfo = handleTransactionError(result, "createNFTSellOfferUSD");
    return {
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
      },
    };
  }
  // Extract offer ID from transaction metadata
  const offerID = extractOfferID(result.result.meta);

  console.log(`🎉 NFT sell offer created successfully on DEX!`);
  console.log(`   🆔 Offer ID: ${offerID}`);
  console.log(`   📋 Transaction Hash: ${result.result.hash}`);

  return {
    success: true,
    offerID: offerID,
  };
}

export async function mintAndListNFTUSD(
  minterWallet: Wallet,
  issuerWalletAddress: string,
  uri: string,
  priceUSD: string | number,
  destination: string | null = null,
  taxon: number = RECEIPT_TAXON,
): Promise<NFTMintAndListResult> {
  console.log(`🚀 Starting automated NFT mint & DEX listing workflow (USD)...`);
  console.log(`   📄 URI: ${uri}`);
  console.log(`   💵 DEX Price: $${priceUSD} USD`);
  if (destination) {
    console.log(`   👤 Locked to: ${destination}`);
  }

  // Step 1: Mint the NFT
  console.log(`\n🎫 Step 1: Minting NFT...`);
  const mintResult = await mintReceiptNFT(minterWallet, uri, taxon);

  if (!mintResult.success) {
    return {
      success: false,
      message: `NFT minting failed: ${mintResult.error?.message}`,
      error: mintResult.error,
    };
  }

  console.log(`✅ NFT minted successfully!`);
  console.log(`   🆔 NFT Token ID: ${mintResult.nftTokenID}`);

  // Small delay to ensure transaction is fully processed
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 2: Create sell offer on DEX for USD
  console.log(`\n💵 Step 2: Creating USD sell offer on DEX...`);
  const sellResult = await createNFTSellOfferUSD(
    minterWallet,
    issuerWalletAddress,
    mintResult.nftTokenID!,
    priceUSD,
    destination,
  );

  if (!sellResult.success) {
    console.log(`⚠️ NFT minted but sell offer failed: ${sellResult.error}`);
    return {
      success: false,
      message: "NFT minted successfully but DEX listing failed",
      error: sellResult.error,
    };
  }

  console.log(`✅ Sell offer created successfully!`);
  console.log(`   🆔 Offer ID: ${sellResult.offerID}`);

  // Return complete workflow result
  return {
    success: true,
    message: `✅ NFT minted and listed successfully!\n\n🎫 NFT ID: ${mintResult.nftTokenID}\n💰 Listed for: $${priceUSD} USD\n🆔 Offer ID: ${sellResult.offerID}`,
  };
}

/**
 * Purchase NFT with User Wallet using smart currency conversion
 * @param issuerWalletAddress - USD issuer wallet address
 * @param offerID - The offer ID to accept
 * @param paymentCurrency - Currency to pay with (e.g., "EUR", "USD", "XRP")
 * @param purchaserWallet - Wallet used for the purchase
 * @returns Result object with purchase details
 */
export async function purchaseNFTWithSmartTrade(
  issuerWalletAddress: string,
  offerID: string,
  paymentCurrency: string,
  purchaserXRPLWallet: Wallet,
): Promise<NFTPurchaseResult> {
  await connectXRPLClient();

  console.log(`🛒 Smart NFT Purchase with User Wallet...`);
  console.log(`   🆔 Offer ID: ${offerID}`);
  console.log(`   👤 Buyer: ${purchaserXRPLWallet.classicAddress}`);
  console.log(`   💰 Preferred Payment Currency: ${paymentCurrency}`);

  // Step 1: Identify NFT currency and required amount
  console.log(`🔍 Step 1: Identifying NFT currency and required amount...`);
  let requiredAmount: number | null = null;
  let nftCurrency: string | null = null;
  let nftTokenID: string | null = null;

  console.log(`🔍 Querying NFT sell offer details for ${offerID}...`);

  // Method 1: Query the offer directly by its ledger index
  const offerResponse = (await client.request({
    command: "ledger_entry" as const,
    index: offerID,
    ledger_index: "validated",
  })) as LedgerEntryResponse;

  if (
    offerResponse.result.node &&
    (offerResponse.result.node as any).LedgerEntryType === "NFTokenOffer"
  ) {
    const offer = offerResponse.result.node as any;
    nftTokenID = offer.NFTokenID;

    if (typeof offer.Amount === "object") {
      // IOU currency (USD, EUR, BTC, etc.)
      requiredAmount = parseFloat(offer.Amount.value);
      nftCurrency = offer.Amount.currency;
      console.log(
        `💰 ✅ NFT offer found! Requires exactly: ${requiredAmount} ${nftCurrency}`,
      );
      console.log(`   🎫 NFT ID: ${nftTokenID}`);
      console.log(`   🆔 Offer ID: ${offerID}`);
    } else if (typeof offer.Amount === "string") {
      // XRP currency
      requiredAmount = dropsToXrp(offer.Amount as string);
      nftCurrency = "XRP";
      console.log(
        `💰 ✅ NFT offer found! Requires exactly: ${requiredAmount} ${nftCurrency}`,
      );
      console.log(`   🎫 NFT ID: ${nftTokenID}`);
      console.log(`   🆔 Offer ID: ${offerID}`);
    } else {
      throw new Error("NFT offer has invalid amount format");
    }
  } else {
    throw new Error("NFT offer not found or invalid");
  }

  // Step 2: Handle direct payment (no conversion needed)
  if (paymentCurrency.toUpperCase() === nftCurrency!.toUpperCase()) {
    console.log(`💰 Direct ${nftCurrency} payment (no conversion needed)...`);

    const acceptOfferTransaction: NFTokenAcceptOffer = {
      TransactionType: "NFTokenAcceptOffer",
      Account: purchaserXRPLWallet.classicAddress,
      NFTokenSellOffer: offerID,
    };

    console.log(`📜 Submitting NFTokenAcceptOffer transaction...`);

    const result = await client.submitAndWait<NFTokenAcceptOffer>(
      acceptOfferTransaction,
      {
        autofill: true,
        wallet: purchaserXRPLWallet,
      },
    );

    if (!isTypedTransactionSuccessful(result)) {
      const errorInfo = handleTransactionError(
        result,
        "purchaseNFTWithSmartTrade",
      );
      return {
        success: false,
        message: `NFT purchase failed: ${errorInfo.message}`,
        error: errorInfo,
      };
    }

    console.log(`🎉 NFT purchased successfully with ${nftCurrency}!`);
    console.log(`   📋 Transaction Hash: ${result.result.hash}`);

    return {
      success: true,
      message: `🎉 NFT purchased successfully!\n\n🎫 NFT ID: ${nftTokenID}\n💰 Paid: ${requiredAmount} ${nftCurrency}\n📋 Transaction: ${result.result.hash}`,
    };
  }

  // Step 3: Convert payment currency to NFT currency using existing sendCrossCurrency
  console.log(
    `💱 Step 3: Converting ${paymentCurrency} → ${nftCurrency} using existing sendCrossCurrency`,
  );

  const { sendCrossCurrency } = require("../transaction/sendCrossCurrency");

  // Use existing sendCrossCurrency for the conversion (personal swap to same wallet)
  const conversionResult = await sendCrossCurrency(
    purchaserXRPLWallet,
    purchaserXRPLWallet.classicAddress, // Send to self (personal swap)
    paymentCurrency,
    null, // Let it calculate the amount needed
    nftCurrency, // NFT currency (could be USD, BTC, EUR, etc.)
    issuerWalletAddress,
    0, // 0% slippage - same as smart trade option 6
    null, // no destination tag
    "exact_output", // Get exactly the amount needed
    requiredAmount.toString(), // Exactly what the NFT costs
  );

  if (!conversionResult.success) {
    return {
      success: false,
      message: `Currency conversion failed: ${conversionResult.error?.message}`,
      error: conversionResult.error,
    };
  }

  console.log(`✅ Currency conversion completed!`);

  // Step 4: Purchase NFT with converted currency (SEPARATE TRANSACTION)
  console.log(`🎫 Step 4: Purchasing NFT with converted ${nftCurrency}...`);

  // TRANSACTION 2: Accept NFT offer
  const acceptOfferTransaction: NFTokenAcceptOffer = {
    TransactionType: "NFTokenAcceptOffer",
    Account: purchaserXRPLWallet.classicAddress,
    NFTokenSellOffer: offerID,
  };

  console.log(`📜 Submitting NFTokenAcceptOffer transaction...`);

  const nftResponse = await client.submitAndWait<NFTokenAcceptOffer>(
    acceptOfferTransaction,
    {
      autofill: true,
      wallet: purchaserXRPLWallet,
    },
  );

  if (!isTypedTransactionSuccessful(nftResponse)) {
    const errorInfo = handleTransactionError(
      nftResponse,
      "purchaseNFTWithSmartTrade",
    );
    return {
      success: false,
      message: `NFT purchase failed: ${errorInfo.message}`,
      error: errorInfo,
    };
  }

  console.log(`🎉 NFT purchased successfully!`);

  return {
    success: true,
    message: `🎉 NFT purchased successfully!\n\n🎫 NFT ID: ${nftTokenID}\n💱 Converted: ${conversionResult.amountSent} → ${conversionResult.amountDelivered}\n📋 Purchase: ${nftResponse.result.hash}`,
  };
}
