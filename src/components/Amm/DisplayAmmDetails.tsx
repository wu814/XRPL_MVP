"use client";

import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../Currency/CurrencyIcon";
import AmmCompositionBar from "./AmmCompositionBar";
import ManageAmmBalance from "./ManageAmmBalance";
import Breadcrumbs from "../Navigation/Breadcrumbs";
import { useRouter } from "next/navigation";
import {
  fetchUSDPrices,
  getUSDValue,
  formatCurrencyValue,
  PriceInfo,
} from "@/utils/currencyUtils";
import { AmmInfo } from "./DisplayAmms"; // Import the centralized interface

interface AmmAmount {
  currency: string;
  issuer: string | null;
  value: string;
}

interface AmmApiResponse {
  amm_account: string;
  trading_fee: number;
  lp_token: {
    currency: string;
    issuer: string;
    value: string;
  };
  amount:
    | string
    | {
        currency: string;
        issuer: string;
        value: string;
      };
  amount2:
    | string
    | {
        currency: string;
        issuer: string;
        value: string;
      };
}

interface AmmInfoResponse {
  data?: AmmApiResponse;
  error?: string;
}

interface CachedAmmData {
  ammAccount?: string;
  currency_a?: string;
  currency_b?: string;
  timestamp?: number;
  ammDetails?: AmmInfo;
  livePrices?: PriceInfo[];
  pricesLoading?: boolean;
}

interface DisplayAmmDetailsProps {
  ammAccount: string;
}

// This class is used to parse the AMM data returned from the API
class AmmInfoParser implements AmmInfo {
  amm_account: string;
  trading_fee: number;
  lp_token: {
    currency: string;
    issuer: string;
    value: string;
  };
  amount: {
    currency: string;
    issuer: string | null;
    value: string;
  };
  amount2: {
    currency: string;
    issuer: string | null;
    value: string;
  };

  constructor(data: AmmApiResponse) {
    this.amm_account = data.amm_account;
    this.trading_fee = data.trading_fee;

    // LP Token (always IOU format)
    this.lp_token = {
      currency: data.lp_token.currency,
      issuer: data.lp_token.issuer,
      value: data.lp_token.value,
    };

    // Asset 1 and 2 (XRP or IOU)
    this.amount = this.parseAmount(data.amount);
    this.amount2 = this.parseAmount(data.amount2);
  }

  // Converts XRP from drops or parses IOU
  private parseAmount(
    amount: string | { currency: string; issuer: string; value: string },
  ): AmmAmount {
    if (typeof amount === "string") {
      const xrpl = require("xrpl");
      // XRP is a string of drops
      return {
        currency: "XRP",
        issuer: null,
        value: xrpl.dropsToXrp(amount), // Convert drops to XRP
      };
    } else {
      // IOU is an object
      return {
        currency: amount.currency,
        issuer: amount.issuer,
        value: amount.value,
      };
    }
  }
}

export default function DisplayAmmDetails({
  ammAccount,
}: DisplayAmmDetailsProps) {
  const router = useRouter();

  const [ammInfo, setAmmInfo] = useState<AmmInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currency1, setCurrency1] = useState<string>("");
  const [currency2, setCurrency2] = useState<string>("");
  const [livePrices, setLivePrices] = useState<PriceInfo[]>([]);
  const [pricesLoading, setPricesLoading] = useState<boolean>(true);

  const fetchAmmInfo = async (): Promise<void> => {
    try {
      const res = await fetch("/api/amm/getAmmInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ammAccount }),
      });

      const result: AmmInfoResponse = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch AMM info");

      if (result.data) {
        console.log(result.data);
        setAmmInfo(new AmmInfoParser(result.data));
      }
    } catch (error: any) {
      if (
        error.message === "Cannot read properties of null (reading 'account')"
      ) {
        setErrorMessage(
          "No Liquidity Pool found for the provided address, redirecting to Liquidity Pools page.",
        );
        setTimeout(() => {
          router.push("/trade/amm");
        }, 3500);
      } else {
        setErrorMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPrices = async (): Promise<void> => {
    try {
      const prices = await fetchUSDPrices();
      setLivePrices(prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setPricesLoading(false);
    }
  };

  useEffect(() => {
    // Check for cached data from DisplayAmms
    const cached = localStorage.getItem("selectedAMM");
    if (cached) {
      try {
        const parsed: CachedAmmData = JSON.parse(cached);
        if (parsed?.ammAccount === ammAccount) {
          setCurrency1(parsed.currency_a || "Unknown");
          setCurrency2(parsed.currency_b || "Unknown");

          // Check if we have cached AMM details and prices (and they're recent)
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes

          if (parsed.ammDetails && parsed.livePrices && cacheValid) {
            // Use cached data
            setAmmInfo(parsed.ammDetails);
            setLivePrices(parsed.livePrices);
            setPricesLoading(parsed.pricesLoading || false);
            setLoading(false);
            return; // Skip API calls
          }
        }
      } catch (e) {
        console.error("Failed to parse cached AMM", e);
      }
    }

    // Fallback to API calls if no valid cached data
    fetchAmmInfo();
    fetchPrices();
  }, [ammAccount]);

  // Delete later
  useEffect(() => {
    console.log(ammInfo);
  }, [ammInfo]);

  const renderPriceInfo = (): React.ReactNode => {
    return (
      <div>
        <h3 className="mb-2 text-mutedText">Price Information</h3>
        {loading || !ammInfo ? (
          <div className="animate-pulse">
            <div className="h-5 w-20 rounded-full bg-pulse" />
          </div>
        ) : (
          (() => {
            const a1 = parseFloat(ammInfo?.amount?.value);
            const a2 = parseFloat(ammInfo?.amount2?.value);
            if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) {
              return <p className="ml-2 text-lg font-medium">Not Available</p>;
            }

            const s1 = currency1 || "Asset1";
            const s2 = currency2 || "Asset2";
            const price1 = (a2 / a1).toFixed(6);
            const price2 = (a1 / a2).toFixed(6);

            return (
              <div className="ml-2 flex flex-col text-lg font-medium">
                <p>
                  {s1}/{s2}: {price1}
                </p>
                <p>
                  {s2}/{s1}: {price2}
                </p>
              </div>
            );
          })()
        )}
      </div>
    );
  };

  const renderTradingFee = (): React.ReactNode => (
    <div>
      <h3 className="mb-2 text-mutedText">Trading Fee</h3>
      {loading || !ammInfo ? (
        <div className="animate-pulse">
          <div className="h-5 w-20 rounded-full bg-pulse" />
        </div>
      ) : (
        <p className="ml-2 text-lg font-medium">
          {`${(ammInfo?.trading_fee / 1000).toFixed(3)}%`}
        </p>
      )}
    </div>
  );

  const renderPoolValue = (): React.ReactNode => {
    return (
      <div>
        <h3 className="mb-2 text-mutedText">Pool Value</h3>
        {loading || !ammInfo || pricesLoading ? (
          <div className="animate-pulse">
            <div className="h-5 w-20 rounded-full bg-pulse" />
          </div>
        ) : (
          (() => {
            const usdValue1 = getUSDValue(
              ammInfo.amount.currency,
              ammInfo.amount.value,
              livePrices,
            );
            const usdValue2 = getUSDValue(
              ammInfo.amount2.currency,
              ammInfo.amount2.value,
              livePrices,
            );
            const totalUsdValue = usdValue1 + usdValue2;

            if (totalUsdValue > 0) {
              return (
                <p className="ml-2 text-lg font-medium">
                  ${formatCurrencyValue(totalUsdValue)}
                </p>
              );
            }

            return <p className="ml-2 text-lg font-medium">Not Available</p>;
          })()
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="container mx-auto">
        <div className="m-2">
          <Breadcrumbs customLabel={`${currency1}/${currency2}`} />
        </div>
        <div className="flex flex-row gap-2 py-4">
          <CurrencyIcon
            symbol={currency1}
            heightClass="h-8"
            widthClass="w-8"
            iconBg="bg-color3"
          />
          <CurrencyIcon
            symbol={currency2}
            heightClass="h-8"
            widthClass="w-8"
            iconBg="bg-color3"
          />
        </div>
        <div className="grid grid-cols-6 gap-2 py-2">
          <div className="col-span-2 rounded-lg bg-color2 p-4">
            <h3 className="text-mutedText">Pool Composition</h3>
            <AmmCompositionBar
              amount1={ammInfo?.amount}
              amount2={ammInfo?.amount2}
              livePrices={livePrices}
              pricesLoading={pricesLoading}
            />
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            {renderPoolValue()}
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            {renderPriceInfo()}
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">Volume (24h)</h3>
            <p className="ml-2 text-lg font-medium">Not Available</p>
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            {renderTradingFee()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Swap/Add/Withdraw Panel */}
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <ManageAmmBalance ammInfo={ammInfo} onChange={fetchAmmInfo} />
          </div>
          {/* Volume/TVL/Fees Graph */}
          <div className="col-span-2 rounded-lg bg-color2 p-4 text-mutedText">
            Volume/TVL/Fees Chart
          </div>
        </div>

        {errorMessage && (
          <ErrorMdl
            errorMessage={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
      </div>
    </div>
  );
}
