import * as xrpl from "xrpl";
import { connectXrplClient } from "@/utils/xrpl/client";

/**
 * Find the best conversion path using AMM liquidity only
 * @param {string} fromCurrency - Source currency (e.g., "XRP", "USD")
 * @param {string} toCurrency - Destination currency
 * @param {string} fromAmount - Amount to convert
 * @param {string} issuerAddress - Issuer address for tokens
 * @returns {Promise<object>} AMM pathfinding result with rates and paths
 */
export async function findAmmPath(
  fromCurrency,
  toCurrency,
  fromAmount,
  issuerAddress,
) {
  try {
    await connectXrplClient();

    console.log(
      `🔍 AMM Pathfinding: ${fromAmount} ${fromCurrency} → ${toCurrency}`,
    );

    const ammData = await getAllAmmInfo();
    const paths = [];
    let bestRate = 0;
    let bestPath = null;
    let ammFound = false;

    console.log(
      `📊 Found ${Object.keys(ammData).length} AMM pools in local storage`,
    );

    // Direct AMM lookup
    for (const [ammId, amm] of Object.entries(ammData)) {
      const currencyA = amm.currency_a?.currency || "XRP";
      const currencyB = amm.currency_b?.currency || "XRP";

      // Check for direct conversion
      if (
        (currencyA === fromCurrency && currencyB === toCurrency) ||
        (currencyA === toCurrency && currencyB === fromCurrency)
      ) {
        ammFound = true;
        console.log(`🔍 Found direct AMM pool: ${currencyA}/${currencyB}`);

        // Calculate rate from AMM reserves
        let reserveFrom, reserveTo;

        if (currencyA === fromCurrency) {
          // Get reserve for fromCurrency (currency A)
          if (currencyA === "XRP") {
            const xrpValue = parseFloat(amm.currency_a?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveFrom = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveFrom = parseFloat(amm.currency_a?.value || 0);
          }

          // Get reserve for toCurrency (currency B)
          if (currencyB === "XRP") {
            const xrpValue = parseFloat(amm.currency_b?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveTo = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveTo = parseFloat(amm.currency_b?.value || 0);
          }
        } else {
          // Get reserve for fromCurrency (currency B)
          if (currencyB === "XRP") {
            const xrpValue = parseFloat(amm.currency_b?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveFrom = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveFrom = parseFloat(amm.currency_b?.value || 0);
          }

          // Get reserve for toCurrency (currency A)
          if (currencyA === "XRP") {
            const xrpValue = parseFloat(amm.currency_a?.value || 0);
            // If value > 1000000, it's likely in drops, convert to XRP
            reserveTo = xrpValue > 1000000 ? xrpValue / 1000000 : xrpValue;
          } else {
            reserveTo = parseFloat(amm.currency_a?.value || 0);
          }
        }

        console.log(
          `📊 AMM Reserves: ${reserveFrom.toFixed(6)} ${fromCurrency} / ${reserveTo.toFixed(6)} ${toCurrency}`,
        );

        if (reserveFrom > 0 && reserveTo > 0) {
          const requestedAmount = parseFloat(fromAmount);

          // Check if we have sufficient liquidity (at least 10x the requested amount for good rates)
          const liquidityRatio = reserveFrom / requestedAmount;
          console.log(
            `📊 Liquidity check: ${reserveFrom.toFixed(6)} available / ${requestedAmount.toFixed(6)} requested = ${liquidityRatio.toFixed(2)}x`,
          );

          if (liquidityRatio < 2) {
            console.log(
              `⚠️ Insufficient AMM liquidity (need 2x minimum, have ${liquidityRatio.toFixed(2)}x)`,
            );
            continue; // Skip this AMM due to insufficient liquidity
          }

          // Use AMM formula for more accurate pricing: output = (input * reserveTo) / (reserveFrom + input)
          const outputAmount =
            (requestedAmount * reserveTo) / (reserveFrom + requestedAmount);
          const effectiveRate = outputAmount / requestedAmount;
          const estimatedOutput = outputAmount * 0.997; // Account for 0.3% fee

          // For display purposes, convert rate to user-friendly format when one currency is XRP
          let displayRate = effectiveRate;
          let rateLabel = `${toCurrency}/${fromCurrency}`;

          if (toCurrency === "XRP" && fromCurrency !== "XRP") {
            // Converting IOU to XRP: rate is already in XRP units, no conversion needed
            displayRate = effectiveRate;
            rateLabel = `XRP per ${fromCurrency}`;
          } else if (fromCurrency === "XRP" && toCurrency !== "XRP") {
            // Converting XRP to IOU: rate is already in correct units
            displayRate = effectiveRate;
            rateLabel = `${toCurrency} per XRP`;
          }

          console.log(
            `📈 AMM calculated rate: ${displayRate.toFixed(6)} ${rateLabel}`,
          );
          console.log(
            `💰 Estimated output: ${estimatedOutput.toFixed(6)} ${toCurrency}`,
          );

          if (effectiveRate > bestRate && estimatedOutput > 0.000001) {
            bestRate = effectiveRate;
            bestPath = {
              type: "direct_amm",
              ammAccount: amm.amm_account,
              rate: effectiveRate,
              estimatedOutput: estimatedOutput.toFixed(6),
              liquidityRatio: liquidityRatio,
              path: [
                {
                  currency: toCurrency === "XRP" ? "XRP" : toCurrency,
                  ...(toCurrency !== "XRP" && { issuer: issuerAddress }),
                  type: 48,
                },
              ],
            };
          }
        } else {
          console.log(`❌ AMM has zero reserves: ${reserveFrom}/${reserveTo}`);
        }
      }
    }

    // Multi-hop AMM lookup (e.g., EUR → XRP → USD, EUR → USD → BTC, etc.)
    if (!bestPath && Object.keys(ammData).length >= 2) {
      console.log(`🔍 Searching for multi-hop AMM paths...`);

      // ENHANCED: Check all possible intermediate currencies, not just XRP
      const allCurrencies = new Set();
      Object.values(ammData).forEach((amm) => {
        allCurrencies.add(amm.currency_a?.currency || "XRP");
        allCurrencies.add(amm.currency_b?.currency || "XRP");
      });

      console.log(
        `🔍 Available currencies for routing: ${Array.from(allCurrencies).join(", ")}`,
      );

      for (const [ammId1, amm1] of Object.entries(ammData)) {
        for (const [ammId2, amm2] of Object.entries(ammData)) {
          if (ammId1 === ammId2) continue;

          // Find common currency between AMMs
          const amm1Currencies = [
            amm1.currency_a?.currency || "XRP",
            amm1.currency_b?.currency || "XRP",
          ];
          const amm2Currencies = [
            amm2.currency_a?.currency || "XRP",
            amm2.currency_b?.currency || "XRP",
          ];

          const commonCurrency = amm1Currencies.find((c) =>
            amm2Currencies.includes(c),
          );

          if (
            commonCurrency &&
            amm1Currencies.includes(fromCurrency) &&
            amm2Currencies.includes(toCurrency) &&
            commonCurrency !== fromCurrency &&
            commonCurrency !== toCurrency
          ) {
            console.log(
              `🔍 Found potential multi-hop: ${fromCurrency} → ${commonCurrency} → ${toCurrency}`,
            );

            // Calculate multi-hop rate with proper AMM formula
            const rate1 = calculateAmmRate(
              amm1,
              fromCurrency,
              commonCurrency,
              parseFloat(fromAmount),
            );
            const intermediateAmount = parseFloat(fromAmount) * rate1;
            const rate2 = calculateAmmRate(
              amm2,
              commonCurrency,
              toCurrency,
              intermediateAmount,
            );

            if (rate1 > 0 && rate2 > 0) {
              const combinedRate = rate1 * rate2 * 0.994; // Two 0.3% fees
              const estimatedOutput = parseFloat(fromAmount) * combinedRate;

              // Create user-friendly rate display for multi-hop
              let displayRate1 = rate1;
              let displayRate2 = rate2;
              let displayCombinedRate = combinedRate;

              // Format intermediate step
              let rate1Label = `${commonCurrency}/${fromCurrency}`;
              if (commonCurrency === "XRP" && fromCurrency !== "XRP") {
                rate1Label = `XRP per ${fromCurrency}`;
              } else if (fromCurrency === "XRP" && commonCurrency !== "XRP") {
                rate1Label = `${commonCurrency} per XRP`;
              }

              // Format final step
              let rate2Label = `${toCurrency}/${commonCurrency}`;
              if (toCurrency === "XRP" && commonCurrency !== "XRP") {
                rate2Label = `XRP per ${commonCurrency}`;
              } else if (commonCurrency === "XRP" && toCurrency !== "XRP") {
                rate2Label = `${toCurrency} per XRP`;
              }

              console.log(
                `📈 Multi-hop rate: ${displayRate1.toFixed(6)} (${rate1Label}) × ${displayRate2.toFixed(6)} (${rate2Label}) = ${displayCombinedRate.toFixed(6)}`,
              );

              if (combinedRate > bestRate && estimatedOutput > 0.000001) {
                bestRate = combinedRate;
                bestPath = {
                  type: "multi_hop_amm",
                  ammAccounts: [amm1.amm_account, amm2.amm_account],
                  rate: combinedRate,
                  estimatedOutput: estimatedOutput.toFixed(6),
                  intermediateCurrency: commonCurrency,
                  path: [
                    {
                      currency:
                        commonCurrency === "XRP" ? "XRP" : commonCurrency,
                      ...(commonCurrency !== "XRP" && {
                        issuer: issuerAddress,
                      }),
                      type: 48,
                    },
                    {
                      currency: toCurrency === "XRP" ? "XRP" : toCurrency,
                      ...(toCurrency !== "XRP" && { issuer: issuerAddress }),
                      type: 48,
                    },
                  ],
                };
              }
            }
          }
        }
      }

      // ENHANCED: If no pure AMM multi-hop found, check for hybrid routes
      if (!bestPath) {
        console.log(
          `🔍 No pure AMM multi-hop found, checking for potential AMM participation in hybrid routes...`,
        );

        // Check if fromCurrency or toCurrency exists in any AMM
        let hasFromCurrencyInAmm = false;
        let hasToCurrencyInAmm = false;
        let availableFromPairs = [];
        let availableToPairs = [];

        Object.values(ammData).forEach((amm) => {
          const currencyA = amm.currency_a?.currency || "XRP";
          const currencyB = amm.currency_b?.currency || "XRP";

          if (currencyA === fromCurrency || currencyB === fromCurrency) {
            hasFromCurrencyInAmm = true;
            const otherCurrency =
              currencyA === fromCurrency ? currencyB : currencyA;
            availableFromPairs.push(`${fromCurrency}/${otherCurrency}`);
          }

          if (currencyA === toCurrency || currencyB === toCurrency) {
            hasToCurrencyInAmm = true;
            const otherCurrency =
              currencyA === toCurrency ? currencyB : currencyA;
            availableToPairs.push(`${toCurrency}/${otherCurrency}`);
          }
        });

        if (hasFromCurrencyInAmm || hasToCurrencyInAmm) {
          console.log(`💡 AMM hybrid potential detected:`);
          if (hasFromCurrencyInAmm) {
            console.log(
              `   ${fromCurrency} available in AMM pairs: ${availableFromPairs.join(", ")}`,
            );
          }
          if (hasToCurrencyInAmm) {
            console.log(
              `   ${toCurrency} available in AMM pairs: ${availableToPairs.join(", ")}`,
            );
          }
          console.log(
            `   Note: DEX+AMM hybrid routing will be handled by Smart Pathfinding comparison`,
          );
        } else {
          console.log(
            `💡 No AMM pools contain ${fromCurrency} or ${toCurrency} - pure DEX routing likely optimal`,
          );
        }
      }
    }

    if (!ammFound && Object.keys(ammData).length > 0) {
      console.log(
        `❌ No AMM pools found for ${fromCurrency}/${toCurrency} conversion`,
      );
    }

    const result = {
      success: !!bestPath,
      type: "amm",
      bestPath,
      bestRate,
      allPaths: bestPath ? [bestPath] : [],
    };

    if (bestPath) {
      // Create user-friendly rate display for the final result
      let displayBestRate = bestRate;
      let bestRateLabel = `${toCurrency}/${fromCurrency}`;

      if (toCurrency === "XRP" && fromCurrency !== "XRP") {
        bestRateLabel = `XRP per ${fromCurrency}`;
      } else if (fromCurrency === "XRP" && toCurrency !== "XRP") {
        bestRateLabel = `${toCurrency} per XRP`;
      }

      console.log(
        `✅ AMM Best Path: ${bestPath.type} with rate ${displayBestRate.toFixed(6)} ${bestRateLabel}`,
      );
    } else {
      console.log(`❌ No viable AMM paths found`);
    }

    return result;
  } catch (error) {
    console.error(`❌ AMM pathfinding error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

const getAmmRate = (fromCurrency, toCurrency, ammData, amount) => {
  // Use existing calculateAmmRate function
  for (const amm of Object.values(ammData)) {
    const rate = calculateAmmRate(amm, fromCurrency, toCurrency, amount);
    if (rate > 0) return rate;
  }
  return 0;
};
