"use client";

import { useState, useEffect, ChangeEvent } from "react";
import CurrencyIcon from "../currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import { Settings, ArrowUpDown, Loader2 } from "lucide-react";
import { useCurrentUserWallet } from "../wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../wallet/IssuerWalletProvider";
// Import calculation functions
import { calculateExactAMMInput, calculateEstimateOutput } from "@/utils/xrpl/amm/calculations";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";


interface SwapResponse {
  message?: string;
  error?: string;
}

interface CalculationResult {
  success: boolean;
  estimatedOutput?: number;
  inputWithSlippage?: number;
  error?: string;
}

interface SwapLiquidityProps {
  ammInfo: FormattedAMMInfo;
  onSwapped: () => void;
}

type ActiveInput = "sell" | "buy";
type SwapInputType = "exact_input" | "exact_output";

export default function SwapLiquidity({ ammInfo, onSwapped }: SwapLiquidityProps) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // UI State
  const [sellCurrency, setSellCurrency] = useState<string>("");
  const [buyCurrency, setBuyCurrency] = useState<string>("");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [activeInput, setActiveInput] = useState<ActiveInput>("sell");

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0); // Default slippage tolerance 0%

  // Feedback/UI flags
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Whether user want to sell a fixed amount or receive a fixed amount
  const [swapInputType, setSwapInputType] = useState<SwapInputType>("exact_input"); // default to exact_input

  // Add calculation states
  const [calculatingAmounts, setCalculatingAmounts] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Auto-select currencies when component mounts
  useEffect(() => {
    setSellCurrency(ammInfo?.formattedAmount1?.currency || "");
    setBuyCurrency(ammInfo?.formattedAmount2?.currency || "");
    console.log(ammInfo);
  }, [ammInfo]);

  // Calculate output when sell amount changes
  useEffect(() => {
    if (sellAmount && parseFloat(sellAmount) > 0 && sellCurrency && buyCurrency && 
        sellCurrency !== buyCurrency && activeInput === "sell" && ammInfo) {
      calculateOutput();
    }
  }, [sellAmount, sellCurrency, buyCurrency, activeInput, ammInfo]);

  // Calculate input when buy amount changes
  useEffect(() => {
    if (buyAmount && parseFloat(buyAmount) > 0 && sellCurrency && buyCurrency && 
        sellCurrency !== buyCurrency && activeInput === "buy" && ammInfo) {
      calculateInput();
    }
  }, [buyAmount, sellCurrency, buyCurrency, activeInput, slippage, ammInfo]);

  const calculateOutput = async () => {
    if (!ammInfo) return;

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {      
      // Determine pool balances from passed ammInfo
      let poolSell: number, poolBuy: number;
      if (ammInfo.formattedAmount1?.currency === sellCurrency) {
        poolSell = parseFloat(ammInfo.formattedAmount1.value);
        poolBuy = parseFloat(ammInfo.formattedAmount2.value);
      } else {
        poolSell = parseFloat(ammInfo.formattedAmount2.value);
        poolBuy = parseFloat(ammInfo.formattedAmount1.value);
      }

      // Calculate estimated output
      const calculation = calculateEstimateOutput(poolSell, poolBuy, sellAmount, (ammInfo.tradingFee || 0) / 100000);
      
      if (calculation.success && calculation.estimatedOutput !== undefined) {
        setBuyAmount(calculation.estimatedOutput.toFixed(6));
      } else {
        throw new Error(calculation.error || "Calculation failed");
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setBuyAmount("");
    } finally {
      setCalculatingAmounts(false);
    }
  };

  const calculateInput = async () => {
    if (!ammInfo) return;

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {
      // Determine pool balances from passed ammInfo
      let poolSell: number, poolBuy: number;
      if (ammInfo.formattedAmount1?.currency === sellCurrency) {
        poolSell = parseFloat(ammInfo.formattedAmount1.value);
        poolBuy = parseFloat(ammInfo.formattedAmount2.value);
      } else {
        poolSell = parseFloat(ammInfo.formattedAmount2.value);
        poolBuy = parseFloat(ammInfo.formattedAmount1.value);
      }

      // Calculate required input
      const calculation = calculateExactAMMInput(
        poolSell, 
        poolBuy, 
        parseFloat(buyAmount), 
        slippage / 100, 
        ammInfo.tradingFee / 100000 || 0
      );
      
      if (calculation.success && calculation.inputWithSlippage !== undefined) {
        setSellAmount(calculation.inputWithSlippage.toFixed(6));
      } else {
        throw new Error(calculation.error || "Calculation failed");
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setSellAmount("");
    } finally {
      setCalculatingAmounts(false);
    }
  };

  // Update handlers to set the type
  const handleSellAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setActiveInput("sell");
    setSellAmount(e.target.value);
    setBuyAmount(""); // Clear the other field
    setSwapInputType("exact_input");
  };

  const handleBuyAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setActiveInput("buy");
    setBuyAmount(e.target.value);
    setSellAmount(""); // Clear the other field
    setSwapInputType("exact_output");
  };

  // Reset amounts when sell currency changes
  useEffect(() => {
    setSellAmount("");
    setBuyAmount("");
    setCalculationError(null);
  }, [sellCurrency]);

  // Reset amounts when buy currency changes  
  useEffect(() => {
    setSellAmount("");
    setBuyAmount("");
    setCalculationError(null);
  }, [buyCurrency]);

  const handleSwap = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const wallet = currentUserWallets.find(
        (wallet) =>
          wallet.walletType === "USER" ||
          wallet.walletType === "BUSINESS" ||
          wallet.walletType === "TREASURY",
      );

      if (!wallet) {
        throw new Error("No suitable wallet found");
      }

      if (!issuerWallets || issuerWallets.length === 0) {
        throw new Error("No issuer wallets available");
      }

      const response = await fetch("/api/amm/swapLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderWallet: wallet,
          sendCurrency: sellCurrency,
          sendAmount: sellAmount,
          receiveCurrency: buyCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: slippage,
          paymentType: swapInputType,
          exactOutputAmount: swapInputType === "exact_output" ? buyAmount : undefined,
        }),
      });

      const result: SwapResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Swap failed");
      }

      setSuccessMessage(result.message || "Swap completed successfully!");
      onSwapped(); // Refresh parent component

      // Reset form
      setSellAmount("");
      setBuyAmount("");
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencySwap = () => {
    const temp = sellCurrency;
    setSellCurrency(buyCurrency);
    setBuyCurrency(temp);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setActiveInput("sell");
  };

  const canSwap = sellCurrency && buyCurrency && 
    ((sellAmount && parseFloat(sellAmount) > 0) || (buyAmount && parseFloat(buyAmount) > 0)) &&
    ammInfo;

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-end">
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

      {/* Show calculation error if any */}
      {calculationError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm">Calculation Error: {calculationError}</p>
        </div>
      )}

      {/* Amount Inputs */}
      <div>
        <div className="flex items-center justify-between rounded-lg border border-transparent bg-color3 p-4 hover:border-gray-500 focus-within:!border-primary">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-mutedText">Sell</label>
            {sellCurrency && (
              <CurrencyIcon symbol={sellCurrency} iconBg="bg-color4" />
            )}
          </div>
          <input
            type="number"
            step="0.000001"
            value={sellAmount}
            onChange={handleSellAmountChange}
            placeholder="0.00"
            className={`bg-transparent text-right text-xl focus:outline-none ${
              (!!buyAmount && activeInput === "buy") || calculatingAmounts ? "cursor-not-allowed opacity-60" : ""
            }`}
            min="0"
            disabled={(!!buyAmount && activeInput === "buy") || calculatingAmounts}
          />
        </div>
      </div>

      {/* Up/Down Arrow between inputs */}
      <div className="flex justify-center">
        <button
          onClick={handleCurrencySwap}
          className="hover:bg-color4 p-3 bg-color3 rounded-full transition-colors"
          disabled={!sellCurrency || !buyCurrency || calculatingAmounts}
        >
          <ArrowUpDown className="h-6 w-6 text-gray-400" />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-transparent bg-color3 p-4 hover:border-gray-500 focus-within:!border-primary">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-mutedText">Buy</label>
          {buyCurrency && (
            <CurrencyIcon symbol={buyCurrency} iconBg="bg-color4" />
          )}
        </div>
        <input
          type="number"
          step="0.000001"
          value={buyAmount}
          onChange={handleBuyAmountChange}
          placeholder="0.00"
          className={`bg-transparent text-right text-xl focus:outline-none ${
            (!!sellAmount && activeInput === "sell") || calculatingAmounts ? "cursor-not-allowed opacity-60" : ""
          }`}
          min="0"
          disabled={(!!sellAmount && activeInput === "sell") || calculatingAmounts}
        />
      </div>

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!canSwap || loading || calculatingAmounts}
        className="w-full"
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Swapping...</span>
          </div>
        ) : calculatingAmounts ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Calculating...</span>
          </div>
        ) : (
          "Swap"
        )}
      </Button>

      {/* Error Modal */}
      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
};
