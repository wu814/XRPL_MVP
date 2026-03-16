"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import Button from "../app/Button";
import SuccessMdl from "../app/SuccessMdl";
import ErrorMdl from "../app/ErrorMdl";
import { YONAWallet } from "@/types/appTypes";
import { APIResponse } from "@/types/apiTypes";

interface ClawbackTokenBtnProps {
  issuerWallet: YONAWallet;
}

export default function ClawbackTokenBtn({ issuerWallet }: ClawbackTokenBtnProps) {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [targetAccountAddress, setTargetAccountAddress] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [clawbackMode, setClawbackMode] = useState<"regular" | "amm">("regular");

  // AMM-specific state
  const [holderAddress, setHolderAddress] = useState<string>("");
  const [assetCurrency, setAssetCurrency] = useState<string>("");
  const [asset2Currency, setAsset2Currency] = useState<string>("");
  const [ammAmount, setAmmAmount] = useState<string>("");
  const [ammAmountCurrency, setAmmAmountCurrency] = useState<"asset" | "asset2">("asset");
  const [clawTwoAssets, setClawTwoAssets] = useState<boolean>(false);

  const handleClawback = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/transaction/clawbackToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerWallet,
          targetAccountAddress,
          currency: selectedCurrency,
          amount,
        }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: APIResponse<never> = await res.json();
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage(result.message);
      setShowModal(false);
      setTargetAccountAddress("");
      setSelectedCurrency(null);
      setAmount("");
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAMMClawback = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      // Determine which asset to use based on amount currency selection
      // The Amount field must match the Asset field (not Asset2)
      const primaryAsset = ammAmountCurrency === "asset" 
        ? { currency: assetCurrency, issuer: issuerWallet.classicAddress }
        : { currency: asset2Currency, issuer: issuerWallet.classicAddress };
      
      const secondaryAsset = ammAmountCurrency === "asset"
        ? { currency: asset2Currency, issuer: issuerWallet.classicAddress }
        : { currency: assetCurrency, issuer: issuerWallet.classicAddress };

      const res = await fetch("/api/transaction/ammClawback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerWallet,
          holder: holderAddress,
          asset: primaryAsset,
          asset2: secondaryAsset,
          amount: ammAmount || undefined,
          clawTwoAssets,
        }),
      });

      if (!res.ok) {
        const errorData: APIResponse<never> = await res.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: APIResponse<never> = await res.json();
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage(result.message);
      setShowModal(false);
      // Reset AMM fields
      setHolderAddress("");
      setAssetCurrency("");
      setAsset2Currency("");
      setAmmAmount("");
      setAmmAmountCurrency("asset");
      setClawTwoAssets(false);
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowModal(true)}>
        Clawback
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 space-y-4 rounded-lg bg-color3 p-6">
            {/* Header with Toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Clawback Token
              </h2>
              
              {/* Toggle between Regular and AMM */}
              <div className="flex space-x-1 rounded-full bg-color4 p-1">
                <button
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    clawbackMode === "regular"
                      ? "bg-primary/20 text-primary border border-primary"
                      : "text-mutedText hover:text-white"
                  }`}
                  onClick={() => setClawbackMode("regular")}
                >
                  Regular
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    clawbackMode === "amm"
                      ? "bg-primary/20 text-primary border border-primary"
                      : "text-mutedText hover:text-white"
                  }`}
                  onClick={() => setClawbackMode("amm")}
                >
                  AMM
                </button>
              </div>
            </div>

            {/* Conditional Content Based on Toggle */}
            {clawbackMode === "regular" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-mutedText">
                    Target Account Address
                  </label>
                  <input
                    type="text"
                    value={targetAccountAddress}
                    onChange={(e) => setTargetAccountAddress(e.target.value)}
                    className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                    placeholder="Enter target wallet address..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mutedText">
                    Currency
                  </label>
                  <CurrencyDropDown
                    value={selectedCurrency || ""}
                    onChange={setSelectedCurrency}
                    disabledOptions={[]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mutedText">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                    placeholder="Enter amount to claw back..."
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="cancel"
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleClawback}
                    disabled={
                      !targetAccountAddress ||
                      !selectedCurrency ||
                      !amount ||
                      loading
                    }
                    className="flex-1"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Processing...
                      </div>
                    ) : (
                      "Clawback"
                    )}
                  </Button>
                </div>
              </>
            ) : (
              // AMM Mode
              <>
                <div>
                  <label className="block text-sm font-medium text-mutedText">
                    Holder Address
                  </label>
                  <input
                    type="text"
                    value={holderAddress}
                    onChange={(e) => setHolderAddress(e.target.value)}
                    className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                    placeholder="Address holding LP tokens..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-mutedText">
                      Asset Currency
                    </label>
                    <input
                      type="text"
                      value={assetCurrency}
                      onChange={(e) => setAssetCurrency(e.target.value.toUpperCase())}
                      className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                      placeholder="USD"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mutedText">
                      Asset2 Currency
                    </label>
                    <input
                      type="text"
                      value={asset2Currency}
                      onChange={(e) => setAsset2Currency(e.target.value.toUpperCase())}
                      className="bg-color4 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                      placeholder="EUR"
                      maxLength={3}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-mutedText">
                    Amount to Claw Back (Optional)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ammAmount}
                      onChange={(e) => setAmmAmount(e.target.value)}
                      className="bg-color4 mt-1 flex-1 rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                      placeholder="Leave empty to claw back all..."
                    />
                    <select
                      value={ammAmountCurrency}
                      onChange={(e) => setAmmAmountCurrency(e.target.value as "asset" | "asset2")}
                      className="bg-color4 mt-1 rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                    >
                      <option value="asset">{assetCurrency || "Asset"}</option>
                      <option value="asset2">{asset2Currency || "Asset2"}</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-mutedText">
                    Specify which currency amount to claw back
                  </p>
                </div>

                {/* Claw Two Assets Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="clawTwoAssets"
                    checked={clawTwoAssets}
                    onChange={(e) => setClawTwoAssets(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="clawTwoAssets" className="text-sm text-mutedText">
                    Claw back both assets proportionally
                  </label>
                </div>

                {/* Info Text */}
                <div className="rounded-lg bg-color4 p-3 text-xs text-gray-400">
                  <strong className="text-orange-400">Note:</strong> AMM clawback retrieves tokens from holders who deposited into AMM pools.
                  {clawTwoAssets && (
                    <>
                      <br />
                      <strong className="text-yellow-400">Both assets mode:</strong> You must be the issuer of both assets.
                    </>
                  )}
                  <br />
                  <strong className="text-blue-400">Issuer:</strong> {issuerWallet.classicAddress.slice(0, 8)}...
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="cancel"
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAMMClawback}
                    disabled={
                      !holderAddress ||
                      !assetCurrency ||
                      !asset2Currency ||
                      loading
                    }
                    className="flex-1"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Processing...
                      </div>
                    ) : (
                      "Clawback from AMM"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      )}
    </>
  );
};
