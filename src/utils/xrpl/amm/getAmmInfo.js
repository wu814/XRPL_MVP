// ============================================================================
// SIMPLIFIED AMM CONTROLLER - Direct Export from ammUtils
// ============================================================================
// This file is now just a simple export wrapper
// All AMM functionality is in ammUtils for clean architecture
// ============================================================================

import { getAmmInfo as getAmmInfoUtils, getAmmData, getAmmInfoByCurrencies } from "./ammUtils";

/**
 * Get all AMM pools with live data
 * SIMPLIFIED: Just get registry and fetch live data for each pool
 */
export async function getAllAmmInfo() {
  console.log(`📊 Getting all AMM pools...`);
  
  const registry = await getAmmData();
  const result = {};
  
  for (const poolInfo of registry) {
    try {
      const liveData = await getAmmInfoUtils(poolInfo.amm_account);
      if (liveData) {
        // Sort currency codes alphabetically for the key
        const currencies = [poolInfo.currency_a, poolInfo.currency_b].sort();
        const pairKey = `${currencies[0]}/${currencies[1]}`;
        result[pairKey] = {
          amm_account: liveData.amm_account,
          currency_a: {
            currency: liveData.asset1.currency,
            issuer: liveData.asset1.issuer,
            value: liveData.asset1.value
          },
          currency_b: {
            currency: liveData.asset2.currency,
            issuer: liveData.asset2.issuer,
            value: liveData.asset2.value
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

// Legacy compatibility wrapper - converts new format to old format
async function getAmmInfoLegacy(asset1, asset2 = null) {
  try {
    let result = null;
    
    if (!asset2 && asset1.startsWith('r')) {
      // AMM account provided
      result = await getAmmInfoUtils(asset1);
    } else if (asset2) {
      // Currency pair provided
      result = await getAmmInfoByCurrencies(asset1, asset2);
    } else if (asset1.includes('/')) {
      // Pair string
      const [currency1, currency2] = asset1.split('/');
      result = await getAmmInfoByCurrencies(currency1, currency2);
    }
    
    if (!result) {
      return { success: false, error: "AMM not found" };
    }
    
    // Convert new format (asset1/asset2) back to old format (amount/amount2) for compatibility
    const legacyFormat = {
      success: true,
      amm_account: result.amm_account,
      amount: result.asset1.currency === "XRP" ? 
        (parseFloat(result.asset1.value) * 1000000).toString() : // Convert back to drops for XRP
        {
          currency: result.asset1.currency,
          issuer: result.asset1.issuer,
          value: result.asset1.value
        },
      amount2: result.asset2.currency === "XRP" ?
        (parseFloat(result.asset2.value) * 1000000).toString() : // Convert back to drops for XRP
        {
          currency: result.asset2.currency,
          issuer: result.asset2.issuer,
          value: result.asset2.value
        },
      lp_token: result.lp_token,
      trading_fee: result.trading_fee,
      auction_slot: result.auction_slot,
      fetched_at: result.fetched_at
    };
    
    return legacyFormat;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Export in ES module style
export const getAmmInfo = getAmmInfoLegacy;