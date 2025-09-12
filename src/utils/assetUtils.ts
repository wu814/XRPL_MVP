import { getUSDValue, fetchUSDPrices, PriceInfo } from "@/utils/currencyUtils";
import { YONAWallet } from "@/types/appTypes";
import { Amount, IssuedCurrencyAmount, xrpToDrops, dropsToXrp } from "xrpl";
import { GetAccountInfoAPIResponse, GetAccountLinesAPIResponse } from "@/types/api/walletAPITypes";
import { GetAllAMMDataAPIResponse } from "@/types/api/ammAPITypes";
import { AMMData } from "@/types/xrpl/ammXRPLTypes";

// Type definitions
export interface Asset {
  id: string;
  currency: string;
  balance: number;
  value: number;
  change24h: string;
  walletAddress: string;
  issuer: string | null;
}

export interface AccountLine {
  currency: string;
  balance: string;
  account: string;
}

export interface AccountLines {
  data?: AccountLine[];
}

export interface CurrencyPair {
  currencyA: string;
  currencyB: string;
  pair: string;
}


export interface UseWalletAssetsReturn {
  assets: Asset[];
  loading: boolean;
}

type WalletType = "ISSUER" | "TREASURY" | "PATHFIND" | "USER" | "BUSINESS";

// Format amount for XRPL transaction
export function formatAmountForXRPL(amount: IssuedCurrencyAmount): Amount {
  if (amount.currency === "XRP") {
    return xrpToDrops(amount.value);
  }
  return {
    currency: amount.currency,
    issuer: amount.issuer,
    value: parseFloat(amount.value.toString()).toFixed(15)
  };
}

// Format amount for display
export function formatAmountForDisplay(amount: Amount): IssuedCurrencyAmount {
  if (typeof amount === "string") {
    return {
      currency: "XRP",
      issuer: null,
      value: dropsToXrp(amount).toString(),
    };
  }
  return {
    currency: amount.currency,
    issuer: amount.issuer,
    value: amount.value,
  };
}

/**
 * Generate asset key for identification
 */
export function getAssetKey(asset: Asset, index: number): string {
  return asset.id || `${asset.currency}-${asset.walletAddress || index}`;
}

/**
 * Process wallet data to extract assets
 */
export async function fetchWalletAssets(
  wallet: YONAWallet, 
  livePrices: PriceInfo[], 
  isIssuer: boolean = false
): Promise<Asset[]> {
  if (!wallet) return [];

  try {
    const [accountInfoResponse, accountLinesResponse] = await Promise.all([
      fetch("/api/wallet/getAccountInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      }),
      fetch("/api/wallet/getAccountLines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      }),
    ]);

    const accountInfo: GetAccountInfoAPIResponse = await accountInfoResponse.json();
    const accountLines: GetAccountLinesAPIResponse = await accountLinesResponse.json();

    const assets: Asset[] = [];

    // Add XRP balance for non-issuer wallets
    if (!isIssuer && accountInfo.data?.Balance) {
      const xrpBalance = parseFloat(accountInfo.data.Balance.toString());
      const usdValue = getUSDValue("XRP", xrpBalance, livePrices);

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
    if (accountLines.data) {
      if (isIssuer) {
        // For issuer wallets, group and sum by currency
        const grouped: Record<string, number> = accountLines.data.reduce((acc, line) => {
          const currency = line.currency;
          const balance = parseFloat(line.balance);
          acc[currency] = (acc[currency] || 0) + balance;
          return acc;
        }, {} as Record<string, number>);

        // Convert grouped balances to assets
        Object.entries(grouped).forEach(([currency, totalBalance]) => {
          const usdValue = getUSDValue(currency, totalBalance, livePrices);
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
        accountLines.data.forEach((line, index) => {
          if (parseFloat(line.balance) > 0) {
            const balance = parseFloat(line.balance);
            const currency = line.currency;
            const usdValue = getUSDValue(currency, balance, livePrices);

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
 * Get wallet display name based on type
 */
export function getWalletDisplayName(walletType: string): string {
  const types: Record<WalletType, string> = {
    "ISSUER": "Issuer Wallet",
    "TREASURY": "Treasury Wallet",
    "PATHFIND": "Pathfind Wallet",
    "USER": "User Wallet",
    "BUSINESS": "Business Wallet",
  };
  return types[walletType as WalletType] || walletType;
}

/**
 * Check if an asset is an LP token
 */
export function isLpToken(asset: Asset): boolean {
  return asset.currency && asset.currency.length === 40;
}

/**
 * Get AMM currency pair for an LP token
 */
export async function getLpTokenCurrencyPair(ammAccount: string): Promise<CurrencyPair | null> {
  try {
    // Get AMM registry data
    const response = await fetch("/api/amm/getAllAMMData");
    const ammData: GetAllAMMDataAPIResponse = await response.json();
    
    if (!ammData.data) {
      return null;
    }
    
    // Find the AMM pool by account
    const ammPool = ammData.data.find((pool: AMMData) => pool.account === ammAccount);
    
    if (ammPool) {
      return {
        currencyA: ammPool.currency1,
        currencyB: ammPool.currency2,
        pair: `${ammPool.currency1}/${ammPool.currency2}`
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
 */
export function formatLpTokenDisplay(asset: Asset, currencyPair?: CurrencyPair | null): string {
  if (!currencyPair) {
    return `LP Token (${asset.currency.substring(0, 8)}...)`;
  }
  
  return `${currencyPair.currencyA}/${currencyPair.currencyB}`;
}

