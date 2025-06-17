"use client";

import { useState, useEffect } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useCurrentUserWallet } from "../Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "../Wallet/IssuerWalletProvider";

const ORDER_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "immediate", label: "Immediate or Cancel" },
  { value: "fill_or_kill", label: "Fill or Kill" },
  { value: "passive", label: "Passive" },
  { value: "sell", label: "Sell" },
];

export default function CreateSmartOffer() {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  const offerCreatorWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" || wallet.walletType === "STANDBY PATHFIND",
  );

  const [orderType, setOrderType] = useState("regular");
  const [sellCurrency, setSellCurrency] = useState(null);
  const [buyCurrency, setBuyCurrency] = useState(null);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [isMarketOrder, setIsMarketOrder] = useState(false);
  
  // Smart offer options
  const [checkMarketFirst, setCheckMarketFirst] = useState(true);
  const [competitiveBuffer, setCompetitiveBuffer] = useState(1.0); // 1% default
  const [slippagePercent, setSlippagePercent] = useState(5);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [marketAnalysis, setMarketAnalysis] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setMarketAnalysis(null);

    try {
      const payload = {
        sellCurrency,
        sellAmount,
        buyCurrency,
        buyAmount: isMarketOrder ? "market" : buyAmount,
        issuerAddress: issuerWallets[0].classicAddress,
        offerCreatorWallet,
        options: {
          orderType,
          checkMarketFirst,
          competitiveBuffer: competitiveBuffer / 100, // Convert percentage to decimal
          slippagePercent
        }
      };

      const res = await fetch("/api/offers/createSmartOffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Smart offer creation failed");

      if (!result.success) {
        setErrorMessage(result.message || "Transaction failed");
      } else {
        setSuccessMessage(result.message || "Smart offer created successfully!");
        if (result.marketAnalysis) {
          setMarketAnalysis(result.marketAnalysis);
        }
      }

    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarketOrderToggle = () => {
    setIsMarketOrder(!isMarketOrder);
    if (!isMarketOrder) {
      setBuyAmount(""); // Clear buy amount when switching to market order
    }
  };

  return (
    <div>
      <h1 className="py-4 text-center text-2xl font-bold">Create Smart Offer</h1>
      <div className="space-y-4 px-4">
        {/* Order Type Selection */}
        <div className="rounded-lg bg-color3 p-4">
          <label className="mb-2 block text-sm text-mutedText">
            Order Type
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-primary focus:border-primary focus:outline-none"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
          >
            {ORDER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Market Order Toggle */}
        <div className="rounded-lg bg-color3 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-mutedText">Market Order</label>
            <button
              type="button"
              onClick={handleMarketOrderToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isMarketOrder ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isMarketOrder ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {isMarketOrder && (
            <p className="mt-2 text-xs text-mutedText">
              Market orders will automatically set the buy amount based on current market rates
            </p>
          )}
        </div>

        {/* Sell Currency Section */}
        <div className="flex flex-col rounded-lg bg-color3 p-4">
          <label className="mb-2 block text-sm text-mutedText">
            Sell Currency
          </label>
          <div className="flex flex-row justify-between space-x-2">
            <CurrencyDropDown
              value={sellCurrency}
              onChange={setSellCurrency}
              dropdownBg={"bg-color4"}
              className="w-min"
            />
            <input
              type="number"
              placeholder="Amount"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 text-right hover:border-primary focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Buy Currency Section */}
        <div className="flex flex-col rounded-lg bg-color3 p-4">
          <label className="mb-2 block text-sm text-mutedText">
            Buy Currency
          </label>
          <div className="flex flex-row justify-between space-x-2">
            <CurrencyDropDown
              value={buyCurrency}
              onChange={setBuyCurrency}
              dropdownBg={"bg-color4"}
              className="w-min"
            />
            <input
              type="number"
              placeholder={isMarketOrder ? "Market Rate" : "Amount"}
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              disabled={isMarketOrder}
              className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 text-right hover:border-primary focus:border-primary focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Smart Options */}
        <div className="rounded-lg bg-color3 p-4">
          <h3 className="mb-3 text-sm font-semibold text-mutedText">Smart Options</h3>
          
          {/* Check Market First */}
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm text-mutedText">Check Market First</label>
            <input
              type="checkbox"
              checked={checkMarketFirst}
              onChange={(e) => setCheckMarketFirst(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>

          {/* Competitive Buffer */}
          <div className="mb-3">
            <label className="mb-1 block text-sm text-mutedText">
              Competitive Buffer (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={competitiveBuffer}
              onChange={(e) => setCompetitiveBuffer(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-primary focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-mutedText">
              Percentage better than market rate (0-10%)
            </p>
          </div>

          {/* Slippage */}
          <div>
            <label className="mb-1 block text-sm text-mutedText">
              Slippage Tolerance (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="50"
              value={slippagePercent}
              onChange={(e) => setSlippagePercent(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-primary focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-mutedText">
              Maximum acceptable slippage (0-50%)
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating Smart Offer..." : "Create Smart Offer"}
          </Button>
        </div>

        {/* Market Analysis Display */}
        {marketAnalysis && (
          <div className="rounded-lg bg-color3 p-4">
            <h3 className="mb-2 text-sm font-semibold text-mutedText">Market Analysis</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Competitive:</span>
                <span className={marketAnalysis.isCompetitive ? "text-green-500" : "text-yellow-500"}>
                  {marketAnalysis.isCompetitive ? "✅ Yes" : "⚠️ No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Offer Rate:</span>
                <span>{marketAnalysis.offerRate?.toFixed(6) || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Final Buy Amount:</span>
                <span>{marketAnalysis.finalBuyAmount || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Type:</span>
                <span className="capitalize">{marketAnalysis.orderType}</span>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
} 