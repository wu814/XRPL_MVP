"use client";

import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../currency/CurrencyIcon";
import AMMCompositionBar from "./AMMCompositionBar";
import ManageAMMBalance from "./ManageAMMBalance";
import Breadcrumbs from "../navigation/Breadcrumbs";
import { useRouter } from "next/navigation";
import {
  fetchUSDPrices,
  getUSDValue,
  formatCurrencyValue,
  PriceInfo,
} from "@/utils/currencyUtils";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { GetFormattedAMMInfoAPIResponse } from "@/types/api/ammAPITypes";


interface DisplayAMMDetailsProps {
  account: string;
}

export default function DisplayAMMDetails({
  account,
}: DisplayAMMDetailsProps) {
  const router = useRouter();

  const [ammInfo, setAMMInfo] = useState<FormattedAMMInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currency1, setCurrency1] = useState<string>("");
  const [currency2, setCurrency2] = useState<string>("");
  const [livePrices, setLivePrices] = useState<PriceInfo[]>([]);
  const [pricesLoading, setPricesLoading] = useState<boolean>(true);

  const fetchAMMInfo = async (): Promise<void> => {
    try {
      const response = await fetch("/api/amm/getFormattedAMMInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: GetFormattedAMMInfoAPIResponse = await response.json();
      console.log("🔹 AMM Info:", result.data);

      if (result.data) {
        setAMMInfo(result.data);
        setCurrency1(result.data.formattedAmount1.currency);
        setCurrency2(result.data.formattedAmount2.currency);
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
        }, 3000);
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

  // Fetch AMM info and prices when the component mounts
  useEffect(() => {
    // Get currencies from localStorage
    const storedCurrencies = localStorage.getItem('ammCurrencies');
    if (storedCurrencies) {
      const { currency1: storedCurrency1, currency2: storedCurrency2 } = JSON.parse(storedCurrencies);
      setCurrency1(storedCurrency1);
      setCurrency2(storedCurrency2);
      
      // Clean up localStorage after retrieving
      localStorage.removeItem('ammCurrencies');
    }
    fetchAMMInfo();
    fetchPrices();
  }, [account]);


  const renderPriceInfo = () => {
    return (
      <div>
        <h3 className="mb-2 text-mutedText">Price Information</h3>
        {loading || !ammInfo ? (
          <div className="animate-pulse">
            <div className="h-5 w-20 rounded-full bg-pulse" />
          </div>
        ) : (
          (() => {
            const a1 = parseFloat(ammInfo?.formattedAmount1?.value);
            const a2 = parseFloat(ammInfo?.formattedAmount2?.value);
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

  const renderTradingFee = () => (
    <div>
      <h3 className="mb-2 text-mutedText">Trading Fee</h3>
      {loading || !ammInfo ? (
        <div className="animate-pulse">
          <div className="h-5 w-20 rounded-full bg-pulse" />
        </div>
      ) : (
        <p className="ml-2 text-lg font-medium">
          {`${(ammInfo?.tradingFee / 1000).toFixed(3)}%`}
        </p>
      )}
    </div>
  );

  const renderPoolValue = () => {
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
              ammInfo.formattedAmount1.currency,
              ammInfo.formattedAmount1.value,
              livePrices,
            );
            const usdValue2 = getUSDValue(
              ammInfo.formattedAmount2.currency,
              ammInfo.formattedAmount2.value,
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
            <AMMCompositionBar
              amount1={ammInfo?.formattedAmount1}
              amount2={ammInfo?.formattedAmount2}
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
            <ManageAMMBalance ammInfo={ammInfo} onChange={fetchAMMInfo} />
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
