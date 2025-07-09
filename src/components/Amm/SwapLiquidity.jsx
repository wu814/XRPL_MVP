import { useState, useMemo, useEffect } from "react";
import CurrencyIcon from "../Currency/CurrencyIcon";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import SlippagePanel from "../SlippagePanel";
import { Settings, ArrowUpDown } from "lucide-react";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

export default function SwapLiquidity({ ammInfo, onSwapped }) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // UI State
  const [sellCurrency, setSellCurrency] = useState("");
  const [buyCurrency, setBuyCurrency] = useState("");
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

  // Whether user want to sell a fixed amount or receive a fixed amount
  const [swapInputType, setSwapInputType] = useState("exact_input"); // default to exact_input

  // Auto-select currencies when component mounts
  useEffect(() => {
    setSellCurrency(ammInfo?.amount?.currency);
    setBuyCurrency(ammInfo?.amount2?.currency);
  }, [ammInfo]);

  // Update handlers to set the type
  const handleSellAmountChange = (e) => {
    setActiveInput("sell");
    setSellAmount(e.target.value);
    setBuyAmount(""); // Clear the other field
    setSwapInputType("exact_input");
  };

  const handleBuyAmountChange = (e) => {
    setActiveInput("buy");
    setBuyAmount(e.target.value);
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
          wallet.walletType === "BUSINESS" ||
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
          receiveCurrency: buyCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: parseFloat(slippage),
          paymentType: swapInputType,
          exactOutputAmount: buyAmount,
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

  const canSwap =
    sellCurrency &&
    buyCurrency &&
    ((sellAmount && parseFloat(sellAmount) > 0) ||
      (buyAmount && parseFloat(buyAmount) > 0));

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-end">
        <button onClick={() => setShowSlippagePanel((prev) => !prev)}>
         <Settings className="w-5 h-5 text-gray-400 hover:text-white" />
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
          className="hover:bg-color4 p-3 bg-color3 rounded-full"
          disabled={!sellCurrency || !buyCurrency}
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
          className={`bg-transparent text-right text-xl focus:outline-none ${!!sellAmount ? "cursor-not-allowed opacity-60" : ""}`}
          min="0"
          disabled={!!sellAmount}
        />
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
