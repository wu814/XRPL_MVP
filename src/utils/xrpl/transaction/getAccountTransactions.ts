import { client, connectXRPLClient } from "@/utils/xrpl/testnet";
import {
  AccountTxRequest,
  AccountTxResponse,
  AccountTxTransaction,
  dropsToXrp,
  Node,
  CreatedNode,
  ModifiedNode,
  DeletedNode,
  LedgerEntry,
  IssuedCurrencyAmount,
  Transaction,
  Amount,
  Payment,
  TrustSet,
  OfferCreate,
  OfferCancel,
  AMMCreate,
  AMMDeposit,
  AMMWithdraw,
  Clawback,
  NFTokenMint,
  NFTokenCreateOffer,
  NFTokenAcceptOffer,
  TransactionMetadata
} from "xrpl";

// Helper function to convert Amount to display string
function formatAmountAsString(amount: Amount): string | null {
  if (typeof amount === "string") {
    return `${dropsToXrp(amount)} XRP`;
  } else if (amount && typeof amount === "object") {
    const issuedAmount = amount as IssuedCurrencyAmount;
    return `${issuedAmount.value} ${issuedAmount.currency}`;
  }
  return null;
}

type NFTokenPage = LedgerEntry.NFTokenPage;
type NFTokenOffer = LedgerEntry.NFTokenOffer;

interface AssetAmount {
  currency: string;
  value: string;
}

interface ProcessedTransaction {
  hash: string;
  ledger_index: number | null;
  date: Date | null;
  type: string;
  direction: string;
  counterparty: string | null;
  amount: string | number | null;
  currency: string;
  fee: string | null;
  validated: boolean;
  result: string;
  raw: AccountTxTransaction;
}

interface GetAccountTransactionsParams {
  targetAddress?: string;
  limit?: number;
  marker?: string;
}

interface GetAccountTransactionsResponse {
  transactions: ProcessedTransaction[];
  marker: string | null;
  account: string;
  ledger_index_min?: number;
  ledger_index_max?: number;
  message?: string;
}

// Function to extract NFT Token ID from transaction metadata
function extractNFTTokenId(txData: AccountTxTransaction): string | null {
  const meta = txData.meta;
  if (!meta || typeof meta === "string") return null;

  // First, try to get the token ID directly from meta.nftoken_id (most efficient)
  if ('nftoken_id' in meta && meta.nftoken_id) {
    return meta.nftoken_id;
  }

  // Fallback to parsing AffectedNodes (for edge cases or older transaction formats)
  if (!meta.AffectedNodes) return null;

  for (const node of meta.AffectedNodes) {
    // Check CreatedNode for newly minted NFTs
    if ("CreatedNode" in node && node.CreatedNode.LedgerEntryType === "NFTokenPage") {
      const nftPage = node.CreatedNode;
      const tokens = nftPage.NewFields?.NFTokens as any[];
      if (tokens && tokens.length > 0) {
        return tokens[0].NFToken?.NFTokenID || null;
      }
    }
    
    // Check ModifiedNode for NFTs added to existing pages
    if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "NFTokenPage") {
      const nftPage = node.ModifiedNode;
      const finalTokens = nftPage.FinalFields?.NFTokens as any[];
      const prevTokens = nftPage.PreviousFields?.NFTokens as any[];
      
      if (finalTokens && prevTokens) {
        // Find the newly added token
        for (const token of finalTokens) {
          const tokenId = token.NFToken?.NFTokenID;
          if (
            tokenId &&
            !prevTokens.some(
              (prevToken: any) => prevToken.NFToken?.NFTokenID === tokenId,
            )
          ) {
            return tokenId;
          }
        }
      }
    }
  }
  return null;
}

// Type-safe transaction extraction
function getTypedTransaction(txData: AccountTxTransaction): {
  tx: Transaction;
  meta: TransactionMetadata;
} | null {
  const rawTx = txData.tx_json || txData.tx;
  const rawMeta = txData.meta;
  
  if (!rawTx || !rawMeta || typeof rawMeta === "string") return null;
  
  return {
    tx: rawTx as Transaction,
    meta: rawMeta as TransactionMetadata
  };
}

// Helper function to extract amount from NFTokenOffer node
function extractAmountFromNFTOfferNode(node: any): Amount | null {
  const fields = node.NewFields || node.FinalFields || node.PreviousFields;
  return fields?.Amount as Amount || null;
}

// Function to extract NFT offer price from transaction metadata
function extractNFTOfferPrice(txData: AccountTxTransaction, tx: NFTokenCreateOffer | NFTokenAcceptOffer): string | null {
  // First check if there's a direct Amount in the transaction
  if ('Amount' in tx && tx.Amount) {
    return formatAmountAsString(tx.Amount as Amount);
  }

  const typedTx = getTypedTransaction(txData);
  if (!typedTx) return null;

  const { meta } = typedTx;

  // Search through affected nodes for NFTokenOffer
  for (const node of meta.AffectedNodes || []) {
    if ("CreatedNode" in node && node.CreatedNode.LedgerEntryType === "NFTokenOffer") {
      const amount = extractAmountFromNFTOfferNode(node.CreatedNode);
      if (amount) return formatAmountAsString(amount);
    }
    
    if ("DeletedNode" in node && node.DeletedNode.LedgerEntryType === "NFTokenOffer") {
      const amount = extractAmountFromNFTOfferNode(node.DeletedNode);
      if (amount) return formatAmountAsString(amount);
    }
    
    if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "NFTokenOffer") {
      const amount = extractAmountFromNFTOfferNode(node.ModifiedNode);
      if (amount) return formatAmountAsString(amount);
    }
  }

  // For NFTokenAcceptOffer, try to find the specific offer by ID
  if (tx.TransactionType === "NFTokenAcceptOffer") {
    const acceptTx = tx as NFTokenAcceptOffer;
    const offerId = acceptTx.NFTokenSellOffer || acceptTx.NFTokenBuyOffer;
    
    if (offerId) {
      for (const node of meta.AffectedNodes || []) {
        if (
          "DeletedNode" in node &&
          node.DeletedNode.LedgerEntryType === "NFTokenOffer" &&
          node.DeletedNode.LedgerIndex === offerId
        ) {
          const amount = extractAmountFromNFTOfferNode(node.DeletedNode);
          if (amount) return formatAmountAsString(amount);
        }
      }
    }
  }

  return null;
}

// Helper function to process RippleState node for AMM operations
function processRippleStateNode(
  node: any, 
  senderAddress: string, 
  addedAssets: Set<string>,
  isDeposit: boolean = true
): AssetAmount | null {
  const { FinalFields, PreviousFields } = node;
  if (!FinalFields?.Balance || !PreviousFields?.Balance) return null;

  const finalBalance = FinalFields.Balance as IssuedCurrencyAmount;
  const prevBalance = PreviousFields.Balance as IssuedCurrencyAmount;
  
  // Skip LP tokens (40 character currency codes)
  if (finalBalance.currency?.length === 40) return null;

  const highAccount = (FinalFields as any).HighLimit?.issuer;
  const lowAccount = (FinalFields as any).LowLimit?.issuer;

  if (highAccount !== senderAddress && lowAccount !== senderAddress) return null;

  const issuer = lowAccount === senderAddress ? highAccount : lowAccount;
  const assetKey = `${finalBalance.currency}:${issuer}`;

  if (addedAssets.has(assetKey)) return null;

  const prevValue = parseFloat(prevBalance.value || "0");
  const finalValue = parseFloat(finalBalance.value || "0");
  const isFromSenderPerspective = lowAccount === senderAddress;

  const diff = isDeposit 
    ? (isFromSenderPerspective ? prevValue - finalValue : finalValue - prevValue)
    : (isFromSenderPerspective ? finalValue - prevValue : prevValue - finalValue);

  if (diff > 0.000001) {
    addedAssets.add(assetKey);
    return {
      currency: finalBalance.currency,
      value: diff.toFixed(6),
    };
  }

  return null;
}

// Helper function to process AccountRoot node for XRP operations
function processAccountRootNode(
  node: any,
  senderAddress: string,
  txData: AccountTxTransaction,
  addedAssets: Set<string>,
  isDeposit: boolean = true
): AssetAmount | null {
  if (node.FinalFields?.Account !== senderAddress) return null;

  const { FinalFields, PreviousFields } = node;
  if (!FinalFields?.Balance || !PreviousFields?.Balance) return null;

  const finalDrops = parseInt(FinalFields.Balance as string);
  const prevDrops = parseInt(PreviousFields.Balance as string);
  const fee = parseInt((txData.tx as any)?.Fee || "0");

  const xrpDiff = isDeposit 
    ? (prevDrops - finalDrops - fee) 
    : (finalDrops - prevDrops + fee);

  if (!addedAssets.has("XRP") && xrpDiff > 1000) {
    addedAssets.add("XRP");
    return {
      currency: "XRP",
      value: dropsToXrp(xrpDiff.toString()).toFixed(6),
    };
  }

  return null;
}

// Function to extract deposited amounts from AMM deposit transaction metadata
function extractAMMDepositAmounts(
  txData: AccountTxTransaction,
  senderAddress: string,
): string {
  const typedTx = getTypedTransaction(txData);
  if (!typedTx) return "Liquidity deposit";

  const { meta } = typedTx;
  const assetsDeposited: AssetAmount[] = [];
  const addedAssets = new Set<string>();

  for (const node of meta.AffectedNodes || []) {
    // Process token deposits (RippleState modifications)
    if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "RippleState") {
      const asset = processRippleStateNode(node.ModifiedNode, senderAddress, addedAssets, true);
      if (asset) assetsDeposited.push(asset);
    }
    // Process XRP deposits (AccountRoot modifications)
    else if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
      const asset = processAccountRootNode(node.ModifiedNode, senderAddress, txData, addedAssets, true);
      if (asset) assetsDeposited.push(asset);
    }
  }

  if (assetsDeposited.length === 0) return "Liquidity deposit";
  if (assetsDeposited.length === 1) {
    const asset = assetsDeposited[0];
    return `${asset.value} ${asset.currency}`;
  }
  return assetsDeposited
    .map((asset) => `${asset.value} ${asset.currency}`)
    .join(" + ");
}

// Function to extract withdrawn amounts from AMM withdraw transaction metadata
function extractAMMWithdrawAmounts(
  txData: AccountTxTransaction,
  senderAddress: string,
): string {
  const typedTx = getTypedTransaction(txData);
  if (!typedTx) return "Liquidity withdrawal";

  const { meta } = typedTx;
  const assetsWithdrawn: AssetAmount[] = [];
  const addedAssets = new Set<string>();

  for (const node of meta.AffectedNodes || []) {
    // Process token withdrawals (RippleState modifications)
    if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "RippleState") {
      const asset = processRippleStateNode(node.ModifiedNode, senderAddress, addedAssets, false);
      if (asset) assetsWithdrawn.push(asset);
    }
    // Process XRP withdrawals (AccountRoot modifications)
    else if ("ModifiedNode" in node && node.ModifiedNode.LedgerEntryType === "AccountRoot") {
      const asset = processAccountRootNode(node.ModifiedNode, senderAddress, txData, addedAssets, false);
      if (asset) assetsWithdrawn.push(asset);
    }
  }

  if (assetsWithdrawn.length === 0) return "Liquidity withdrawal";
  if (assetsWithdrawn.length === 1) {
    const asset = assetsWithdrawn[0];
    return `${asset.value} ${asset.currency}`;
  }
  return assetsWithdrawn
    .map((asset) => `${asset.value} ${asset.currency}`)
    .join(" + ");
}
// Type-safe transaction processors
function processPayment(tx: Payment, meta: TransactionMetadata, targetAddress: string) {
  const isSmartTrade = tx.Account === tx.Destination && tx.Account === targetAddress;

  if (isSmartTrade) {
    const sentAmount = tx.SendMax || tx.Amount;
    const receivedAmount = meta.DeliveredAmount || (meta as any).delivered_amount;
    
    const sentStr = formatAmountAsString(sentAmount as Amount);
    const receivedStr = formatAmountAsString(receivedAmount);
    
    let amount: string;
    if (sentStr && receivedStr) {
      amount = `${sentStr} → ${receivedStr}`;
    } else if (sentStr) {
      amount = `${sentStr} → ?`;
    } else if (receivedStr) {
      amount = `? → ${receivedStr}`;
    } else {
      amount = "Smart trade (no amounts found)";
    }

    return {
      direction: "smart_trade",
      counterparty: null,
      amount,
      currency: ""
    };
  } else {
    const direction = tx.Account === targetAddress ? "sent" : "received";
    const counterparty = direction === "sent" ? tx.Destination : tx.Account;
    
    const paymentAmount = tx.Amount || tx.DeliverMax || (meta as any)?.delivered_amount;
    const formatted = formatAmountAsString(paymentAmount);
    
    let amount: string | number;
    let currency: string;
    
    if (formatted) {
      if (typeof paymentAmount === "string") {
        amount = dropsToXrp(paymentAmount);
        currency = "XRP";
      } else {
        amount = (paymentAmount as IssuedCurrencyAmount).value;
        currency = (paymentAmount as IssuedCurrencyAmount).currency;
      }
    } else {
      amount = "Unknown amount";
      currency = "Unknown";
    }

    return { direction, counterparty, amount, currency };
  }
}

function processTrustSet(tx: TrustSet) {
  return {
    direction: "trustline_set",
    counterparty: tx.LimitAmount?.issuer || null,
    amount: tx.LimitAmount 
      ? `${tx.LimitAmount.value} ${tx.LimitAmount.currency}` 
      : "Remove trustline",
    currency: tx.LimitAmount?.currency || ""
  };
}

function processOfferCreate(tx: OfferCreate) {
  const gets = formatAmountAsString(tx.TakerGets);
  const pays = formatAmountAsString(tx.TakerPays);
  return {
    direction: "offer_create",
    counterparty: null,
    amount: `${gets} → ${pays}`,
    currency: ""
  };
}

function processOfferCancel(tx: OfferCancel) {
  return {
    direction: "offer_cancel",
    counterparty: null,
    amount: `Sequence: ${tx.OfferSequence}`,
    currency: ""
  };
}

function processNFTokenMint(tx: NFTokenMint, txData: AccountTxTransaction) {
  const tokenId = extractNFTTokenId(txData);
  const amount = tokenId 
    ? `Token ID: ${tokenId}` 
    : (tx.NFTokenTaxon ? `NFT #${tx.NFTokenTaxon}` : "NFT Minted");
  
  return {
    direction: "nft_mint",
    counterparty: null,
    amount,
    currency: ""
  };
}

function processNFTokenCreateOffer(tx: NFTokenCreateOffer, txData: AccountTxTransaction) {
  const offerPrice = extractNFTOfferPrice(txData, tx);
  return {
    direction: "nft_create_offer",
    counterparty: tx.Owner || tx.Destination || null,
    amount: offerPrice || "NFT Offer Created",
    currency: ""
  };
}

function processNFTokenAcceptOffer(tx: NFTokenAcceptOffer, txData: AccountTxTransaction) {
  const acceptPrice = extractNFTOfferPrice(txData, tx);
  return {
    direction: "nft_accept_offer",
    counterparty: tx.Account,
    amount: acceptPrice || "NFT Offer Accepted",
    currency: ""
  };
}

function processClawback(tx: Clawback) {
  return {
    direction: "clawback",
    counterparty: (tx.Amount as IssuedCurrencyAmount)?.issuer || null,
    amount: (tx.Amount as IssuedCurrencyAmount)?.value || "Clawback",
    currency: (tx.Amount as IssuedCurrencyAmount)?.currency || "Unknown"
  };
}

// Main function to get account transactions
export async function getAccountTransactions({
  targetAddress,
  limit = 50,
  marker,
}: GetAccountTransactionsParams): Promise<GetAccountTransactionsResponse> {
  if (!targetAddress) {
    throw new Error("Missing address or wallet");
  }

  await connectXRPLClient();

  const requestParams: AccountTxRequest = {
    command: "account_tx",
    account: targetAddress,
    binary: false,
    limit: Math.min(limit, 30),
    forward: false,
    ...(marker && { marker }),
  };

  const accountTx: AccountTxResponse = await client.request(requestParams);
  // Add this for better readability
  console.log("=== TRANSACTION DETAILS (Most Recent 10) ===");
  accountTx.result?.transactions?.slice(0, 5)
  .forEach((txData, index) => {
    console.log(`\n--- Transaction ${index + 1} ---`);
    console.log("TX:", JSON.stringify(txData.tx || txData, null, 2));
  });
  console.log("=== END TRANSACTION DETAILS ===");

  if (!accountTx.result?.transactions) {
    return {
      transactions: [],
      marker: null,
      account: targetAddress,
      message: "No transaction data available",
    };
  }

  // Process transactions
  const processedTransactions = accountTx.result.transactions
    .map((txData: AccountTxTransaction): ProcessedTransaction | null => {
      try {
        const typedTx = getTypedTransaction(txData);
        if (!typedTx) return null;

        const { tx, meta } = typedTx;
        
        // Convert timestamp
        let timestamp: Date | null = null;
        if ((tx as any).date) {
          timestamp = new Date((((tx as any).date as number) + 946684800) * 1000);
        } 
        
        // Calculate fee
        const fee = tx.Fee ? dropsToXrp(tx.Fee) : null;
        const transactionType = tx.TransactionType || "Unknown";

        let direction = "unknown";
        let counterparty: string | null = null;
        let amount: string | number | null = "N/A";
        let currency = "XRP";

        // Use type-safe processors
        switch (transactionType) {
          case "Payment": {
            const result = processPayment(tx as Payment, meta, targetAddress);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "TrustSet": {
            const result = processTrustSet(tx as TrustSet);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "OfferCreate": {
            const result = processOfferCreate(tx as OfferCreate);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "OfferCancel": {
            const result = processOfferCancel(tx as OfferCancel);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "AMMCreate":
            direction = "amm_create";
            amount = "AMM pool created";
            currency = "";
            break;
          case "AMMDeposit":
            direction = "amm_deposit";
            amount = extractAMMDepositAmounts(txData, targetAddress);
            currency = "";
            break;
          case "AMMWithdraw":
            direction = "amm_withdraw";
            amount = extractAMMWithdrawAmounts(txData, targetAddress);
            currency = "";
            break;
          case "Clawback": {
            const result = processClawback(tx as Clawback);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "NFTokenMint": {
            const result = processNFTokenMint(tx as NFTokenMint, txData);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "NFTokenCreateOffer": {
            const result = processNFTokenCreateOffer(tx as NFTokenCreateOffer, txData);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          case "NFTokenAcceptOffer": {
            const result = processNFTokenAcceptOffer(tx as NFTokenAcceptOffer, txData);
            ({ direction, counterparty, amount, currency } = result);
            break;
          }
          default:
            direction = transactionType.toLowerCase();
            amount = "N/A";
        }

        // Override display for smart trades
        let finalType = transactionType;
        let finalDirection = direction;

        if (direction === "smart_trade") {
          finalType = "Smart Trade";
          finalDirection = "smart_trade";
          currency = "";
        }

        return {
          hash: (tx as any).hash || (txData as any).hash || "unknown",
          ledger_index: (tx as any).ledger_index || (txData as any).ledger_index || null,
          date: timestamp,
          type: finalType,
          direction: finalDirection,
          counterparty,
          amount,
          currency,
          fee: fee?.toString() || null,
          validated: txData.validated !== false,
          result: (meta as any)?.TransactionResult || "unknown",
          raw: txData,
        };
      } catch (error) {
        console.warn(
          "Error processing transaction:",
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    })
    .filter((tx): tx is ProcessedTransaction => tx !== null);

  return {
    transactions: processedTransactions,
    marker: (accountTx.result.marker as string) || null,
    account: targetAddress!,
    ledger_index_min: accountTx.result.ledger_index_min,
    ledger_index_max: accountTx.result.ledger_index_max,
  };
}
