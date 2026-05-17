import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { getOracleData } from "./orcaleData";
import { fetchCoinGeckoPrices } from "./orcaleSet";

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  EUR: "euro-coin",
};

const ORACLE_DOCUMENT_ID = 1;

export interface LivePriceLookupResult {
  available: boolean;
  price: number;
  source: "coingecko" | "oracle" | "none";
  reason?: string;
}

/**
 * Server-side: Look up USD price per unit for a given currency symbol.
 * Tries CoinGecko first, falls back to the XRPL on-chain oracle owned by
 * the treasury wallet. USD short-circuits to 1.
 */
export async function getLivePriceUSD(
  currency: string,
): Promise<LivePriceLookupResult> {
  if (currency === "USD") {
    return { available: true, price: 1, source: "coingecko" };
  }

  const coingeckoId = SYMBOL_TO_COINGECKO_ID[currency];
  if (coingeckoId) {
    try {
      const prices = await fetchCoinGeckoPrices([coingeckoId], "usd");
      const match = prices.find((p) => p.symbol === currency);
      if (match && match.price > 0) {
        return { available: true, price: match.price, source: "coingecko" };
      }
    } catch (err) {
      console.warn(
        `CoinGecko price lookup failed for ${currency}, falling back to oracle:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    const supabase = await createSupabaseAnonClient();
    const { data: treasuryRows } = await supabase
      .from("wallets")
      .select("classic_address")
      .eq("wallet_type", "TREASURY");

    const treasuryAddress = treasuryRows?.[0]?.classic_address;
    if (!treasuryAddress) {
      return {
        available: false,
        price: 0,
        source: "none",
        reason: "No treasury wallet configured for oracle lookup",
      };
    }

    const oracle = await getOracleData(
      treasuryAddress,
      ORACLE_DOCUMENT_ID,
      "validated",
    );
    const series = oracle.oracle.PriceDataSeries?.find(
      (s) => s.PriceData.BaseAsset === currency,
    );
    const oraclePrice = series?.PriceData.AssetPriceDecimal ?? 0;
    if (oraclePrice > 0) {
      return { available: true, price: oraclePrice, source: "oracle" };
    }

    return {
      available: false,
      price: 0,
      source: "none",
      reason: `Oracle has no usable price for ${currency}`,
    };
  } catch (err) {
    return {
      available: false,
      price: 0,
      source: "none",
      reason: `Oracle price lookup failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
