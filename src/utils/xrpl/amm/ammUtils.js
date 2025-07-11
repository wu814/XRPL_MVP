import xrpl from "xrpl";
import { connectXrplClient, client } from "../testnet";
import { createSupabaseAnonClient } from "@/utils/supabase/server"; 

/**
 * ============================================================================
 * SIMPLIFIED AMM DATA ARCHITECTURE - SUPABASE FLAT TABLE
 * ============================================================================
 * 
 * Functions:
 * 1. getAmmInfo(ammAccount) - Live data from ledger via amm_info command
 * 2. getAmmData() - Registry data from Supabase (flat table: amm_account, currency_a, currency_b, created_at)
 * 3. getAllAmmInfo() - Get all AMM pools with live data
 * 
 * No more redundant functions, caching, or complex abstractions.
 * ============================================================================
 */

/**
 * Get live AMM information directly from the XRPL ledger
 * @param {string} ammAccount - The AMM account address
 * @returns {Promise<object|null>} - Live AMM data from ledger or null if failed
 */
export async function getAmmInfo(ammAccount) {
  try {
    await connectXrplClient();
    
    console.log(`🔍 Fetching live AMM info for: ${ammAccount}`);
    
    const response = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
      ledger_index: "validated"
    });
    
    if (!response.result || !response.result.amm) {
      console.warn(`⚠️ No AMM data found for account: ${ammAccount}`);
      return {
        success: false,
        amm_account: ammAccount,
        amount: null,
        amount2: null,
        lp_token: null,
        trading_fee: null,
      };
    }
    
    const amm = response.result.amm;
    
    // Parse assets consistently
    const parseAsset = (assetData) => {
      if (typeof assetData === 'string') {
        // XRP in drops
        return {
          currency: "XRP",
          issuer: null,
          value: (parseFloat(assetData) / 1000000).toString()
        };
      } else {
        // Token
        return {
          currency: assetData.currency,
          issuer: assetData.issuer,
          value: assetData.value
        };
      }
    };
    
    const asset1 = parseAsset(amm.amount);
    const asset2 = parseAsset(amm.amount2);

    
    const ammInfo = {
      success: true,
      amm_account: ammAccount,
      amount: asset1,
      amount2: asset2,
      lp_token: amm.lp_token,
      trading_fee: amm.trading_fee || 0,
      auction_slot: amm.auction_slot || null,
      fetched_at: new Date().toISOString()
    };
    
    console.log(`✅ Live AMM data: ${asset1.currency}/${asset2.currency} - ${asset1.currency}: ${asset1.value}, ${asset2.currency}: ${asset2.value}`);
    
    return ammInfo;
    
  } catch (error) {
    console.error(`❌ Error fetching AMM info for ${ammAccount}: ${error.message}`);
    return null;
  }
}

/**
 * Get AMM registry data from Supabase
 * @returns {Promise<object[]>} - Array of AMM pool objects from Supabase
 */
export async function getAmmData() {
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
  } catch (error) {
    console.error(`❌ Error reading AMM registry from Supabase: ${error.message}`);
    return [];
  }
}

/**
 * Get all AMM pools with live data
 * @returns {Promise<object>} - Object with currency pairs as keys and AMM data as values
 */
export async function getAllAmmInfo() {
  console.log(`📊 Getting all AMM pools...`);
  
  const registry = await getAmmData();
  const result = {};
  
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
    } catch (error) {
      console.warn(`⚠️ Failed to get live data for ${poolInfo.amm_account}: ${error.message}`);
    }
  }
  
  console.log(`✅ Retrieved ${Object.keys(result).length} AMM pools`);
  return result;
}

/**
 * Get all AMM accounts from the registry
 * @returns {Promise<string[]>} - Array of AMM account addresses
 */
export async function getAmmAccounts() {
  const ammData = await getAmmData();
  return ammData.map(pool => pool.amm_account);
}

/**
 * Find AMM account by currency pair (order-insensitive)
 * @param {string} currencyA - First currency (e.g., "EUR")
 * @param {string} currencyB - Second currency (e.g., "USD")
 * @returns {Promise<string|null>} - AMM account address or null if not found
 */
export async function findAmmAccount(currencyA, currencyB) {
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
 * @param {string} currencyA - First currency
 * @param {string} currencyB - Second currency
 * @returns {Promise<object|null>} - Live AMM data or null
 */
export async function getAmmInfoByCurrencies(currencyA, currencyB) {
  const ammAccount = await findAmmAccount(currencyA, currencyB);
  
  if (!ammAccount) {
    return null;
  }
  
  return await getAmmInfo(ammAccount);
} 