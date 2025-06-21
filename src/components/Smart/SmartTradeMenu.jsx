import { useState, useMemo, useEffect } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function SmartTradeMenu() {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // UI State
  const [sellCurrency, setSellCurrency] = useState("XRP");
  const [buyCurrency, setBuyCurrency] = useState("USD");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [activeInput, setActiveInput] = useState("sell");

  // Slippage tolerance state
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [slippage, setSlippage] = useState("0"); // Default slippage tolerance 0%

  // Feedback/UI flags
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Whether user want to send a fixed amount or receive a fixed amount
  const [tradeInputType, setTradeInputType] = useState("exact_input"); // default to exact_input

  // Update handlers to set the type
  const handleSellAmountChange = (e) => {
    setActiveInput("sell");
    setSellAmount(e.target.value);
    setBuyAmount(""); // Clear the other field
    setTradeInputType("exact_input");
  };

  const handleBuyAmountChange = (e) => {
    setActiveInput("buy");
    setBuyAmount(e.target.value);
    setSellAmount(""); // Clear the other field
    setTradeInputType("exact_output");
  };

  const handleSmartTrade = async () => {
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

      if (!issuerWallets || issuerWallets.length === 0) {
        throw new Error("No issuer wallet found");
      }

      const response = await fetch("/api/smart/smartTrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          senderWallet: wallet,
          sendCurrency: sellCurrency,
          sendAmount: sellAmount,
          receiveCurrency: buyCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: parseFloat(slippage),
          paymentType: tradeInputType,
          exactOutputAmount: buyAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Smart trade failed");
      }

      setSuccessMessage(result.message || "Smart trade completed successfully!");

      // Reset form
      setSellAmount("");
      setBuyAmount("");
    } catch (error) {
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

  const canTrade =
    sellCurrency &&
    buyCurrency &&
    sellCurrency !== buyCurrency &&
    ((sellAmount && parseFloat(sellAmount) > 0) ||
      (buyAmount && parseFloat(buyAmount) > 0));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-center">Smart Trade</h2>
      <div className="relative flex items-center justify-end">
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
      <div>
        <div className="flex items-center justify-between rounded-lg border border-transparent bg-color3 p-4 focus-within:border-primary hover:border-primary">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-mutedText">Sell</label>
            <CurrencyDropDown
              value={sellCurrency}
              onChange={setSellCurrency}
              disabledOptions={[buyCurrency]}
              className="w-32"
            />
          </div>
          <input
            type="number"
            value={sellAmount}
            onChange={handleSellAmountChange}
            placeholder="0.0"
            className={`bg-transparent text-right text-xl focus:outline-none ${!!buyAmount ? "cursor-not-allowed opacity-60" : ""}`}
            min="0"
            disabled={!!buyAmount}
          />
        </div>
      </div>

      {/* Up/Down Arrow between inputs */}
      <div className="flex justify-center">
        <button
          onClick={handleCurrencySwap}
          className="hover:text-primary"
          disabled={!sellCurrency || !buyCurrency}
        >
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-transparent bg-color3 p-4 focus-within:border-primary hover:border-primary">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-medium text-mutedText">Buy</label>
          <CurrencyDropDown
            value={buyCurrency}
            onChange={setBuyCurrency}
            disabledOptions={[sellCurrency]}
            className="w-32"
          />
        </div>
        <input
          type="number"
          value={buyAmount}
          onChange={handleBuyAmountChange}
          placeholder="0.0"
          className={`bg-transparent text-right text-xl focus:outline-none ${!!sellAmount ? "cursor-not-allowed opacity-60" : ""}`}
          min="0"
          disabled={!!sellAmount}
        />
      </div>

      {/* Trade Button */}
      <Button
        onClick={handleSmartTrade}
        disabled={!canTrade || loading}
        className="w-full"
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="h-5 w-5 animate-spin rounded-full border-b-4 border-primary"></div>
            <span>{"Trading..."}</span>
          </div>
        ) : (
          "Execute Smart Trade"
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
}
