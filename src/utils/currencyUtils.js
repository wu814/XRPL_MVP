import { useState, useEffect } from "react";

export const availableCurrencies = [
  { id: "USD", name: "USD", avatar: "/icons/USD.png" },
  { id: "XRP", name: "XRP", avatar: "/icons/XRP.png" },
  { id: "EUR", name: "Euro", avatar: "/icons/EUR.png" },
  { id: "BTC", name: "Bitcoin", avatar: "/icons/BTC.png" }, 
  { id: "ETH", name: "Ethereum", avatar: "/icons/ETH.png" },
  { id: "SOL", name: "Solana", avatar: "/icons/SOL.png" },
];

/**
 * Fetches USD prices for currencies using the oracle
 * @returns {Promise<Array>} Array of price objects with baseAsset and price properties
 */
export async function fetchUSDPrices() {
  try {
    // Step 1: Get treasury wallet (oracle account)
    const treasuryResponse = await fetch("/api/wallets/getTreasuryWallet");
    const treasuryData = await treasuryResponse.json();

    if (!treasuryData.data || treasuryData.data.length === 0) {
      console.error("No treasury wallet found");
      return [];
    }

    const treasuryWallet = treasuryData.data[0];

    // Step 2: Get live prices from oracle
    const pricesResponse = await fetch("/api/oracle/getLivePrices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: treasuryWallet.classic_address,
        oracleDocumentId: 1,
        ledgerIndex: "validated",
      }),
    });

    const pricesData = await pricesResponse.json();

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
 * @param {string} currency - The currency symbol (e.g., "XRP", "BTC", "ETH")
 * @param {number} amount - The amount of the currency
 * @param {Array} livePrices - Array of live price objects from oracle
 * @returns {number} USD value or 0 if price not found
 */
export function getUSDValue(currency, amount, livePrices) {
  if (!livePrices || !currency || !amount) return 0;

  // Handle USD directly
  if (currency === "USD") {
    return parseFloat(amount);
  }

  // Find price for the currency
  const priceInfo = livePrices.find(
    (p) => p.baseAsset === currency && p.available
  );

  if (priceInfo && priceInfo.price) {
    return parseFloat(amount) * priceInfo.price;
  }

  return 0;
}

/**
 * Format any currency value with consistent decimal places (min 2, max 6)
 * @param {number} value - The value to format
 * @returns {string} Formatted value string
 */
export function formatCurrencyValue(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  
  return num.toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2
  });
}

/**
 * Get currency icon path
 * @param {string} currency - The currency symbol
 * @returns {string|null} Icon path or null if not found
 */
export function getCurrencyIcon(currency) {
  const currencyObj = availableCurrencies.find(c => c.id === currency);
  return currencyObj ? currencyObj.avatar : null;
}

/**
 * Format currency object for API calls and backend functions
 * Creates a standardized currency object structure for internal use
 * @param {string} currency - The currency code (e.g., "XRP", "USD", "BTC")
 * @param {string} issuerAddress - The issuer address (always provided, but ignored for XRP)
 * @param {string|number} value - The amount value (defaults to "0" if not specified)
 * @returns {Object} Currency object - For XRP: {currency, value}, For others: {currency, issuer, value}
 */
export function formatAPICurrencyObj(currency, issuerAddress, value = "0") {  
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
 * @param {string} currency - The currency code (e.g., "XRP", "USD", "BTC")
 * @param {string} issuerAddress - The issuer address (ignored for XRP)
 * @param {string|number} value - The amount value (defaults to "0" if not specified)
 * @returns {string|Object} For XRP: string in drops, For others: {currency, issuer, value}
 */
export function formatXRPLCurrencyObj(currency, issuerAddress, value = "0") { 
  
  if (currency === "XRP") {
    // Import xrpl dynamically to avoid issues with SSR
    const xrpl = require("xrpl");
    // Convert to float only for xrpToDrops calculation, then return as string
    return xrpl.xrpToDrops(value);
  }
  
  return {
    currency,
    issuer: issuerAddress,
    value: value
  };
}

/**
 * Custom hook for live prices
 * @returns {Object} { livePrices, loading }
 */
export function useLivePrices() {
  const [livePrices, setLivePrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await fetchUSDPrices();
        setLivePrices(prices);
      } catch (error) {
        console.error("Error fetching live prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  return { livePrices, loading };
} 