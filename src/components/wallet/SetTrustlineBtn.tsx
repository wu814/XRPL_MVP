"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Button from "../app/Button";
import ErrorMdl from "../app/ErrorMdl";
import SuccessMdl from "../app/SuccessMdl";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import { YONAWallet } from "@/types/appTypes";
import { APIResponse, SetWalletTrustlineAPIData } from "@/types/apiTypes";

const formatAmount = (value: string | number): string =>
  Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

const formatUSD = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const buildSuccessMessage = (
  selectedCurrency: string,
  data?: SetWalletTrustlineAPIData,
  fallback?: string,
): string => {
  if (data?.trustlineAlreadyExisted) {
    return `Trustline for ${selectedCurrency} already exists. No welcome gift issued.`;
  }

  const bonus = data?.welcomeBonus;
  if (!bonus) {
    return fallback || `Trustline for ${selectedCurrency} set successfully.`;
  }

  if (bonus.skipped) {
    return `Trustline for ${selectedCurrency} set successfully.\n\nWelcome gift could not be issued: ${bonus.skipReason || "unknown reason"}`;
  }

  return (
    `Trustline for ${selectedCurrency} set successfully!\n\n` +
    `Welcome gift: you received ${formatAmount(bonus.amount)} ${bonus.currency} ` +
    `(≈ $${formatUSD(bonus.usdValue)} USD) at $${formatAmount(bonus.pricePerUnitUSD)}/${bonus.currency}.`
  );
};

interface SetTrustlineBtnProps {
  setterWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  onSuccess?: () => void;
}

export default function SetTrustlineBtn({ setterWallet, issuerWallets, onSuccess }: SetTrustlineBtnProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // for Standby wallets
  const [currency, setCurrency] = useState<string>("");
  const [showCurrencyMdl, setShowCurrencyMdl] = useState<boolean>(false);

  // Centralized request routine
  const doRequest = async (selectedCurrency: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/trustline/setWalletTrustline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setterWallet,
          issuerWallets,
          currency: selectedCurrency,
        }),
      });

      if (!response.ok) {
        const errorData: APIResponse<never> = await response.json();
        setErrorMessage(errorData.message);
        return;
      }
      const result: APIResponse<SetWalletTrustlineAPIData> = await response.json();

      setSuccessMessage(
        buildSuccessMessage(selectedCurrency, result.data, result.message),
      );

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setShowCurrencyMdl(false);
    }
  };

  const handleClick = () => {
    setCurrency("");
    setShowCurrencyMdl(true);
  };

  return (
    <>
      <Button variant="primary" onClick={handleClick} disabled={loading}>
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Setting...</span>
          </div>
        ) : (
          "Set Trustline"
        )}
      </Button>

      {showCurrencyMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 space-y-4 rounded-lg bg-color3 p-6">
            <h2 className="text-2xl font-semibold">
              Set Trustline
            </h2>
            <div>
              <label className="mb-1 block text-mutedText text-sm">Select Currency</label>
              <CurrencyDropDown
                value={currency}
                onChange={setCurrency}
                disabledOptions={["XRP"]}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowCurrencyMdl(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => doRequest(currency)}
                disabled={loading || !currency}
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Setting...</span>
                  </div>
                ) : (
                  "Set Trustline"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => {
            setSuccessMessage(null);
            setShowCurrencyMdl(false);
          }}
        />
      )}
    </>
  );
};
