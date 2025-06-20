import { useState, useMemo, useEffect } from "react";
import CurrencyIcon from "../Currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function SwapLiquidity({ ammInfo, onSwapped }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  // UI State
  const [sellCurrency, setSellCurrency] = useState("");
  const [receiveCurrency, setReceiveCurrency] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  const [activeInput, setActiveInput] = useState("from");

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [slippage, setSlippage] = useState("0"); // Default slippage tolerance 0%

  // Feedback/UI flags
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Whether user want to sell a fixed amount or receive a fixed amount
  const [swapInputType, setSwapInputType] = useState("exact_input"); // default to exact_input

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
    if (availableCurrencies.length >= 2 && !sellCurrency && !receiveCurrency) {
      setSellCurrency(availableCurrencies[0].currency);
      setReceiveCurrency(availableCurrencies[1].currency);
    }
  }, [availableCurrencies, sellCurrency, receiveCurrency]);

  // Update handlers to set the type
  const handleFromAmountChange = (e) => {
    setActiveInput("from");
    setSellAmount(e.target.value);
    setReceiveAmount(""); // Clear the other field
    setSwapInputType("exact_input");
  };

  const handleToAmountChange = (e) => {
    setActiveInput("to");
    setReceiveAmount(e.target.value);
    setSellAmount(""); // Clear the other field
    setSwapInputType("exact_output");
  };

  const handleSwap = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const wallet = currentUserWallets.find(
        (wallet) =>
          wallet.walletType === "USER" ||
          wallet.walletType === "STANDBY TREASURY",
      );

      if (!wallet) {
        throw new Error("No suitable wallet found");
      }

      const response = await fetch("/api/amms/swapLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderWallet: wallet,
          sendCurrency: sellCurrency,
          sendAmount: sellAmount,
          receiveCurrency: receiveCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: parseFloat(slippage),
          paymentType: swapInputType,
          exactOutputAmount: receiveAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Swap failed");
      }

      setSuccessMessage(result.message || "Swap completed successfully!");
      onSwapped(); // Refresh parent component

      // Reset form
      setSellAmount("");
      setReceiveAmount("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencySwap = () => {
    const temp = sellCurrency;
    setSellCurrency(receiveCurrency);
    setReceiveCurrency(temp);
    setSellAmount(receiveAmount);
    setReceiveAmount(sellAmount);
    setActiveInput("from");
  };

  const canSwap =
    sellCurrency &&
    receiveCurrency &&
    ((sellAmount && parseFloat(sellAmount) > 0) ||
      (receiveAmount && parseFloat(receiveAmount) > 0));

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-between">
        {/* Currency Selection */}
        <div className="space-y-4">
          {/* Currency Display with Swap Button */}
          <div className="flex items-center justify-center space-x-4">
            {/* Left Currency */}
            <CurrencyIcon
              symbol={sellCurrency}
              heightClass="h-8"
              widthClass="w-8"
              iconBg="bg-color3"
            />

            {/* Swap Direction Button */}
            <button
              onClick={handleCurrencySwap}
              className="hover:text-primary"
              disabled={!sellCurrency || !receiveCurrency}
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
            <CurrencyIcon
              symbol={receiveCurrency}
              heightClass="h-8"
              widthClass="w-8"
              iconBg="bg-color3"
            />
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

      {/* Amount Inputs */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-mutedText">
          Desired Sell Amount
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            value={sellAmount}
            onChange={handleFromAmountChange}
            placeholder="0.0"
            className={`flex-1 rounded-lg border border-transparent bg-color3 p-3 text-lg hover:border-primary focus:border-primary focus:outline-none ${!!receiveAmount ? "cursor-not-allowed opacity-60" : ""}`}
            min="0"
            disabled={!!receiveAmount}
          />
          {sellCurrency && (
            <div className="flex items-center space-x-2">
              <span className="text-lg">{sellCurrency}</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-mutedText">
          Desired Receive Amount
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            value={receiveAmount}
            onChange={handleToAmountChange}
            placeholder="0.0"
            className={`flex-1 rounded-lg border border-transparent bg-color3 p-3 text-lg hover:border-primary focus:border-primary focus:outline-none ${!!sellAmount ? "cursor-not-allowed opacity-60" : ""}`}
            min="0"
            disabled={!!sellAmount}
          />
          {receiveCurrency && (
            <div className="flex items-center space-x-2">
              <span className="text-lg">{receiveCurrency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!canSwap || loading}
        className="w-full"
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="h-5 w-5 animate-spin rounded-full border-b-4 border-primary"></div>
            <span>{"Swapping..."}</span>
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
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </div>
  );
}
