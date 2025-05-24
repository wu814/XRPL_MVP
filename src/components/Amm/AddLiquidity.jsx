import { useState, useMemo } from "react";
import BigNumber from "bignumber.js";
import CurrencyIcon from "../CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { parse } from "path";

export default function AddLiquidity({ ammInfo, wallets, onAdded }) {
  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  // UI State
  const [mode, setMode] = useState("quantity"); // 'quantity' or 'lp' mode toggle
  const [amount1, setAmount1] = useState(""); // User input for token1
  const [amount2, setAmount2] = useState(""); // User input for token2
  const [lpAmount, setLpAmount] = useState(""); // Desired LP tokens
  const [payWith, setPayWith] = useState("both"); // Which asset(s) to pay with

  // Feedback/UI flags
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /**
   * Calculates estimated required token amounts (for both-asset or one-asset LP deposit)
   * Includes slippage-aware logic for one-asset deposits
   */
    const estimatedAmounts = useMemo(() => {
    const totalLP = new BigNumber(ammInfo?.lp_token?.value);
    const poolA = new BigNumber(token1?.value);
    const poolB = new BigNumber(token2?.value);
    const desiredLP = new BigNumber(lpAmount);
    const fee = new BigNumber(ammInfo?.trading_fee).div(1000000);
    const weight = new BigNumber(0.5);

    if (
      desiredLP.isNaN() ||
      totalLP.isNaN() ||
      poolA.isNaN() ||
      poolB.isNaN()
    ) {
      return { assetA: null, assetB: null, singleAsset: null };
    }

    const ratio = desiredLP.div(totalLP);

    const assetA = {
      currency: token1.currency,
      issuer: token1.issuer,
      value: ratio.times(poolA).toFixed(6),
    };
    const assetB = {
      currency: token2.currency,
      issuer: token2.issuer,
      value: ratio.times(poolB).toFixed(6),
    };

    // xrpl doc on single asset deposit fee
    const computeLPFromSingleAsset = (B, P, T, F, W) => {
      const adjustedB = B.minus(F.times(new BigNumber(1).minus(W)).times(B));
      const base = new BigNumber(1).plus(adjustedB.div(P));
      const power = new BigNumber(Math.pow(base.toNumber(), 0.5));

      return T.times(power.minus(1));
    };

    const solveDepositAmount = (P, T, F, W, desiredL) => {
      let low = new BigNumber(0);
      let high = P.times(2);
      let mid;
      const epsilon = new BigNumber(1e-8);

      for (let i = 0; i < 100; i++) {
        mid = low.plus(high).div(2);
        const result = computeLPFromSingleAsset(mid, P, T, F, W);
        if (result.minus(desiredL).abs().lt(epsilon)) break;
        if (result.lt(desiredL)) low = mid;
        else high = mid;
      }
      return mid;
    };

    let singleAsset = null;
    let maxSingleAsset = null;

    if (payWith === token1.currency) {
      const value = solveDepositAmount(poolA, totalLP, fee, weight, desiredLP);
      singleAsset = {
        currency: token1.currency,
        issuer: token1.issuer,
        value: value.toFixed(6),
      };
      maxSingleAsset = {
        ...singleAsset,
        value: value.times(1.3).toFixed(6),
      };
    } else if (payWith === token2.currency) {
      const value = solveDepositAmount(poolB, totalLP, fee, weight, desiredLP);
      singleAsset = {
        currency: token2.currency,
        issuer: token2.issuer,
        value: value.toFixed(6),
      };
      maxSingleAsset = {
        ...singleAsset,
        value: value.times(1.3).toFixed(6),
      };
    }

    return { assetA, assetB, singleAsset, maxSingleAsset };
  }, [lpAmount, token1, token2, payWith, ammInfo]);

  /**
   * Builds the appropriate payload for the deposit API based on:
   * - Mode (quantity or LP)
   * - Deposit type (oneAsset, twoAsset, oneAssetLPToken, twoAssetLPToken)
   */
  const buildPayload = () => {
    // Assume only User and Standby Treasury are going to deposit into AMM
    const wallet = wallets.find(
      (wallet) =>
        wallet.walletType === "USER" ||
        wallet.walletType === "STANDBY TREASURY",
    );

    const walletSeed = wallet.seed;

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

    const basePayload = { walletSeed, ammInfo };

    if (mode === "quantity") {
      if (amount1 && amount2)
        return { ...basePayload, depositType: "twoAsset", assetA, assetB };
      if (amount1) return { ...basePayload, depositType: "oneAsset", assetA };
      if (amount2)
        return { ...basePayload, depositType: "oneAsset", assetA: assetB };
      throw new Error("Enter at least one amount.");
    }

    if (!lpAmount) throw new Error("Enter LP token amount.");

    const lpTokenOut = {
      currency: ammInfo.lp_token.currency,
      issuer: ammInfo.account,
      value: lpAmount,
    };

    if (payWith === "both") {
      return {
        ...basePayload,
        depositType: "twoAssetLPToken",
        assetA,
        assetB,
        lpTokenOut,
      };
    }

    // We are sending estimate * 1.3 for the maximum amount user is willing to send
    const oneAsset = estimatedAmounts.maxSingleAsset;
    if (!oneAsset) throw new Error("Unable to estimate one-asset deposit.");

    return {
      ...basePayload,
      depositType: "oneAssetLPToken",
      assetA: oneAsset,
      lpTokenOut,
    };
  };

  /**
   * Handles form submission by sending deposit request to the backend API
   */
  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = buildPayload();

      const res = await fetch("/api/amms/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(res.error || "Transaction failed.");
      setSuccessMessage(result.message);
      onAdded();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renders token input fields for 'quantity' mode
  const renderQuantityInputs = () => (
    <>
      {[
        { value: amount1, setValue: setAmount1, token: token1 },
        { value: amount2, setValue: setAmount2, token: token2 },
      ].map(({ value, setValue, token }, idx) => (
        <div
          key={idx}
          className="bg-color3 flex items-center justify-between rounded-lg p-4"
        >
          <div className="flex items-center gap-2">
            <CurrencyIcon symbol={token?.currency} />
          </div>
          <input
            type="number"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 bg-transparent text-right text-white focus:outline-none"
          />
        </div>
      ))}
    </>
  );

  // Renders LP amount and asset estimate for 'lp' mode
  const renderLPInputs = () => (
    <>
      {/* LP Token amount input */}
      <div className="bg-color3 text-mutedText rounded-lg p-4">
        <label className="mb-2 block text-sm">Desired LP Token Amount</label>
        <input
          type="number"
          placeholder="0"
          value={lpAmount}
          onChange={(e) => setLpAmount(e.target.value)}
          className="bg-color2 w-full rounded p-2 text-right focus:outline-none"
        />
      </div>

      {/* Estimated deposit value(s) display */}
      {lpAmount && (
        <div className="bg-color3 text-mutedText space-y-1 rounded-lg p-4 text-sm">
          {payWith === "both" ? (
            <>
              <p>
                Estimated: {estimatedAmounts.assetA.value} {token1.currency} +{" "}
                {estimatedAmounts.assetB.value} {token2.currency}
              </p>
            </>
          ) : (
            <>
              <p>
                Estimated: {estimatedAmounts.singleAsset?.value} {payWith}
              </p>
              <p>
                Max to send: {estimatedAmounts.maxSingleAsset?.value} {payWith}
              </p>
            </>
          )}
        </div>
      )}

      {/* Asset selection for one-asset LP mode */}
      <div className="bg-color3 text-mutedText space-y-2 rounded-lg p-4">
        <label className="mb-2 block text-sm">Pay with</label>
        <div className="space-x-4">
          {["both", token1?.currency, token2?.currency].map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="payWith"
                value={option}
                checked={payWith === option}
                onChange={() => setPayWith(option)}
              />{" "}
              {option}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Toggle between Quantity and LP Token modes */}
      <div className="flex justify-end">
        <div className="bg-color3 flex space-x-2 rounded-full p-1">
          {["quantity", "lp"].map((type) => (
            <button
              key={type}
              className={`rounded-full px-4 py-1 text-sm ${
                mode === type ? "bg-primary text-black" : "text-white"
              }`}
              onClick={() => setMode(type)}
            >
              {type === "quantity" ? "Quantity" : "LP Token"}
            </button>
          ))}
        </div>
      </div>

      {/* Render relevant input section based on selected mode */}
      {mode === "quantity" ? renderQuantityInputs() : renderLPInputs()}

      {/* Submit button */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </Button>
      </div>

      {/* Feedback Modals */}
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
