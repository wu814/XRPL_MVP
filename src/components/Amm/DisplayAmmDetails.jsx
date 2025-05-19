import { useEffect, useState } from "react";
import ErrorMdl from "../ErrorMdl";

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
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmmInfo();
  }, [ammAddress]);

  const renderAssetSection = (title, asset) => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-300">Currency: {asset?.currency || "Unknown"}</p>
      {asset?.currency !== "XRP" && asset?.issuer && (
        <p className="text-sm text-gray-300">Issuer: {asset.issuer}</p>
      )}
      <p className="text-sm text-gray-300">Balance: {asset?.value || "0"}</p>
    </div>
  );

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
        <h3 className="text-lg font-semibold text-white mb-1">Price Information</h3>
        <p className="text-sm text-gray-300">1 {s1} = {price1} {s2}</p>
        <p className="text-sm text-gray-300">1 {s2} = {price2} {s1}</p>
      </div>
    );
  };

  const renderLPToken = () => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white mb-1">LP Token</h3>
      <p className="text-sm text-gray-300">Currency: {ammInfo?.lp_token?.currency || "Unknown"}</p>
      <p className="text-sm text-gray-300">Issuer: {ammInfo?.lp_token?.issuer || "Unknown"}</p>
      <p className="text-sm text-gray-300">Total Supply: {ammInfo?.lp_token?.value || "0"}</p>
    </div>
  );

  const renderTradingFee = () => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-white mb-1">Trading Fee</h3>
      <p className="text-sm text-gray-300">
        {ammInfo?.trading_fee !== undefined
          ? `${ammInfo.trading_fee} basis points (${(ammInfo.trading_fee / 1000).toFixed(2)}%)`
          : "Unknown"}
      </p>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1C2033] p-8 text-white">
      <h2 className="text-2xl font-bold mb-6">AMM Details</h2>

      {loading && <p className="text-gray-400">Loading AMM info...</p>}

      {!loading && ammInfo && (
        <div className="w-full max-w-xl space-y-6 rounded-lg bg-[#2A2F45] p-6 shadow-md">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-1">AMM Account</h3>
            <p className="text-sm text-gray-300">{ammAddress}</p>
          </div>

          {renderAssetSection("Asset 1", ammInfo.amount)}
          {renderAssetSection("Asset 2", ammInfo.amount2)}
          {renderPriceInfo()}
          {renderLPToken()}
          {renderTradingFee()}
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
