export const availableCurrencies = [
  { id: "XRP", name: "XRP", avatar: "/icons/XRP.svg" },
  { id: "USD", name: "USD", avatar: "/icons/USD.svg" },
  { id: "EUR", name: "EUR", avatar: "/icons/EUR.svg" },
  { id: "BTC", name: "Bitcoin", avatar: "/icons/BTC.svg" },
  { id: "ETH", name: "Ethereum", avatar: "/icons/ETH.svg" },
  { id: "SOL", name: "Solana", avatar: "/icons/SOL.svg" },
];

/**
 * Fetches USD prices for currencies using the oracle
 * @returns {Promise<Array>} Array of price objects with baseAsset and price properties
 */
export async function fetchUsdPrices() {
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
export function getUsdValue(currency, amount, livePrices) {
  if (!livePrices || !currency || !amount) return 0;

  // Handle USD directly
  if (currency === "USD") {
    return amount;
  }

  // Find price for the currency
  const priceInfo = livePrices.find(
    (p) => p.baseAsset === currency && p.available
  );

  if (priceInfo && priceInfo.price) {
    return amount * priceInfo.price;
  }

  return 0;
}
