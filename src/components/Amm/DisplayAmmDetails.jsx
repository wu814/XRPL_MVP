import { useEffect, useState } from "react";
import Navbar from "../Navbar";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../CurrencyIcon";
import AmmCompositionBar from "./AmmCompositionBar";

export default function DisplayAmmDetails({ ammAddress }) {
  const [ammInfo, setAmmInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

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
        <h3 className="mb-1 text-lg font-semibold text-white">
          Price Information
        </h3>
        <p className="text-sm text-gray-300">
          1 {s1} = {price1} {s2}
        </p>
        <p className="text-sm text-gray-300">
          1 {s2} = {price2} {s1}
        </p>
      </div>
    );
  };

  const renderLPToken = () => (
    <div className="mb-4">
      <h3 className="mb-1 text-lg font-semibold text-white">LP Token</h3>
      <p className="text-sm text-gray-300">
        Currency: {ammInfo?.lp_token?.currency || "Unknown"}
      </p>
      <p className="text-sm text-gray-300">
        Issuer: {ammInfo?.lp_token?.issuer || "Unknown"}
      </p>
      <p className="text-sm text-gray-300">
        Total Supply: {ammInfo?.lp_token?.value || "0"}
      </p>
    </div>
  );

  const renderTradingFee = () => (
    <div className="mb-4">
      <h3 className="mb-1 text-lg font-semibold text-white">Trading Fee</h3>
      <p className="text-sm text-gray-300">
        {ammInfo?.trading_fee !== undefined
          ? `${ammInfo.trading_fee} basis points (${(ammInfo.trading_fee / 1000).toFixed(2)}%)`
          : "Unknown"}
      </p>
    </div>
  );

  return (
    <div>
      <Navbar />
      <div className="container mx-auto">

        <div className="flex gap-2 flex-row p-6">
          <CurrencyIcon
            symbol={ammInfo?.amount?.currency}
            heightClass="h-8"
            widthClass="w-8"
          />
          <CurrencyIcon
            symbol={ammInfo?.amount2?.currency}
            heightClass="h-8"
            widthClass="w-8"
          />
        </div>
        <div className="grid grid-cols-6 gap-4 p-6">
          {/* Top Stats Section */}
          <div className="col-span-2 rounded-xl bg-[#242639] p-4">
            Pool Composition
            <AmmCompositionBar amount1={ammInfo?.amount} amount2={ammInfo?.amount2}/>
            {renderPriceInfo()}
          </div>
          <div className="col-span-1 rounded-xl bg-[#242639] p-4">Pool Value</div>
          <div className="col-span-1 rounded-xl bg-[#242639] p-4">
            Volume (24h)
          </div>
          <div className="col-span-1 rounded-xl bg-[#242639] p-4">APR</div>
          <div className="col-span-1 rounded-xl bg-[#242639] p-4">
            {renderTradingFee()}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 px-6 pb-6">
          {/* Swap/Add/Withdraw Panel */}
          <div className="col-span-1 rounded-xl bg-[#242639] p-4">
            <div className="mb-4 flex gap-4">
              <button className="text-white">Swap</button>
              <button className="text-white">Add</button>
              <button className="text-white">Withdraw</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-[#2C2E44] p-4">Token A</div>
              <div className="rounded-lg bg-[#2C2E44] p-4">Token B</div>
            </div>
            <div className="mt-4 rounded-lg bg-[#2C2E44] p-4">Connect Wallet</div>
          </div>
          {/* Volume/TVL/Fees Graph */}
          <div className="col-span-2 rounded-xl bg-[#242639] p-4">
            Volume/TVL/Fees Chart
          </div>
        </div>
      </div>
    </div>
  );
}
