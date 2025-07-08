"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../Currency/CurrencyIcon";
import AmmCompositionBar from "./AmmCompositionBar";
import ManageAmmBalance from "./ManageAmmBalance";
import Breadcrumbs from "../Navigation/Breadcrumbs";
import { useRouter } from "next/navigation";
import { CurrentUserWalletProvider } from "../Wallet/CurrentUserWalletProvider";

// This class is used to parse the AMM data returned from the API
class AmmInfo {
  constructor(data) {
    this.account = data.amm_account;
    this.trading_fee = data.trading_fee;

    // LP Token (always IOU format)
    this.lp_token = {
      currency: data.lp_token.currency,
      issuer: data.lp_token.issuer,
      value: parseFloat(data.lp_token.value),
    };

    // Asset 1 and 2 (XRP or IOU)
    this.amount = this.parseAmount(data.amount);
    this.amount2 = this.parseAmount(data.amount2);
  }

  // Converts XRP from drops or parses IOU
  parseAmount(amount) {
    if (typeof amount === "string") {
      // XRP is a string of drops
      return {
        currency: "XRP",
        issuer: null,
        value: parseFloat(amount) / 1_000_000, // Convert drops to XRP
      };
    } else {
      // IOU is an object
      return {
        currency: amount.currency,
        issuer: amount.issuer,
        value: parseFloat(amount.value),
      };
    }
  }
}

export default function DisplayAmmDetails({ ammAccount }) {
  const router = useRouter();

  const [ammInfo, setAmmInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currency1, setCurrency1] = useState("");
  const [currency2, setCurrency2] = useState("");

  const fetchAmmInfo = async () => {
    try {
      const res = await fetch("/api/amms/getAmmInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset1: ammAccount }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch AMM info");
      setAmmInfo(new AmmInfo(result.data));
    } catch (error) {
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

  useEffect(() => {
    // Retrieve cached AMM data from localStorage
    const cached = localStorage.getItem("selectedAMM");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.ammAccount === ammAccount) {
          // Use the new currency1 and currency2 fields
          setCurrency1(parsed.currency_a || "Unknown");
          setCurrency2(parsed.currency_b || "Unknown");
        }
      } catch (e) {
        console.error("Failed to parse cached AMM", e);
      }
    }
    fetchAmmInfo();
  }, [ammAccount]);

  // Delete later
  useEffect(() => {
    console.log(ammInfo);
  }, [ammInfo]);

  const renderPriceInfo = () => {
    const a1 = parseFloat(ammInfo?.amount?.value);
    const a2 = parseFloat(ammInfo?.amount2?.value);
    if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) return null;

    const s1 = currency1 || "Asset1";
    const s2 = currency2 || "Asset2";
    const price1 = (a2 / a1).toFixed(6);
    const price2 = (a1 / a2).toFixed(6);

    return (
      <div>
        <h3 className="text-mutedText">Price Information</h3>
        <p className="text-md px-4">
          1 {s1} = {price1} {s2} / 1 {s2} = {price2} {s1}
        </p>
      </div>
    );
  };

  const renderTradingFee = () => (
    <div>
      <h3 className="mb-2 text-mutedText">Trading Fee</h3>
      <p className="text-lg font-semibold">
        {`${(ammInfo?.trading_fee / 1000).toFixed(3)}%`}
      </p>
    </div>
  );

  return (
    <div>
      <div className="container mx-auto">   
        <div className="m-2">
          <Breadcrumbs customLabel={`${currency1}/${currency2}`} />
        </div>
        <div className="flex flex-row gap-2 py-4">
          <CurrencyIcon symbol={currency1} heightClass="h-8" widthClass="w-8" iconBg="bg-color3" />
          <CurrencyIcon symbol={currency2} heightClass="h-8" widthClass="w-8" iconBg="bg-color3" />
        </div>
        <div className="grid grid-cols-6 gap-2 py-2">
          <div className="col-span-2 rounded-lg bg-color2 p-4">
            <h3 className="text-mutedText">Pool Composition</h3>
            <AmmCompositionBar
              amount1={ammInfo?.amount}
              amount2={ammInfo?.amount2}
            />
            {renderPriceInfo()}
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">Pool Value</h3>
            <p className="text-lg font-semibold">Not Available</p>
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">Volume (24h)</h3>
            <p className="text-lg font-semibold">Not Available</p>
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <h3 className="mb-2 text-mutedText">APR</h3>
            <p className="text-lg font-semibold">Not Available</p>
          </div>
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            {renderTradingFee()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Swap/Add/Withdraw Panel */}
          <div className="col-span-1 rounded-lg bg-color2 p-4">
            <CurrentUserWalletProvider>
              <ManageAmmBalance
                ammInfo={ammInfo}
                onChange={fetchAmmInfo}
              />
            </CurrentUserWalletProvider>
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
