import { use, useState, useEffect } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useRouter } from "next/navigation";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";

export default function WithdrawLiquidity({ ammInfo, onWithdrawn }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();

  const router = useRouter();

  const [mode, setMode] = useState("twoAsset");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpTokenAmount, setLpTokenAmount] = useState("");
  const [assetType, setAssetType] = useState(ammInfo?.amount?.currency);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  const buildPayload = () => {
    const currentWalletSeed = currentUserWallets.find(
      (wallet) =>
        wallet.walletType === "USER" ||
        wallet.walletType === "STANDBY TREASURY",
    )?.seed;
    if (!currentWalletSeed) {
      throw new Error("No valid wallet found for the current user");
    }
    const payload = {
      mode,
      currentWalletSeed,
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
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Transaction failed");
      }
      setSuccessMessage(result.message);

      if (result.poolDeleted) {
        // ⏳ Show initial message for 5 seconds
        setTimeout(() => {
          // 📝 Then update message
          setSuccessMessage(
            "Liquidity withdrawn successfully! Pool is now empty! Redirecting to Liquidity Pool page...",
          );

          // ⏳ Wait another 5 seconds before redirecting
          setTimeout(() => {
            router.push("/trade/amm");
          }, 5000);
        }, 3000);
      } else {
        onWithdrawn();
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    console.log(currentUserWallets);
  }, [currentUserWallets]);

  return (
    <div className="space-y-4 text-lg">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className="mt-1 rounded-lg border border-transparent bg-color3 p-2 focus:border-primary focus:outline-none hover:border-primary"
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
          <input
            type="number"
            value={amountA}
            onChange={(e) => setAmountA(e.target.value)}
            placeholder={`Desire ${token1?.currency || "Token A"} amount`}
            className="bg-color3 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
          />
          <input
            type="number"
            value={amountB}
            onChange={(e) => setAmountB(e.target.value)}
            placeholder={`Desire ${token2?.currency || "Token B"} amount`}
            className="bg-color3 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
          />
        </>
      )}

      {mode.includes("singleAsset") && (
        <>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-transparent bg-color3 p-2 focus:border-primary focus:outline-none hover:border-primary"
          >
            <option value={token1?.currency}>{token1?.currency}</option>
            <option value={token2?.currency}>{token2?.currency}</option>
          </select>
          {mode !== "singleAssetAll" && mode != "singleAssetLp" && (
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Withdraw Amount"
              className="bg-color3 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
            />
          )}
        </>
      )}

      {(mode === "lpToken" || mode === "singleAssetLp") && (
        <input
          type="number"
          value={lpTokenAmount}
          onChange={(e) => setLpTokenAmount(e.target.value)}
          placeholder="LP Token Amount"
          className="bg-color3 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
        />
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? "Withdrawing..." : "Withdraw"}
        </Button>
      </div>

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
