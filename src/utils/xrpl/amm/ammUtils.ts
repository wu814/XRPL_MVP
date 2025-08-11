import { connectXrplClient, client } from "../testnet";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { 
  AMMInfoRequest, 
  AMMInfoResponse, 
  Amount, 
  IssuedCurrencyAmount
} from "xrpl";

interface Asset {
  currency: string;
  issuer: string | null;
  value: string;
}

export interface LPToken {
  currency: string;
  issuer: string;
  value: string;
}

interface AmmInfo {
  success: boolean;
  amm_account: string;
  amount: Asset;
  amount2: Asset;
  lp_token: LPToken;
  trading_fee: number;
  auction_slot: any | null;
  fetched_at: string;
}

interface AmmPoolInfo {
  amm_account: string;
  currency_a: string;
  currency_b: string;
  created_at: string;
}

interface AmmPoolData {
  amm_account: string;
  currency_a: Asset;
  currency_b: Asset;
  lp_token: LPToken;
  trading_fee: number;
  created_at: string;
}

interface AllAmmInfoResult {
  [pairKey: string]: AmmPoolData;
}

/**
 * Get live AMM information directly from the XRPL ledger
 * @param ammAccount - The AMM account address
 * @returns Live AMM data from ledger or null if failed
 */
export async function getAmmInfo(ammAccount: string): Promise<AmmInfo | null> {
  try {
    await connectXrplClient();
    
    console.log(`🔍 Fetching live AMM info for: ${ammAccount}`);
    
    const request: AMMInfoRequest = {
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated"
    };
    
    const response: AMMInfoResponse = await client.request(request);
    
    if (!response.result || !response.result.amm) {
      console.warn(`⚠️ No AMM data found for account: ${ammAccount}`);
      return {
        success: false,
        amm_account: ammAccount,
        amount: { currency: "XRP", issuer: null, value: "0" },
        amount2: { currency: "XRP", issuer: null, value: "0" },
        lp_token: {
          currency: "LP",
          issuer: ammAccount,
          value: "0"
        },
        trading_fee: 0,
        auction_slot: null,
        fetched_at: new Date().toISOString()
      };
    }
    
    const amm: any = response.result.amm;
    
    // Parse assets consistently
    const parseAsset = (assetData: Amount): Asset => {
      if (typeof assetData === 'string') {
        // XRP in drops
        return {
          currency: "XRP",
          issuer: null,
          value: (parseFloat(assetData) / 1000000).toString()
        };
      } else {
        // Token
        const issuedCurrency = assetData as IssuedCurrencyAmount;
        return {
          currency: issuedCurrency.currency,
          issuer: issuedCurrency.issuer,
          value: issuedCurrency.value
        };
      }
    };
    
    const asset1 = parseAsset(amm.amount);
    const asset2 = parseAsset(amm.amount2);

    const ammInfo: AmmInfo = {
      success: true,
      amm_account: ammAccount,
      amount: asset1,
      amount2: asset2,
      lp_token: {
        currency: amm.lp_token.currency || "LP",
        issuer: amm.lp_token.issuer || ammAccount,
        value: amm.lp_token.value || "0"
      },
      trading_fee: amm.trading_fee || 0,
      auction_slot: amm.auction_slot || null,
      fetched_at: new Date().toISOString()
    };
    
    console.log(`✅ Live AMM data: ${asset1.currency}/${asset2.currency} - ${asset1.currency}: ${asset1.value}, ${asset2.currency}: ${asset2.value}`);
    
    return ammInfo;
    
  } catch (error: any) {
    console.error(`❌ Error fetching AMM info for ${ammAccount}: ${error.message}`);
    return null;
  }
}

/**
 * Get AMM registry data from Supabase
 * @returns Array of AMM pool objects from Supabase
 */
export async function getAmmData(): Promise<AmmPoolInfo[]> {
  try {
    const supabase = await createSupabaseAnonClient();
    const { data, error } = await supabase
      .from("amms")
      .select("*");
    if (error) {
      console.error(`❌ Error fetching AMM data from Supabase: ${error.message}`);
      return [];
    }
    if (!data) {
      console.warn(`⚠️ No AMM data found in Supabase`);
      return [];
    }
    console.log(`📋 Loaded AMM registry from Supabase: ${data.length} pools`);
    return data;
  } catch (error: any) {
    console.error(`❌ Error reading AMM registry from Supabase: ${error.message}`);
    return [];
  }
}

/**
 * Get all AMM pools with live data
 * @returns Object with currency pairs as keys and AMM data as values
 */
export async function getAllAmmInfo(): Promise<AllAmmInfoResult> {
  console.log(`📊 Getting all AMM pools...`);
  
  const registry = await getAmmData();
  const result: AllAmmInfoResult = {};
  
  for (const poolInfo of registry) {
    try {
      const liveData = await getAmmInfo(poolInfo.amm_account);
      if (liveData) {
        // Sort currency codes alphabetically for the key
        const currencies = [poolInfo.currency_a, poolInfo.currency_b].sort();
        const pairKey = `${currencies[0]}/${currencies[1]}`;
        result[pairKey] = {
          amm_account: liveData.amm_account,
          currency_a: {
            currency: liveData.amount.currency,
            issuer: liveData.amount.issuer,
            value: liveData.amount.value
          },
          currency_b: {
            currency: liveData.amount2.currency,
            issuer: liveData.amount2.issuer,
            value: liveData.amount2.value
          },
          lp_token: liveData.lp_token,
          trading_fee: liveData.trading_fee,
          created_at: poolInfo.created_at
        };
      }
    } catch (error: any) {
      console.warn(`⚠️ Failed to get live data for ${poolInfo.amm_account}: ${error.message}`);
    }
  }
  
  console.log(`✅ Retrieved ${Object.keys(result).length} AMM pools`);
  return result;
}

/**
 * Get all AMM accounts from the registry
 * @returns Array of AMM account addresses
 */
export async function getAmmAccounts(): Promise<string[]> {
  const ammData = await getAmmData();
  return ammData.map(pool => pool.amm_account);
}

/**
 * Find AMM account by currency pair (order-insensitive)
 * @param currencyA - First currency (e.g., "EUR")
 * @param currencyB - Second currency (e.g., "USD")
 * @returns AMM account address or null if not found
 */
export async function findAmmAccount(currencyA: string, currencyB: string): Promise<string | null> {
  const ammData = await getAmmData();

  // Find a row where the pair matches, order-insensitive
  const found = ammData.find(pool =>
    (pool.currency_a === currencyA && pool.currency_b === currencyB) ||
    (pool.currency_a === currencyB && pool.currency_b === currencyA)
  );
  if (found) {
    return found.amm_account;
  }
  
  console.warn(`⚠️ No AMM found for pair: ${currencyA}/${currencyB}`);
  return null;
}

/**
 * Get live AMM info for a currency pair
 * @param currencyA - First currency
 * @param currencyB - Second currency
 * @returns Live AMM data or null
 */
export async function getAmmInfoByCurrencies(currencyA: string, currencyB: string): Promise<AmmInfo | null> {
  const ammAccount = await findAmmAccount(currencyA, currencyB);
  
  if (!ammAccount) {
    return null;
  }
  
  return await getAmmInfo(ammAccount);
}
