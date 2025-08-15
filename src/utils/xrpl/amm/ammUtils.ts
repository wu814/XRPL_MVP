import { connectXrplClient, client } from "../testnet";
import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { 
  AMMInfoRequest, 
  AMMInfoResponse, 
} from "xrpl";
import { AMMInfo, AMMData, FormattedAMMInfo } from "@/types/xrpl/index";
import { formatAssetForDisplay } from "@/utils/assetUtils";


/**
 * Get live AMM information directly from the XRPL ledger
 * @param ammAccount - The AMM account address
 * @returns Live AMM data from ledger or null if failed
 */
export async function getAMMInfo(ammAccount: string): Promise<AMMInfo | null> {
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
        account: ammAccount,
        amount: { currency: "Unknown", issuer: null, value: "0" },
        amount2: { currency: "Unknown", issuer: null, value: "0" },
        lp_token: {
          currency: "LP",
          issuer: ammAccount,
          value: "0"
        },
        trading_fee: 0,
        auction_slot: null,
      };
    }
    
    const ammInfo: AMMInfo = response.result.amm;
    
    console.log(`✅ Live AMM data: ${ammInfo}`);
    
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
export async function getAllAMMData(): Promise<AMMData[]> {
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
 * Find AMM account by currency pair (order-insensitive)
 * @param currency1 - First currency (e.g., "EUR")
 * @param currency2 - Second currency (e.g., "USD")
 * @returns AMM account address or null if not found
 */
export async function findAMMAccount(currency1: string, currency2: string): Promise<string | null> {
  const ammData = await getAllAMMData();

  // Find a row where the pair matches, order-insensitive
  const found = ammData.find(pool =>
    (pool.currency1 === currency1 && pool.currency2 === currency2) ||
    (pool.currency1 === currency2 && pool.currency2 === currency1)
  );
  if (found) {
    return found.account;
  }
  
  console.warn(`⚠️ No AMM found for pair: ${currency1}/${currency2}`);
  return null;
}

// Getting live AMM info for a currency pair, returns with formatted amounts
export async function getFormattedAMMInfoByCurrencies (
  sendCurrency: string, 
  receiveCurrency: string, 
): Promise<FormattedAMMInfo | null> {
  // Find AMM account by currencies
  const ammAccount = await findAMMAccount(sendCurrency, receiveCurrency);
  
  if (!ammAccount) {
    return null;
  }
  
  // Get live AMM info directly
  const liveAMMInfo = await getAMMInfo(ammAccount);
  
  if (!liveAMMInfo) return null;

  const formattedAmount = formatAssetForDisplay(liveAMMInfo.amount);
  const formattedAmount2 = formatAssetForDisplay(liveAMMInfo.amount2);
  
  return {
    account: liveAMMInfo.account,
    formattedAmount: formattedAmount,
    formattedAmount2: formattedAmount2,
    tradingFee: liveAMMInfo.trading_fee
  };
};