import { APIErrorResponse, GetTreasuryWalletAPIResponse } from "@/types/api/index";

// Types
export interface Currency {
  id: string;
  name: string;
  avatar: string;
}

export interface PriceInfo {
  baseAsset: string;
  price: number;
  available: boolean;
}

export interface CurrencyObject {
  currency: string;
  issuer?: string;
  value: string | number;
}

export interface PricesResponse {
  success: boolean;
  livePrices: PriceInfo[];
  error?: string;
}

export interface UseLivePricesReturn {
  livePrices: PriceInfo[];
  loading: boolean;
}

export const availableCurrencies: Currency[] = [
  { id: "USD", name: "USD", avatar: "/icons/USD.png" },
  { id: "XRP", name: "XRP", avatar: "/icons/XRP.png" },
  { id: "EUR", name: "Euro", avatar: "/icons/EUR.png" },
  { id: "BTC", name: "Bitcoin", avatar: "/icons/BTC.png" }, 
  { id: "ETH", name: "Ethereum", avatar: "/icons/ETH.png" },
  { id: "SOL", name: "Solana", avatar: "/icons/SOL.png" },
];

/**
 * Fetches USD prices for currencies using the oracle
 * @returns Array of price objects with baseAsset and price properties
 */
export async function fetchUSDPrices(): Promise<PriceInfo[]> {
  try {
    // Step 1: Get treasury wallet (oracle account)
    const treasuryResponse = await fetch("/api/wallet/getTreasuryWallet");
    if (!treasuryResponse.ok) {
      const errorData: APIErrorResponse = await treasuryResponse.json();
      console.error("Error fetching treasury wallet:", errorData.message);
      return [];
    }
    const treasuryResult: GetTreasuryWalletAPIResponse = await treasuryResponse.json();

    if (!treasuryResult.data) {
      console.error("No treasury wallet found");
      return [];
    }

    const treasuryWallet = treasuryResult.data;

    // Step 2: Get live prices from oracle
    const pricesResponse = await fetch("/api/oracle/getLivePrices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: treasuryWallet.classicAddress,
        oracleDocumentId: 1,
        ledgerIndex: "validated",
      }),
    });

    const pricesData: PricesResponse = await pricesResponse.json();

    if (pricesData.success) {
      return pricesData.livePrices;
    } else {
      console.error("Failed to fetch prices:", pricesData.error);
      return [];
    }
  } catch (error) {
    console.error("Error fetching USD prices:", error);
    return [];
  }
}

/**
 * Get USD value for a specific currency and amount
 * @param currency - The currency symbol (e.g., "XRP", "BTC", "ETH")
 * @param amount - The amount of the currency
 * @param livePrices - Array of live price objects from oracle
 * @returns USD value or 0 if price not found
 */
export function getUSDValue(
  currency: string, 
  amount: string | number, 
  livePrices: PriceInfo[]
): number {
  if (!livePrices || !currency || !amount) return 0;

  // Handle USD directly
  if (currency === "USD") {
    return parseFloat(amount.toString());
  }

  // Find price for the currency
  const priceInfo = livePrices.find(
    (p) => p.baseAsset === currency && p.available
  );

  if (priceInfo && priceInfo.price) {
    return parseFloat(amount.toString()) * priceInfo.price;
  }

  return 0;
}

/**
 * Format any currency value with consistent decimal places (min 2, max 2)
 * @param value - The value to format
 * @returns Formatted value string
 */
export function formatCurrencyValue(value: string | number): string {
  const num = parseFloat(value.toString());
  if (isNaN(num)) return "0.00";
  
  return num.toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2
  });
}

/**
 * Get currency icon path
 * @param currency - The currency symbol
 * @returns Icon path or null if not found
 */
export function getCurrencyIcon(currency: string): string | null {
  const currencyObj = availableCurrencies.find(c => c.id === currency);
  return currencyObj ? currencyObj.avatar : null;
}

/**
 * Format currency object for API calls and backend functions
 * Creates a standardized currency object structure for internal use
 * @param currency - The currency code (e.g., "XRP", "USD", "BTC")
 * @param issuerAddress - The issuer address (always provided, but ignored for XRP)
 * @param value - The amount value (defaults to "0" if not specified)
 * @returns Currency object - For XRP: {currency, value}, For others: {currency, issuer, value}
 */
export function formatAPICurrencyObj(
  currency: string, 
  issuerAddress: string, 
  value: string | number = "0"
): CurrencyObject {  
  if (currency === "XRP") {
    return {
      currency,
      value: value
    };
  }
  
  return {
    currency,
    issuer: issuerAddress,
    value: value
  };
}

/**
 * Format currency object for XRPL transactions (createOffer, AMMDeposit, etc.)
 * Creates currency objects in the format expected by XRPL transactions
 * @param currency - The currency code (e.g., "XRP", "USD", "BTC")
 * @param issuerAddress - The issuer address (ignored for XRP)
 * @param value - The amount value (defaults to "0" if not specified)
 * @returns For XRP: string in drops, For others: {currency, issuer, value}
 */
export function formatXRPLCurrencyObj(
  currency: string, 
  issuerAddress: string, 
  value: string | number = "0"
): string | CurrencyObject { 
  
  if (currency === "XRP") {
    // Import xrpl dynamically to avoid issues with SSR
    const xrpl = require("xrpl");
    // Convert to float only for xrpToDrops calculation, then return as string
    return xrpl.xrpToDrops(value.toString());
  }
  
  return {
    currency,
    issuer: issuerAddress,
    value: value
  };
}

