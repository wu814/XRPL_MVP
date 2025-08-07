import { useState, useMemo, useEffect } from "react";
import BigNumber from "bignumber.js";
import CurrencyIcon from "../Currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import estimateDepositAmounts from "@/utils/xrpl/amm/estimateDepositAmount";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { Settings, Loader2 } from "lucide-react";
import { formatAPICurrencyObj } from "@/utils/currencyUtils";

export default function AddLiquidity({ ammInfo, onAdded }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();

  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  // UI State
  const [mode, setMode] = useState("quantity"); // 'quantity' or 'lp' mode toggle
  const [amount1, setAmount1] = useState(""); // User input for token1
  const [amount2, setAmount2] = useState(""); // User input for token2
  const [lpAmount, setLpAmount] = useState(""); // Desired LP tokens
  const [payWith, setPayWith] = useState("both"); // Which asset(s) to pay with

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [slippage, setSlippage] = useState("0"); // Default slippage tolerance 0%

  // Feedback/UI flags
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(null);

  /**
   * Calculates estimated required token amounts (for both-asset or one-asset LP deposit)
   * Includes slippage-aware logic for one-asset deposits
   */
  const estimatedAmounts = useMemo(() => {
    return estimateDepositAmounts({
      token1,
      token2,
      ammInfo,
      lpAmount,
      payWith,
      slippage,
    });
  }, [token1, token2, ammInfo, lpAmount, payWith, slippage]);

  /**
   * Builds the appropriate payload for the deposit API based on:
   * - Mode (quantity or LP)
   * - Deposit type (oneAsset, twoAsset, oneAssetLPToken, twoAssetLPToken)
   */
  const buildPayload = () => {
    // Assume only User and Treasury are going to deposit into AMM
    const wallet = currentUserWallets.find(
      (wallet) =>
        wallet.walletType === "USER" ||
        wallet.walletType === "BUSINESS" ||
        wallet.walletType === "TREASURY",
    );

    const assetA = formatAPICurrencyObj(token1.currency, token1.issuer, amount1);
    const assetB = formatAPICurrencyObj(token2.currency, token2.issuer, amount2);

    const basePayload = { wallet, ammInfo };

    if (mode === "quantity") {
      const val1 = parseFloat(amount1 || "0");
      const val2 = parseFloat(amount2 || "0");

      if (val1 > 0 && val2 > 0) {
        return { ...basePayload, depositType: "twoAsset", assetA, assetB };
      }
      if (val1 > 0) {
        return { ...basePayload, depositType: "oneAsset", assetA };
      }
      if (val2 > 0) {
        return { ...basePayload, depositType: "oneAsset", assetA: assetB };
      }
      throw new Error("Enter at least one amount greater than 0.");
    }

    if (!lpAmount) throw new Error("Enter LP token amount.");

    const lpTokenOut = formatAPICurrencyObj(ammInfo.lp_token.currency, ammInfo.account, lpAmount);

    if (payWith === "both") {
      return {
        ...basePayload,
        depositType: "twoAssetLPToken",
        assetA: estimatedAmounts.assetA,
        assetB: estimatedAmounts.assetB,
        lpTokenOut,
      };
    }

    // We are sending estimate * slippage for the maximum amount user is willing to send
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
    setSuccessMessage(null);
    setLoadingMessage(null);

    try {
      const payload = buildPayload();
      console.log("payload", payload);

      // Step 1: Check if trustline exists
      const checkRes = await fetch("/api/trustlines/checkTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: payload.wallet,
          destination: ammInfo.account,
          currency: ammInfo.lp_token.currency,
        }),
      });

      const { hasTrustline } = await checkRes.json();

      if (!hasTrustline) {
        setLoadingMessage("Setting up LP trustline...");

        const res = await fetch("/api/trustlines/setLPTrustline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setterWallet: payload.wallet,
            ammInfo: payload.ammInfo,
          }),
        });

        const trustlineResult = await res.json();
        if (!res.ok)
          throw new Error(
            trustlineResult.error || "Failed to set LP trustline.",
          );

        setLoadingMessage("✅ LP trustline set successfully.");
      }

      setLoadingMessage("Adding liquidity...");
      // Step 2: Add liquidity
      const res = await fetch("/api/amms/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Liquidity deposit failed.");
      setSuccessMessage(result.output || "Liquidity added successfully!");

      onAdded();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage(null);
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
          className="flex items-center justify-between rounded-lg bg-color3 p-4 border border-transparent hover:border-gray-500 focus-within:!border-primary"
        >
          <div className="flex items-center gap-2">
            <CurrencyIcon symbol={token?.currency} iconBg="bg-color4" />
          </div>
          <input
            type="number"
            step="0.000001"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-transparent text-right focus:outline-none text-xl"
          />
        </div>
      ))}
    </>
  );

  // Renders LP amount and asset estimate for 'lp' mode
  const renderLPInputs = () => (
    <>
      {/* LP Token amount input */}
      <div className="rounded-lg bg-color3 p-4 border border-transparent hover:border-gray-500 focus-within:!border-primary">
        <label className="mb-2 block text-sm text-mutedText">Desired LP Token Amount</label>
        <input
          type="number"
          step="0.000001"
          placeholder="0.00"
          value={lpAmount}
          onChange={(e) => setLpAmount(e.target.value)}
          className="w-full bg-transparent focus:outline-none text-xl"
        />
      </div>

      {/* Estimated deposit value(s) display */}
      {lpAmount && (
        <div className="space-y-1 rounded-lg bg-color3 p-4 text-sm text-mutedText">
          {payWith === "both" ? (
            <>
              <p>
                Estimated cost: {estimatedAmounts.assetA.value}{" "}
                {token1.currency} + {estimatedAmounts.assetB.value}{" "}
                {token2.currency}
              </p>
            </>
          ) : (
            <>
              <p>
                Estimated cost: {estimatedAmounts.singleAsset?.value} {payWith}
              </p>
              <p>
                Max to send (slippage): {estimatedAmounts.maxSingleAsset?.value}{" "}
                {payWith}
              </p>
            </>
          )}
        </div>
      )}

      {/* Asset selection for one-asset LP mode */}
      <div className="space-y-2 rounded-lg bg-color3 p-4 border border-transparent hover:border-gray-500 focus-within:!border-primary">
        <label className="mb-2 block text-sm text-mutedText ">Pay with</label>
        <div className="space-x-4">
          {["both", token1?.currency, token2?.currency].map((option, index) => (
            <label key={`${option}-${index}`}>
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

  const isFormValid = useMemo(() => {
    if (mode === "quantity") {
      const val1 = parseFloat(amount1 || "0");
      const val2 = parseFloat(amount2 || "0");
      return val1 > 0 || val2 > 0;
    } else {
      if (!lpAmount) return false;
      if (payWith === "both") return true;
      return !!estimatedAmounts.maxSingleAsset;
    }
  }, [mode, amount1, amount2, lpAmount, payWith, estimatedAmounts.maxSingleAsset]);

  return (
    <div className="space-y-4">
      {/* Toggle between Quantity and LP Token modes */}
      <div className="relative flex justify-between">
        <div className="flex space-x-1 rounded-full bg-color3 p-1">
          {["quantity", "lp"].map((type) => (
            <button
              key={type}
              className={`rounded-full px-4 py-1 text-sm ${
                mode === type ? "bg-primary text-black" : "text-gray-300 hover:text-white"
              }`}
              onClick={() => setMode(type)}
            >
              {type === "quantity" ? "Quantity" : "LP Token"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowSlippagePanel((prev) => !prev)} className="p-2 hover:bg-color3 rounded-lg transition-colors hover:text-white text-gray-400">
          <Settings className="w-5 h-5" /> 
        </button>
        {showSlippagePanel && (
          <SlippagePanel
            slippage={slippage}
            setSlippage={setSlippage}
            onClose={() => setShowSlippagePanel(false)}
          />
        )}
      </div>

      {/* Render relevant input section based on selected mode */}
      {mode === "quantity" ? renderQuantityInputs() : renderLPInputs()}

      {/* Display trustline message if applicable */}
      {loadingMessage && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingMessage}
        </div>
      )}

      {/* Submit button */}
      <div className="flex">
        <Button variant="primary" onClick={handleSubmit} disabled={loading || !isFormValid} className="w-full">
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Adding Liquidity...</span>
            </div>
          ) : (
            "Add Liquidity"
          )}
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
