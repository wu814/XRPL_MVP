"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../currency/CurrencyIcon";
import CreateAMMBtn from "./CreateAMMBtn";
import { fetchUSDPrices, getUSDValue, formatCurrencyValue, PriceInfo } from "@/utils/currencyUtils";
import { AMMData, AMMInfo } from "@/types/xrpl/index";
import { APIErrorResponse, GetAllAMMDataAPIResponse, GetAMMInfoAPIResponse } from "@/types/api/index";

interface AMMListItem {
  ammAccount: string;
  currency_a: string;
  currency_b: string;
}

interface NewAMMData {
  ammAccount: string;
  currency_a?: string;
  currency_b?: string;
}

// This class is used to parse the AMM data returned from the API
class AMMInfoParser {
  account: string;
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
  // Converts XRP from drops or parses IOU
  parseAmount(
    amount:
      | string
      | { currency: string; issuer: string; value: string }
      | undefined,
  ): {
    currency: string;
    issuer: string | null;
    value: string;
  } {
    if (!amount) {
      return { currency: "XRP", issuer: null, value: "0" };
    }

    if (typeof amount === "string") {
      // XRP is a string of drops
      const xrpl = require("xrpl");
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

export default function DisplayAMMs() {
  const router = useRouter(); // Redirect user to the AMM page when they click on an AMM
  const { data: session, status } = useSession();
  const [ammsDBData, setAMMsDBData] = useState<AMMData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<PriceInfo[]>([]);
  const [pricesLoading, setPricesLoading] = useState<boolean>(true);
  const [ammDetails, setAMMDetails] = useState<Record<string, AMMInfo>>({});

  // Helper function to format fee display
  const formatFee = (fee: number | null | undefined): string => {
    if (fee === null || fee === undefined) return "N/A"; // Only return N/A for null/undefined
    return `${(fee / 1000).toFixed(3)}%`; // Convert basis points to percentage
  };

  // Function to fetch USD prices
  const fetchPrices = async () => {
    try {
      const prices = await fetchUSDPrices();
      setLivePrices(prices);
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setPricesLoading(false);
    }
  };

  // Function to fetch detailed AMM info for pool value calculation
  const fetchAMMDetails = async (account: string) => {
    try {
      const response = await fetch("/api/amm/getAMMInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: GetAMMInfoAPIResponse = await response.json();

      if (result.data) {
        setAMMDetails((prev) => ({
          ...prev,
          [account]: result.data,
        }));
      }
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  // Function to calculate pool value
  const calculatePoolValue = (ammAccount: string): number | null => {
    const ammInfo = ammDetails[ammAccount];
    if (!ammInfo || pricesLoading) {
      return null;
    }

    const usdValue1 = getUSDValue(
      ammInfo.amount.currency,
      parseFloat(ammInfo.amount.value),
      livePrices,
    );
    const usdValue2 = getUSDValue(
      ammInfo.amount2.currency,
      parseFloat(ammInfo.amount2.value),
      livePrices,
    );
    const totalUsdValue = usdValue1 + usdValue2;

    return totalUsdValue > 0 ? totalUsdValue : null;
  };

  const fetchAMMs = async () => {
    setLoading(true);
    try {
      // Getting amms from the database
      const response = await fetch("/api/amm/getAllAMMData");

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: GetAllAMMDataAPIResponse = await response.json();

      if (result.data && result.data.length > 0) {
        const ammsData: AMMData[] = result.data.sort((a, b) => {
          const pair1 = `${a.currency1}/${a.currency2}`;
          const pair2 = `${b.currency1}/${b.currency2}`;
          return pair1.localeCompare(pair2);
        });
        setAMMsDBData(ammsData);

        // Fetch detailed info for each AMM
        ammsData.forEach((amm) => {
          fetchAMMDetails(amm.account);
        });
      }
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAMMCreated = (newAMMData: NewAMMData) => {
    const newAMM: AMMListItem = {
      ammAccount: newAMMData.ammAccount,
      currency_a: newAMMData.currency_a || "Unknown",
      currency_b: newAMMData.currency_b || "Unknown",
    };
    setAMMsDBData((prevAMMs) =>
      [...prevAMMs, newAMM].sort((a, b) => {
        const pair1 = `${a.currency1}/${a.currency2}`;
        const pair2 = `${b.currency1}/${b.currency2}`;
        return pair1.localeCompare(pair2);
      }),
    );
    // Fetch details for the new AMM
    fetchAMMDetails(newAMMData.ammAccount);
  };

  useEffect(() => {
    fetchAMMs();
    fetchPrices();
  }, []);

  return (
    <div className="container mx-auto">
      <div className="mb-5 flex items-center justify-end">
        {/* Only show the button if the user is an admin and there are issuer wallet and treasury wallet */}
        {session?.user?.role === "ADMIN" && (
          <CreateAMMBtn onAMMCreated={handleAMMCreated} />
        )}
      </div>

      {loading ? (
        <div className="flex flex-col rounded-lg bg-color2">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border px-4 py-4 text-lg font-semibold text-white">
            <h3 className="pl-7 text-left">Pair</h3>
            <h3 className="text-center">Address</h3>
            <h3 className="text-center">Pool Value</h3>
            <h3 className="text-center">Fee</h3>
          </div>

          {/* Skeleton Rows */}
          <div className="animate-pulse">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6"
              >
                {/* Pair */}
                <div className="flex gap-2 pl-2">
                  <div className="flex items-center gap-2 rounded-lg bg-color4 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-pulse" />
                    <div className="h-4 w-8 rounded-lg bg-pulse" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-color4 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-pulse" />
                    <div className="h-4 w-8 rounded-lg bg-pulse" />
                  </div>
                </div>
                {/* Address */}
                <div className="mx-auto h-4 w-48 rounded-lg bg-pulse" />
                {/* Pool Total */}
                <div className="mx-auto h-4 w-20 rounded-lg bg-pulse" />
                {/* Fee */}
                <div className="mx-auto h-4 w-12 rounded-lg bg-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : ammsDBData.length === 0 ? (
        <p className="text-center">No AMMs found.</p>
      ) : (
        <div className="flex flex-col rounded-lg bg-color2">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border px-4 py-4 text-lg font-semibold">
            <h3 className="pl-7 text-left">Pair</h3>
            <h3 className="text-center">Address</h3>
            <h3 className="text-center">Pool Value</h3>
            <h3 className="text-center">Fee</h3>
          </div>

          {/* Data rows */}
          {ammsDBData.map((amm, index) => {
            const poolValue = calculatePoolValue(amm.account);

            return (
              <div
                key={index}
                className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6 hover:bg-color3"
                onClick={() => {
                  localStorage.setItem("selectedAMM", JSON.stringify(amm));
                  router.push(`/trade/amm/${amm.account}`);
                }}
              >
                <div className="flex gap-1 pl-2">
                  <CurrencyIcon symbol={amm.currency1} iconBg="bg-color4" />
                  <CurrencyIcon symbol={amm.currency2} iconBg="bg-color4" />
                </div>
                <p className="text-center">{amm.account}</p>
                <p className="text-center">
                  {poolValue !== null ? (
                    `$${formatCurrencyValue(poolValue)}`
                  ) : pricesLoading || !ammDetails[amm.account] ? (
                    <span className="mx-auto inline-block h-4 w-16 animate-pulse rounded-lg bg-pulse" />
                  ) : (
                    "Not Available"
                  )}
                </p>
                <p className="text-center">
                  {!ammDetails[amm.account] ? (
                    <span className="mx-auto inline-block h-4 w-12 animate-pulse rounded-lg bg-pulse" />
                  ) : (
                    formatFee(ammDetails[amm.account]?.trading_fee)
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
