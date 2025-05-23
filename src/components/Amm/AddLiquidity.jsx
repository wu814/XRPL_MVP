import { useState } from "react";
import CurrencyIcon from "../CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";

export default function AddLiquidity({ ammInfo, wallets, onAdded }) {
  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  const [mode, setMode] = useState("quantity"); // 'quantity' or 'lp'
  const [amount1, setAmount1] = useState(""); 
  const [amount2, setAmount2] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [payWith, setPayWith] = useState("both"); // 'both', token1, token2

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);


  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      console.log(wallets);
      const walletSeed = wallets[0].seed;

      let depositType = null;
      const assetA = {
        currency: token1.currency,
        issuer: token1.issuer,
        value: amount1,
      };
      const assetB = {
        currency: token2.currency,
        issuer: token2.issuer,
        value: amount2,
      };
      let payload = {
        walletSeed,
        ammInfo,
      };

      // When user wants to add liquidity using quantity
      if (mode === "quantity") {
        if (amount1 && amount2) {
          depositType = "twoAsset";
          payload = { ...payload, depositType, assetA, assetB };
        } else if (amount1 && !amount2) {
          depositType = "oneAsset";
          payload = { ...payload, depositType, assetA };
        } else if (!amount1 && amount2) {
          depositType = "oneAsset";
          payload = { ...payload, depositType, assetA: assetB };
        } else {
          throw new Error("Enter at least one amount.");
        }
      }
      // When user wants to add liquidity using LP token amount
      else if (mode === "lp") {
        if (!lpAmount) throw new Error("Enter LP token amount.");

        const lpTokenOut = {
          currency: ammInfo.lp_token.currency,
          issuer: ammInfo.account,
          value: lpAmount,
        };

        if (payWith === "both") {
          depositType = "twoAssetLPToken";
          payload = { ...payload, depositType, assetA, assetB, lpTokenOut };
        } else if (payWith === token1.currency) {
          depositType = "oneAssetLPToken";
          payload = { ...payload, depositType, assetA, lpTokenOut };
        } else if (payWith === token2.currency) {
          depositType = "oneAssetLPToken";
          payload = { ...payload, depositType, assetA: assetB, lpTokenOut };
        } else {
          throw new Error("Invalid payWith value.");
        }
      }

      const res = await fetch("/api/amms/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(res.error || "Transaction failed.");
      // Need to show useful message later
      setSuccessMessage(
        result.message
      );
      // Tell parent component to refresh the AMM data
      onAdded();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex justify-end">
        <div className="bg-color3 flex space-x-2 rounded-full p-1">
          <button
            className={`rounded-full px-4 py-1 text-sm ${
              mode === "quantity" ? "bg-primary text-black" : "text-white"
            }`}
            onClick={() => setMode("quantity")}
          >
            Quantity
          </button>
          <button
            className={`rounded-full px-4 py-1 text-sm ${
              mode === "lp" ? "bg-primary text-black" : "text-white"
            }`}
            onClick={() => setMode("lp")}
          >
            LP Token
          </button>
        </div>
      </div>

      {mode === "quantity" ? (
        <>
          {/* Token A input */}
          <div className="bg-color3 flex items-center justify-between rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CurrencyIcon symbol={token1?.currency} />
            </div>
            <input
              type="number"
              placeholder="0"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              className="w-20 bg-transparent text-right text-white focus:outline-none"
            />
          </div>

          {/* Token B input */}
          <div className="bg-color3 flex items-center justify-between rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CurrencyIcon symbol={token2?.currency} />
            </div>
            <input
              type="number"
              placeholder="0"
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
              className="w-20 bg-transparent text-right text-white focus:outline-none"
            />
          </div>
        </>
      ) : (
        <>
          {/* LP Token amount input */}
          <div className="bg-color3 text-mutedText rounded-lg p-4">
            <label className="mb-2 block text-sm">
              Desired LP Token Amount
            </label>
            <input
              type="number"
              placeholder="0"
              value={lpAmount}
              onChange={(e) => setLpAmount(e.target.value)}
              className="bg-color2 w-full rounded p-2 text-right focus:outline-none"
            />
          </div>

          {/* Pay with options */}
          <div className="bg-color3 text-mutedText space-y-2 rounded-lg p-4">
            <label className="mb-2 block text-sm">Pay with</label>
            <div className="space-x-4">
              <label>
                <input
                  type="radio"
                  name="payWith"
                  value="both"
                  checked={payWith === "both"}
                  onChange={() => setPayWith("both")}
                />{" "}
                Both
              </label>
              <label>
                <input
                  type="radio"
                  name="payWith"
                  value={token1?.currency}
                  checked={payWith === token1?.currency}
                  onChange={() => setPayWith(token1?.currency)}
                />{" "}
                {token1?.currency}
              </label>
              <label>
                <input
                  type="radio"
                  name="payWith"
                  value={token2?.currency}
                  checked={payWith === token2?.currency}
                  onChange={() => setPayWith(token2?.currency)}
                />{" "}
                {token2?.currency}
              </label>
            </div>
          </div>
        </>
      )}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
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
