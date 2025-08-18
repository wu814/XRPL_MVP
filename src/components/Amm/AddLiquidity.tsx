"use client";

import { useState, useMemo } from "react";
import CurrencyIcon from "../currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import estimateDepositAmounts from "@/utils/xrpl/amm/estimateDepositAmount";
import { useCurrentUserWallet } from "../wallet/CurrentUserWalletProvider";
import { Settings, Loader2 } from "lucide-react";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { EstimateDepositAmountsResult } from "@/types/helperTypes";
import { AddLiquidityAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { CheckTrustlineAPIResponse, SetLPTrustlineAPIResponse } from "@/types/api/trustlineAPITypes";



interface AddLiquidityProps {
  ammInfo: FormattedAMMInfo;
  onAdded: () => void;
}

type Mode = "quantity" | "lp";
type PayWith = "both" | string;

export default function AddLiquidity({ ammInfo, onAdded }: AddLiquidityProps) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();

  const currency1 = ammInfo?.formattedAmount1.currency;
  const currency2 = ammInfo?.formattedAmount2.currency;

  // UI State
  const [mode, setMode] = useState<Mode>("quantity"); // 'quantity' or 'lp' mode toggle
  const [addValue1, setAddValue1] = useState<number | null>(null); // User input for amount.value
  const [addValue2, setAddValue2] = useState<number | null>(null); // User input for amount2.value
  const [lpTokenValue, setLPTokenValue] = useState<number | null>(null); // Desired LP tokens
  const [payWith, setPayWith] = useState<PayWith>("both"); // Which asset(s) to pay with

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState<boolean>(false);
  const [slippagePercentage, setSlippagePercentage] = useState<number>(0); // Default slippage tolerance 0%

  // Feedback/UI flags
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  /**
   * Calculates estimated required token amounts (for both-asset or one-asset LP deposit)
   * Includes slippage-aware logic for one-asset deposits
   */
  const estimatedAmounts = useMemo((): EstimateDepositAmountsResult => {
    return estimateDepositAmounts(
      ammInfo,
      lpTokenValue,
      payWith,
      slippagePercentage,
    );
  }, [ammInfo, lpTokenValue, payWith, slippagePercentage]);

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

    if (!wallet) {
      throw new Error("No suitable wallet found for liquidity deposit.");
    }

    const basePayload = { wallet, ammInfo };

    if (mode === "quantity") {

      if (addValue1 && addValue2) {
        return { ...basePayload, depositType: "twoAsset", addValue1: addValue1.toString(), addValue2: addValue2.toString() };
      }
      if (addValue1) {
        return { ...basePayload, depositType: "oneAsset", addValue1: addValue1.toString(), selectedCurrency: ammInfo?.formattedAmount1.currency };
      }
      if (addValue2) {
        return { ...basePayload, depositType: "oneAsset", addValue1: addValue2.toString(), selectedCurrency: ammInfo?.formattedAmount2.currency };
      }
      if (!addValue1 && !addValue2) {
        setErrorMessage("Enter at least one amount greater than 0.");
        return;
      }
    }

    else if (mode === "lp") {
      if (!lpTokenValue) {
        setErrorMessage("Enter LP token amount.");
        return;
      }
  
      if (payWith === "both") {
        return {
          ...basePayload,
          depositType: "twoAssetLPToken",
          addValue1: estimatedAmounts.amount1?.value,
          addValue2: estimatedAmounts.amount2?.value,
          lpTokenValue: lpTokenValue.toString(),
        };
      }
  
      // We are sending estimate * slippage for the maximum amount user is willing to send
      const oneAsset = estimatedAmounts.maxSingleAmount;
      if (!oneAsset) throw new Error("Unable to estimate one-asset deposit.");
  
      return {
        ...basePayload,
        depositType: "oneAssetLPToken",
        addValue1: oneAsset.value,
        selectedCurrency: payWith,
        lpTokenValue: lpTokenValue.toString(),
      };
    }
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

      // Step 1: Check if trustline exists
      const checkResponse = await fetch("/api/trustline/checkTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: payload.wallet.classicAddress,
          destination: ammInfo.account,
          currency: ammInfo.lpToken.currency,
        }),
      });
      if (!checkResponse.ok) {
        const errorData: APIErrorResponse = await checkResponse.json();
        setErrorMessage(errorData.message);
        return;
      }

      const { hasTrustline }: CheckTrustlineAPIResponse = await checkResponse.json();

      if (!hasTrustline) {
        setLoadingMessage("Setting up LP trustline...");

        const setTrustlineResponse = await fetch("/api/trustline/setLPTrustline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setterWallet: payload.wallet,
            lpToken: payload.ammInfo.lpToken, 
          }),
        });

        const trustlineResult: SetLPTrustlineAPIResponse = await setTrustlineResponse.json();
        if (!setTrustlineResponse.ok) {
          const errorData: APIErrorResponse = await setTrustlineResponse.json();
          setErrorMessage(errorData.message);
          return;
        }

        setLoadingMessage(trustlineResult.message);
      }

      setLoadingMessage("Adding liquidity...");
      // Step 2: Add liquidity
      const addLiquidityResponse = await fetch("/api/amm/addLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!addLiquidityResponse.ok) {
        const errorData: APIErrorResponse = await addLiquidityResponse.json();
        setErrorMessage(errorData.message);
        return;
      }
      const addLiquidityResult: AddLiquidityAPIResponse = await addLiquidityResponse.json();
      setSuccessMessage(addLiquidityResult.message || "Liquidity added successfully!");

      onAdded();
    } catch (err: any) {
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
        { value: addValue1, setValue: setAddValue1, currency: ammInfo?.formattedAmount1.currency },
        { value: addValue2, setValue: setAddValue2, currency: ammInfo?.formattedAmount2.currency },
      ].map(({ value, setValue, currency }, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between rounded-lg bg-color3 p-4 border border-transparent hover:border-gray-500 focus-within:!border-primary"
        >
          <div className="flex items-center gap-2">
            <CurrencyIcon symbol={currency} iconBg="bg-color4" />
          </div>
          <input
            type="number"
            step="0.000001"
            placeholder="0.00"
            value={value ?? ""}
            onChange={(e) => setValue(e.target.value === "" ? null : Number(e.target.value))}
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
          value={lpTokenValue ?? ""}
          onChange={(e) => setLPTokenValue(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full bg-transparent focus:outline-none text-xl"
        />
      </div>

      {/* Estimated deposit value(s) display */}
      {lpTokenValue && (
        <div className="space-y-1 rounded-lg bg-color3 p-4 text-sm text-mutedText">
          {payWith === "both" ? (
            <>
              <p>
                Estimated cost: {estimatedAmounts.amount1?.value}{" "}
                {currency1} + {estimatedAmounts.amount2?.value}{" "}
                {currency2}
              </p>
            </>
          ) : (
            <>
              <p>
                Estimated cost: {estimatedAmounts.singleAmount?.value} {payWith}
              </p>
              <p>
                Max to send ({slippagePercentage}% slippage): {estimatedAmounts.maxSingleAmount?.value}{" "}
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
          {["both", currency1, currency2].map((option, index) => (
            <label key={`${option}-${index}`}>
              <input
                type="radio"
                name="payWith"
                value={option}
                checked={payWith === option}
                onChange={() => setPayWith(option || "both")}
              />{" "}
              {option}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  const isFormValid = mode === "quantity" 
    ? (addValue1 > 0 || addValue2 > 0)
    : (lpTokenValue && (payWith === "both" || estimatedAmounts.maxSingleAmount));

  return (
    <div className="space-y-4">
      {/* Toggle between Quantity and LP Token modes */}
      <div className="relative flex justify-between">
        <div className="flex space-x-1 rounded-full bg-color3 p-1">
          {(["quantity", "lp"] as Mode[]).map((type) => (
            <button
              key={type}
              className={`rounded-full px-4 py-1 text-sm ${
                mode === type ? "bg-primary/20 text-primary border border-primary" : "text-gray-300 hover:text-white"
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
            slippage={slippagePercentage}
            setSlippage={setSlippagePercentage}
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
};
