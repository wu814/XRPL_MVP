import { use, useState, useEffect } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useWallet } from "../WalletContext";

export default function WithdrawLiquidity({ ammInfo, wallets, onWithdrawn }) {
  const { treasuryWallet } = useWallet();
  const [mode, setMode] = useState("twoAsset");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [assetType, setAssetType] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  const buildPayload = () => {
    const payload = {
      mode,
      standbyWalletSeed: treasuryWallet.seed,
      ammInfo,
    };

    if (mode === "twoAsset") {
      return { ...payload, minA: amountA, minB: amountB };
    }
    if (mode === "lpToken") {
      return { ...payload, lpTokenAmount };
    }
    if (mode === "all") {
      return payload;
    }
    if (mode === "singleAsset") {
      return { ...payload, assetType, withdrawAmount };
    }
    if (mode === "singleAssetAll") {
      return { ...payload, assetType, withdrawAmount: null };
    }
    if (mode === "singleAssetLp") {
      return { ...payload, assetType, lpTokenAmount };
    }
    throw new Error("Unsupported mode selected");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = buildPayload();

      const res = await fetch("/api/amms/withdrawLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Transaction failed");
      }

      setSuccessMessage("Liquidity withdrawn successfully!");
      onWithdrawn();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="rounded bg-color3 p-2"
      >
        <option value="twoAsset">Two Asset Withdraw</option>
        <option value="lpToken">LP Token Withdraw</option>
        <option value="all">Withdraw All</option>
        <option value="singleAsset">Single Asset Withdraw</option>
        <option value="singleAssetAll">Single Asset Withdraw All</option>
        <option value="singleAssetLp">Single Asset LP Withdraw</option>
      </select>

      {mode === "twoAsset" && (
        <>
          <input value={amountA} onChange={(e) => setAmountA(e.target.value)} placeholder="Min A" className="w-full rounded p-2 bg-color3" />
          <input value={amountB} onChange={(e) => setAmountB(e.target.value)} placeholder="Min B" className="w-full rounded p-2 bg-color3" />
        </>
      )}

      {mode.includes("singleAsset") && (
        <>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className="w-full rounded p-2 bg-color3"
          >
            <option value={token1?.currency}>{token1?.currency}</option>
            <option value={token2?.currency}>{token2?.currency}</option>
          </select>
          {mode !== "singleAssetAll" && (
            <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Withdraw Amount" className="w-full rounded p-2 bg-color3" />
          )}
        </>
      )}

      {(mode === "lpToken" || mode === "singleAssetLp") && (
        <input
          value={lpTokenAmount}
          onChange={(e) => setLpTokenAmount(e.target.value)}
          placeholder="LP Token Amount"
          className="w-full rounded p-2 bg-color3"
        />
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Withdrawing..." : "Withdraw"}
        </Button>
      </div>

      {errorMessage && <ErrorMdl errorMessage={errorMessage} onClose={() => setErrorMessage(null)} />}
      {successMessage && <SuccessMdl successMessage={successMessage} onClose={() => setSuccessMessage(null)} />}
    </div>
  );
}
