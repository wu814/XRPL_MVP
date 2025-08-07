"use client";

// Change this file when there are more than 1 issuer wallet
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../Currency/CurrencyIcon";
import CreateAmmBtn from "./CreateAmmBtn";
import { fetchUSDPrices, getUSDValue, formatCurrencyValue } from "@/utils/currencyUtils";

// This class is used to parse the AMM data returned from the API
class AmmInfo {
  constructor(data) {
    this.account = data.amm_account;
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
  parseAmount(amount) {
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

export default function DisplayAmms() {
  const router = useRouter(); // Redirect user to the AMM page when they click on an AMM
  const { data: session, status } = useSession();
  const [amms, setAmms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [livePrices, setLivePrices] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [ammDetails, setAmmDetails] = useState({});

  // Helper function to format fee display
  const formatFee = (fee) => {
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
  const fetchAmmDetails = async (ammAccount) => {
    try {
      const res = await fetch("/api/amms/getAmmInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ammAccount }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch AMM info");
      
      const ammInfo = new AmmInfo(result.data);
      setAmmDetails(prev => ({
        ...prev,
        [ammAccount]: ammInfo
      }));
    } catch (error) {
      console.error(`Error fetching AMM details for ${ammAccount}:`, error);
    }
  };

  // Function to calculate pool value
  const calculatePoolValue = (ammAccount) => {
    const ammInfo = ammDetails[ammAccount];
    if (!ammInfo || pricesLoading) {
      return null;
    }

    const usdValue1 = getUSDValue(ammInfo.amount.currency, ammInfo.amount.value, livePrices);
    const usdValue2 = getUSDValue(ammInfo.amount2.currency, ammInfo.amount2.value, livePrices);
    const totalUsdValue = usdValue1 + usdValue2;

    return totalUsdValue > 0 ? totalUsdValue : null;
  };

  const fetchAmms = async () => {
    setLoading(true);
    try {
      // Getting amms from the database
      const res = await fetch("/api/amms/getAllAmms");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const ammsData = result.data
          .map((amm) => ({
            ammAccount: amm.amm_account,
            currency_a: amm.currency_a || "Unknown",
            currency_b: amm.currency_b || "Unknown",
          }))
          .sort((a, b) => {
            const pair1 = `${a.currency_a}/${a.currency_b}`;
            const pair2 = `${b.currency_a}/${b.currency_b}`;
            return pair1.localeCompare(pair2);
          });
        setAmms(ammsData);
        
        // Fetch detailed info for each AMM
        ammsData.forEach(amm => {
          fetchAmmDetails(amm.ammAccount);
        });
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAmmCreated = (newAmmData) => {
    const newAmm = {
      ammAccount: newAmmData.ammAccount,
      currency_a: newAmmData.currency_a || "Unknown",
      currency_b: newAmmData.currency_b || "Unknown",
    };
    setAmms((prevAmms) =>
      [...prevAmms, newAmm].sort((a, b) => {
        const pair1 = `${a.currency_a}/${a.currency_b}`;
        const pair2 = `${b.currency_a}/${b.currency_b}`;
        return pair1.localeCompare(pair2);
      }),
    );
    // Fetch details for the new AMM
    fetchAmmDetails(newAmmData.ammAccount);
  };

  useEffect(() => {
    fetchAmms();
    fetchPrices();
  }, []);

  return (
    <div className="container mx-auto">
      <div className="mb-5 flex items-center justify-end">
        {/* Only show the button if the user is an admin and there are issuer wallet and treasury wallet */}
        {session?.user?.role === "ADMIN" && (
          <CreateAmmBtn onAmmCreated={handleAmmCreated} />
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
      ) : amms.length === 0 ? (
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
          {amms.map((amm, index) => {
            const poolValue = calculatePoolValue(amm.ammAccount);
            
            return (
              <div
                key={index}
                className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6 hover:bg-color3"
                onClick={() => {
                  localStorage.setItem("selectedAMM", JSON.stringify(amm));
                  router.push(`/trade/amm/${amm.ammAccount}`);
                }}
              >
                <div className="flex gap-1 pl-2">
                  <CurrencyIcon symbol={amm.currency_a} iconBg="bg-color4" />
                  <CurrencyIcon symbol={amm.currency_b} iconBg="bg-color4" />
                </div>
                <p className="text-center">{amm.ammAccount}</p>
                <p className="text-center">
                  {poolValue !== null ? `$${formatCurrencyValue(poolValue)}` : 
                   pricesLoading || !ammDetails[amm.ammAccount] ? (
                     <span className="mx-auto h-4 w-16 animate-pulse rounded-lg bg-pulse inline-block" />
                   ) : "Not Available"}
                </p>
                <p className="text-center">
                  {!ammDetails[amm.ammAccount] ? (
                    <span className="mx-auto h-4 w-12 animate-pulse rounded-lg bg-pulse inline-block" />
                  ) : formatFee(ammDetails[amm.ammAccount]?.trading_fee)}
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
