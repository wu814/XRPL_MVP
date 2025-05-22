import { useEffect, useState } from "react";
import Navbar from "../Navbar";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../CurrencyIcon";
import AmmCompositionBar from "./AmmCompositionBar";
import ManageAmmBalance from "./ManageAmmBalance";
import Breadcrumbs from "../Breadcrumbs";

export default function DisplayAmmDetails({ ammAddress }) {
  const [ammInfo, setAmmInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currency1, setCurrency1] = useState(null);
  const [currency2, setCurrency2] = useState(null);

  const fetchAmmInfo = async () => {
    try {
      const res = await fetch("/api/amms/getAmmInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset1: ammAddress }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch AMM info");
      setAmmInfo(result.data);
      console.log("AMM Info:", result.data);
    } catch (error) {
      setErrorMessage(error.message);
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
        if (parsed?.ammAddress === ammAddress) {
          setCurrency1(parsed.pair[0]);
          setCurrency2(parsed.pair[1]);
          localStorage.removeItem("selectedAMM"); // Clear after use
        }
      } catch (e) {
        console.error("Failed to parse cached AMM", e);
      }
    }
    fetchAmmInfo();
  }, [ammAddress]);

  const renderPriceInfo = () => {
    const a1 = parseFloat(ammInfo?.amount?.value);
    const a2 = parseFloat(ammInfo?.amount2?.value);
    if (isNaN(a1) || isNaN(a2) || a1 <= 0 || a2 <= 0) return null;

    const s1 = ammInfo.amount.currency || "Asset1";
    const s2 = ammInfo.amount2.currency || "Asset2";
    const price1 = (a2 / a1).toFixed(6);
    const price2 = (a1 / a2).toFixed(6);

    return (
      <div className="mb-4">
        <h3 className="mb-1 text-lg text-white">Price Information</h3>
        <p className="text-sm">
          1 {s1} = {price1} {s2} / 1 {s2} = {price2} {s1}
        </p>
      </div>
    );
  };

  const renderLPToken = () => (
    <div className="mb-4">
      <h3 className="mb-1 text-lg text-white">LP Token</h3>
      <p className="text-lg">
        Currency: {ammInfo?.lp_token?.currency || "Unknown"}
      </p>
      <p className="text-lg">
        Issuer: {ammInfo?.lp_token?.issuer || "Unknown"}
      </p>
      <p className="text-lg">Total Supply: {ammInfo?.lp_token?.value || "0"}</p>
    </div>
  );

  const renderTradingFee = () => (
    <div>
      <h3 className="text-mutedText mb-2">Trading Fee</h3>
      <p className="text-lg font-semibold">
        {ammInfo?.trading_fee !== undefined
          ? `${(ammInfo.trading_fee / 1000).toFixed(2)}%`
          : "Unknown"}
      </p>
    </div>
  );


  return (
    <div>
      <Navbar />
      <div className="container mx-auto">
        <Breadcrumbs customLabel={`${currency1}/${currency2}`} />
        <div className="flex flex-row gap-2 py-6">
          <CurrencyIcon
            symbol={currency1}
            heightClass="h-8"
            widthClass="w-8"
          />
          <CurrencyIcon
            symbol={currency2}
            heightClass="h-8"
            widthClass="w-8"
          />
        </div>
        <div className="grid grid-cols-6 gap-4 py-6">
          <div className="bg-color2 col-span-2 rounded-xl p-4">
            <h3 className="text-mutedText">Pool Composition</h3>
            <AmmCompositionBar
              amount1={ammInfo?.amount}
              amount2={ammInfo?.amount2}
            />
            {renderPriceInfo()}
          </div>
          <div className="bg-color2 col-span-1 rounded-xl p-4">
            <h3 className="text-mutedText mb-2">Pool Value</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="bg-color2 col-span-1 rounded-xl p-4">
            <h3 className="text-mutedText mb-2">Volume (24h)</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="bg-color2 col-span-1 rounded-xl p-4">
            <h3 className="text-mutedText mb-2">APR</h3>
            <p className="text-lg font-semibold">$99999.99</p>
          </div>
          <div className="bg-color2 col-span-1 rounded-xl p-4">
            {renderTradingFee()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Swap/Add/Withdraw Panel */}
          <div className="bg-color2 col-span-1 rounded-xl p-4">
            <ManageAmmBalance ammInfo={ammInfo} />
          </div>
          {/* Volume/TVL/Fees Graph */}
          <div className="bg-color2 text-mutedText col-span-2 rounded-xl p-4">
            Volume/TVL/Fees Chart
          </div>
        </div>
      </div>
    </div>
  );
}
