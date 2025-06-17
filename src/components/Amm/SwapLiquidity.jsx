import { useState, useMemo, useEffect } from "react";
import CurrencyIcon from "../Currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";

export default function SwapLiquidity({ ammInfo, onSwapped }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();

  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  // UI State
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [estimatedOutput, setEstimatedOutput] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [pathType, setPathType] = useState("");

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [slippage, setSlippage] = useState("5"); // Default slippage tolerance 5%

  // Feedback/UI flags
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(null);

  // Available currencies from the AMM - these are fixed
  const availableCurrencies = useMemo(() => {
    const currencies = [];
    if (token1) {
      currencies.push({
        currency: token1.currency,
        issuer: token1.issuer,
        displayName: token1.currency,
      });
    }
    if (token2) {
      currencies.push({
        currency: token2.currency,
        issuer: token2.issuer,
        displayName: token2.currency,
      });
    }
    return currencies;
  }, [token1, token2]);

  // Auto-select currencies when component mounts
  useEffect(() => {
    if (availableCurrencies.length >= 2 && !fromCurrency && !toCurrency) {
      setFromCurrency(availableCurrencies[0].currency);
      setToCurrency(availableCurrencies[1].currency);
    }
  }, [availableCurrencies, fromCurrency, toCurrency]);

  // Calculate estimated output when inputs change
  useEffect(() => {
    if (
      fromCurrency &&
      toCurrency &&
      fromAmount &&
      parseFloat(fromAmount) > 0
    ) {
      calculateSwapEstimate();
    } else {
      setEstimatedOutput("");
      setExchangeRate("");
      setPathType("");
    }
  }, [fromCurrency, toCurrency, fromAmount]);

  const calculateSwapEstimate = async () => {
    try {
      setLoading(true);

      const wallet = currentUserWallets.find(
        (wallet) =>
          wallet.walletType === "USER" ||
          wallet.walletType === "STANDBY TREASURY",
      );

      if (!wallet) {
        throw new Error("No suitable wallet found");
      }

      const issuerAddress = ammInfo.amount?.issuer || ammInfo.amount2?.issuer;

      const response = await fetch("/api/amms/swapLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletSeed: wallet.seed,
          ammInfo,
          fromCurrency,
          toCurrency,
          fromAmount,
          slippagePercent: parseFloat(slippage),
          estimateOnly: true, // Add this flag to only get estimate, not execute
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to calculate swap estimate");
      }

      const result = await response.json();

      if (result.pathfindingResult?.success) {
        setEstimatedOutput(result.pathfindingResult.bestPath.estimatedOutput);
        setExchangeRate(result.pathfindingResult.bestRate.toFixed(6));
        setPathType(result.pathfindingResult.bestPath.type);
      } else {
        setEstimatedOutput("No path available");
        setExchangeRate("");
        setPathType("");
      }
    } catch (error) {
      console.error("Error calculating swap estimate:", error);
      setEstimatedOutput("Error calculating");
      setExchangeRate("");
      setPathType("");
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoadingMessage(null);

    try {
      const wallet = currentUserWallets.find(
        (wallet) =>
          wallet.walletType === "USER" ||
          wallet.walletType === "STANDBY TREASURY",
      );

      if (!wallet) {
        throw new Error("No suitable wallet found");
      }

      setLoadingMessage("🔄 Executing swap...");

      const response = await fetch("/api/amms/swapLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletSeed: wallet.seed,
          ammInfo,
          fromCurrency,
          toCurrency,
          fromAmount,
          slippagePercent: parseFloat(slippage),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Swap failed");
      }

      setSuccessMessage(result.output || "Swap completed successfully!");
      onSwapped(); // Refresh parent component

      // Reset form
      setFromAmount("");
      setEstimatedOutput("");
      setExchangeRate("");
      setPathType("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
      setLoadingMessage(null);
    }
  };

  const handleCurrencySwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setFromAmount("");
    setEstimatedOutput("");
    setExchangeRate("");
    setPathType("");
  };

  const canSwap =
    fromCurrency &&
    toCurrency &&
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    estimatedOutput &&
    estimatedOutput !== "No path available" &&
    estimatedOutput !== "Error calculating";

  return (
    <div className="space-y-6">
      <div className="relative flex items-center justify-between">
      {/* Currency Selection */}
      <div className="space-y-4">
        {/* Currency Display with Swap Button */}
        <div className="flex items-center justify-center space-x-4">
          {/* Left Currency */}
          <div className="flex flex-col items-center space-y-2">
            <div className="text-sm font-medium text-mutedText">From</div>
            <div className="flex items-center space-x-2 rounded-lg border border-transparent bg-color3">
              <CurrencyIcon
                symbol={fromCurrency}
                heightClass="h-8"
                widthClass="w-8"
                iconBg="bg-transparent"
              />
            </div>
          </div>

          {/* Swap Direction Button */}
          <button
            onClick={handleCurrencySwap}
            className="rounded-full border border-transparent bg-color3 p-3 transition-colors hover:border-primary hover:bg-color2"
            disabled={!fromCurrency || !toCurrency}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>

          {/* Right Currency */}
          <div className="flex flex-col items-center space-y-2">
            <div className="text-sm font-medium text-mutedText">To</div>
            <div className="flex items-center space-x-2 rounded-lg border border-transparent bg-color3">
              <CurrencyIcon
                symbol={toCurrency}
                heightClass="h-8"
                widthClass="w-8"
                iconBg="bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>
        <button onClick={() => setShowSlippagePanel((prev) => !prev)}>
          <svg
            className="h-6 w-6 text-mutedText hover:text-primary"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              d="M20 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6h-2m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4"
            />
          </svg>
        </button>
        {showSlippagePanel && (
          <SlippagePanel
            slippage={slippage}
            setSlippage={setSlippage}
            onClose={() => setShowSlippagePanel(false)}
          />
        )}
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-mutedText">Amount</label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="flex-1 rounded-lg border border-transparent bg-color3 p-3 hover:border-primary focus:border-primary focus:outline-none"
            min="0"
            step="0.000001"
          />
          {fromCurrency && (
            <div className="flex items-center space-x-2">
              <span className="text-xl font-medium">{fromCurrency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Swap Details */}
      {estimatedOutput &&
        estimatedOutput !== "No path available" &&
        estimatedOutput !== "Error calculating" && (
          <div className="space-y-3 rounded-lg border border-transparent bg-color3 p-4">
            <div className="text-sm font-medium text-mutedText">
              Swap Details
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-mutedText">Estimated Output:</span>
              <div className="flex items-center space-x-2">
                <span className="font-medium">{estimatedOutput}</span>
                {toCurrency && (
                  <>
                    <CurrencyIcon
                      symbol={toCurrency}
                      heightClass="h-4"
                      widthClass="w-4"
                      iconBg="bg-transparent"
                    />
                    <span className="text-sm">{toCurrency}</span>
                  </>
                )}
              </div>
            </div>

            {exchangeRate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-mutedText">Exchange Rate:</span>
                <span className="font-medium">
                  {exchangeRate} {toCurrency}/{fromCurrency}
                </span>
              </div>
            )}

            {pathType && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-mutedText">Route Type:</span>
                <span className="font-medium capitalize">
                  {pathType.replace(/_/g, " ")}
                </span>
              </div>
            )}
          </div>
        )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!canSwap || loading}
        className="w-full"
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            <span>{loadingMessage || "Processing..."}</span>
          </div>
        ) : (
          "Swap"
        )}
      </Button>

      {/* Error Modal */}
      {errorMessage && (
        <ErrorMdl
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessMdl
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
