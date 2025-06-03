import { client, connectXrplClient } from "../testnet";
import * as xrpl from "xrpl";

/**
 * Get information about an AMM instance from the XRPL ledger.
 *
 * @param {string} asset1 - First asset code, AMM account (r...), or pair string (e.g., "XRP/USD").
 * @param {string|null} asset2 - Second asset code (optional).
 * @param {string|null} asset1Issuer - Issuer address for asset1 (if not XRP).
 * @param {string|null} asset2Issuer - Issuer address for asset2 (if not XRP).
 * @returns {Promise<object|null>} AMM info object from XRPL, or null if not found (e.g., deleted).
 */
export default async function getAmmInfo(
  asset1,
  asset2 = null,
  asset1Issuer = null,
  asset2Issuer = null,
) {
  await connectXrplClient();

  const isAmmAccount = asset1?.startsWith("r") && !asset2;
  const isPairString = asset1?.includes("/") && !asset2;

  try {
    // --- Case 1: Lookup by AMM account address ---
    if (isAmmAccount) {
      const request = {
        command: "amm_info",
        amm_account: asset1,
        ledger_index: "validated",
      };
      const { result } = await client.request(request);
      if (!result.amm) throw new Error("AMM not found by account");
      return result.amm;
    }

    // --- Case 2: Parse pair string like "XRP/USD" ---
    if (isPairString) {
      const [currency1, currency2] = asset1.split("/");
      if (!currency1 || !currency2) throw new Error("Invalid AMM pair string");
      asset1 = currency1;
      asset2 = currency2;
    }

    // --- Case 3: Lookup by asset objects ---
    if (asset1 && asset2) {
      const buildAsset = (currency, issuer) =>
        currency === "XRP" ? { currency: "XRP" } : { currency, issuer };

      if (
        (asset1 !== "XRP" && !asset1Issuer) ||
        (asset2 !== "XRP" && !asset2Issuer)
      ) {
        throw new Error("Issuer required for non-XRP assets");
      }

      const request = {
        command: "amm_info",
        asset: buildAsset(asset1, asset1Issuer),
        asset2: buildAsset(asset2, asset2Issuer),
        ledger_index: "validated",
      };

      const { result } = await client.request(request);
      if (!result.amm) throw new Error("AMM not found for assets");
      return result.amm;
    }

    throw new Error("Invalid parameters for getAmmInfo");
    } catch (error) {
    // Handle deleted AMM case gracefully
    if (
      error?.data?.error === "entryNotFound" ||
      error?.message?.includes("AMM not found") ||
      error?.message?.includes("Account malformed") // 👈 add this
    ) {
      console.warn("ℹ️ AMM no longer exists on the ledger (likely deleted)");
      return null;
    }

    // Add context to make debugging easier
    throw new Error(`getAmmInfo error: ${error.message}`);
  }

}
