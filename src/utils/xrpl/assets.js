import { useState, useEffect } from "react";

export const availableCurrencies = [
  { id: "XRP", name: "XRP", avatar: "/icons/XRP.png" },
  { id: "USD", name: "USD", avatar: "/icons/USD.png" },
  { id: "EUR", name: "Euro", avatar: "/icons/EUR.png" },
  { id: "BTC", name: "Bitcoin", avatar: "/icons/BTC.png" }, 
  { id: "ETH", name: "Ethereum", avatar: "/icons/ETH.png" },
  { id: "SOL", name: "Solana", avatar: "/icons/SOL.png" },
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
 * Generate asset key for identification
 * @param {Object} asset - Asset object
 * @param {number} index - Asset index
 * @returns {string} Unique asset key
 */
export function getAssetKey(asset, index) {
  return asset.id || `${asset.currency}-${asset.walletAddress || index}`;
}

/**
 * Process wallet data to extract assets
 * @param {Object} wallet - Wallet object
 * @param {Array} livePrices - Live price data
 * @param {boolean} isIssuer - Whether this is an issuer wallet
 * @returns {Promise<Array>} Array of asset objects
 */
export async function fetchWalletAssets(wallet, livePrices, isIssuer = false) {
  if (!wallet) return [];

  try {
    const [accountInfoResponse, accountLinesResponse] = await Promise.all([
      fetch("/api/wallets/getAccountInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      }),
      fetch("/api/wallets/getAccountLines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      }),
    ]);

    const accountInfo = await accountInfoResponse.json();
    const accountLines = await accountLinesResponse.json();

    const assets = [];

    // Add XRP balance for non-issuer wallets
    if (!isIssuer && accountInfo.data?.balance) {
      const xrpBalance = parseFloat(accountInfo.data.balance);
      const usdValue = getUsdValue("XRP", xrpBalance, livePrices);

      assets.push({
        id: "xrp-native",
        currency: "XRP",
        balance: xrpBalance,
        value: usdValue,
        change24h: "2.3",
        walletAddress: wallet.classicAddress,
        issuer: null,
      });
    }

    // Process trustline balances
    if (accountLines.data?.lines) {
      if (isIssuer) {
        // For issuer wallets, group and sum by currency
        const grouped = accountLines.data.lines.reduce((acc, line) => {
          const currency = line.currency;
          const balance = parseFloat(line.balance);
          acc[currency] = (acc[currency] || 0) + balance;
          return acc;
        }, {});

        // Convert grouped balances to assets
        Object.entries(grouped).forEach(([currency, totalBalance]) => {
          const usdValue = getUsdValue(currency, totalBalance, livePrices);
          assets.push({
            id: `issuer-${currency}`,
            currency,
            balance: totalBalance,
            value: usdValue,
            change24h: "0",
            walletAddress: wallet.classicAddress,
            issuer: wallet.classicAddress,
          });
        });
      } else {
        // For regular wallets, add individual trustlines with positive balances
        accountLines.data.lines.forEach((line, index) => {
          if (parseFloat(line.balance) > 0) {
            const balance = parseFloat(line.balance);
            const currency = line.currency;
            const usdValue = getUsdValue(currency, balance, livePrices);

            assets.push({
              id: `${line.currency}-${line.account}-${index}`,
              currency: line.currency,
              balance: balance,
              value: usdValue,
              change24h: "1.5",
              walletAddress: wallet.classicAddress,
              issuer: line.account,
            });
          }
        });
      }
    }

    return assets;
  } catch (error) {
    console.error("Error fetching wallet assets:", error);
    return [];
  }
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
        const prices = await fetchUsdPrices();
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

/**
 * Custom hook for wallet assets
 * @param {Object} wallet - Wallet object
 * @param {Array} livePrices - Live price data
 * @param {boolean} isIssuer - Whether this is an issuer wallet
 * @returns {Object} { assets, loading }
 */
export function useWalletAssets(wallet, livePrices, isIssuer = false) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
        const walletAssets = await fetchWalletAssets(wallet, livePrices, isIssuer);
        setAssets(walletAssets);
      } catch (error) {
        console.error("Error loading wallet assets:", error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [wallet, livePrices, isIssuer]);

  return { assets, loading };
}

/**
 * Get wallet display name based on type
 * @param {string} walletType - The wallet type
 * @returns {string} Display name
 */
export function getWalletDisplayName(walletType) {
  const types = {
    "ISSUER": "Issuer Wallet",
    "TREASURY": "Treasury Wallet",
    "PATHFIND": "Pathfind Wallet",
    "USER": "User Wallet",
    "BUSINESS": "Business Wallet",
  };
  return types[walletType] || walletType;
}

/**
 * Check if an asset is an LP token
 * @param {Object} asset - Asset object
 * @returns {boolean} True if asset is an LP token
 */
export function isLpToken(asset) {
  return asset.currency && asset.currency.length === 40;
}

/**
 * Get AMM currency pair for an LP token
 * @param {string} ammAccount - AMM account address (LP token issuer)
 * @returns {Promise<Object|null>} Currency pair object or null if not found
 */
export async function getLpTokenCurrencyPair(ammAccount) {
  try {
    // Get AMM registry data
    const response = await fetch("/api/amms/getAllAmms");
    const ammData = await response.json();
    
    if (!ammData.data || !Array.isArray(ammData.data)) {
      return null;
    }
    
    // Find the AMM pool by account
    const ammPool = ammData.data.find(pool => pool.amm_account === ammAccount);
    
    if (ammPool) {
      return {
        currencyA: ammPool.currency_a,
        currencyB: ammPool.currency_b,
        pair: `${ammPool.currency_a}/${ammPool.currency_b}`
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching AMM currency pair:", error);
    return null;
  }
}

/**
 * Format LP token display name
 * @param {Object} asset - Asset object
 * @param {Object} currencyPair - Currency pair object
 * @returns {string} Formatted display name
 */
export function formatLpTokenDisplay(asset, currencyPair) {
  if (!currencyPair) {
    return `LP Token (${asset.currency.substring(0, 8)}...)`;
  }
  
  return `${currencyPair.currencyA}/${currencyPair.currencyB}`;
}

/**
 * Enhanced asset processing with LP token support
 * @param {Object} asset - Asset object
 * @param {Object} currencyPair - Currency pair object (for LP tokens)
 * @returns {Object} Enhanced asset object
 */
export function enhanceAssetWithLpInfo(asset, currencyPair = null) {
  if (isLpToken(asset)) {
    return {
      ...asset,
      isLpToken: true,
      displayName: formatLpTokenDisplay(asset, currencyPair),
      currencyPair: currencyPair
    };
  }
  
  return {
    ...asset,
    isLpToken: false,
    displayName: asset.currency
  };
}