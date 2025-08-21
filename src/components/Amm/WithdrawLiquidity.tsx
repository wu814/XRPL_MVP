"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { useRouter } from "next/navigation";
import { useCurrentUserWallet } from "../wallet/CurrentUserWalletProvider";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { WithdrawLiquidityAPIResponse } from "@/types/api/ammAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";

interface WithdrawLiquidityProps {
  ammInfo: FormattedAMMInfo;
  onWithdrawn: () => void;
}

type WithdrawMode =
  | "twoAsset"
  | "lpToken"
  | "all"
  | "singleAsset"
  | "singleAssetAll"
  | "singleAssetLp";

export default function WithdrawLiquidity({
  ammInfo,
  onWithdrawn,
}: WithdrawLiquidityProps) {
  // Fetch current user wallets from wallet context
  const { currentUserWallets } = useCurrentUserWallet();

  const router = useRouter();

  const [mode, setMode] = useState<WithdrawMode>("twoAsset");
  const [withdrawValue1, setWithdrawValue1] = useState<number | null>(null);
  const [withdrawValue2, setWithdrawValue2] = useState<number | null>(null);
  const [lpTokenValue, setLPTokenValue] = useState<number | null>(null);
  const [singleWithdrawCurrency, setSingleWithdrawCurrency] = useState<string>(ammInfo?.formattedAmount1?.currency || "");
  const [singleWithdrawValue, setSingleWithdrawValue] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currency1 = ammInfo?.formattedAmount1?.currency;
  const currency2 = ammInfo?.formattedAmount2?.currency;

  // Add validation function to check if required inputs are filled
  const isFormValid = (): boolean => {
    // Check if user has a valid wallet
    const hasValidWallet = currentUserWallets.some(
      (wallet) =>
        wallet.walletType === "USER" ||
        wallet.walletType === "BUSINESS" ||
        wallet.walletType === "TREASURY",
    );

    if (!hasValidWallet) return false;

    // Validate based on mode
    switch (mode) {
      case "twoAsset":
        return withdrawValue1 !== null && withdrawValue2 !== null;
      case "lpToken":
        return lpTokenValue !== null;
      case "all":
        return true; // No additional inputs required
      case "singleAsset":
        return singleWithdrawCurrency && singleWithdrawValue !== null;
      case "singleAssetAll":
        return !!singleWithdrawCurrency; // Only asset type selection required
      case "singleAssetLp":
        return singleWithdrawCurrency && lpTokenValue !== null;
      default:
        return false;
    }
  };

  const buildPayload = () => {
    const withdrawerWallet = currentUserWallets.find(
      (wallet) =>
        wallet.walletType === "USER" ||
        wallet.walletType === "BUSINESS" ||
        wallet.walletType === "TREASURY",
    );
    if (!withdrawerWallet) {
      throw new Error("No valid wallet found for the current user");
    }
    const payload = {
      mode,
      withdrawerWallet,
      ammInfo,
    };

    if (mode === "twoAsset") {
      return {
        ...payload,
        withdrawValue1: withdrawValue1?.toString(),
        withdrawValue2: withdrawValue2?.toString(),
      };
    }
    if (mode === "lpToken") {
      return { ...payload, lpTokenValue: lpTokenValue?.toString() };
    }
    if (mode === "all") {
      return payload;
    }
    if (mode === "singleAsset") {
      return {
        ...payload,
        singleWithdrawCurrency,
        singleWithdrawValue: singleWithdrawValue?.toString(),
      };
    }
    if (mode === "singleAssetAll") {
      return { ...payload, singleWithdrawCurrency, singleWithdrawValue: null };
    }
    if (mode === "singleAssetLp") {
      return { ...payload, singleWithdrawCurrency, lpTokenValue: lpTokenValue?.toString() };
    }
    throw new Error("Unsupported mode selected");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload = buildPayload();

      const response = await fetch("/api/amm/withdrawLiquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error: APIErrorResponse = await response.json();
        setErrorMessage(error.message || "Transaction failed");
        return;
      }
      const result: WithdrawLiquidityAPIResponse = await response.json();
      setSuccessMessage(result.message || "Liquidity withdrawn successfully!");

      if (result.poolDeleted) {
        // ⏳ Show initial message for 5 seconds
        setTimeout(() => {
          // 📝 Then update message
          setSuccessMessage(
            "Liquidity withdrawn successfully! Pool is now empty! Redirecting to Liquidity Pool page...",
          );

          // ⏳ Wait another 5 seconds before redirecting
          setTimeout(() => {
            router.push("/trade/amm");
          }, 5000);
        }, 3000);
      } else {
        onWithdrawn();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(currentUserWallets);
  }, [currentUserWallets]);

  return (
    <div>
      <div className="space-y-4 text-lg">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as WithdrawMode)}
          className="mt-1 rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
        >
          <option value="twoAsset">Two Asset Withdraw</option>
          <option value="lpToken">LP Token Withdraw</option>
          <option value="all">Withdraw All</option>
          <option value="singleAsset">Single Asset Withdraw</option>
          <option value="singleAssetAll">Single Asset Withdraw All</option>
          <option value="singleAssetLp">Single Asset LP Withdraw</option>
        </select>

        {mode === "twoAsset" && (
          <>
            <input
              type="number"
              step="0.000001"
              value={withdrawValue1 ?? ""}
              onChange={(e) =>
                setWithdrawValue1(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder={`Desire ${currency1 || "Token A"} amount`}
              className="w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
            />
            <input
              type="number"
              step="0.000001"
              value={withdrawValue2 ?? ""}
              onChange={(e) =>
                setWithdrawValue2(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder={`Desire ${currency2 || "Token B"} amount`}
              className="w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
            />
          </>
        )}

        {mode.includes("singleAsset") && (
          <>
            <select
              value={singleWithdrawCurrency}
              onChange={(e) => setSingleWithdrawCurrency(e.target.value)}
              className="mt-1 w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
            >
              <option value={currency1}>{currency1}</option>
              <option value={currency2}>{currency2}</option>
            </select>
            {mode !== "singleAssetAll" && mode !== "singleAssetLp" && (
              <input
                type="number"
                step="0.000001"
                value={singleWithdrawValue ?? ""}
                onChange={(e) =>
                  setSingleWithdrawValue(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="Withdraw Amount"
                className="w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              />
            )}
          </>
        )}

        {(mode === "lpToken" || mode === "singleAssetLp") && (
          <input
            type="number"
            step="0.000001"
            value={lpTokenValue ?? ""}
            onChange={(e) =>
              setLPTokenValue(
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder="LP Token Amount"
            className="w-full rounded-lg border border-transparent bg-color3 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
          />
        )}

        <div className="flex">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || !isFormValid()}
            className="w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Withdrawing Liquidity...
              </div>
            ) : (
              "Withdraw Liquidity"
            )}
          </Button>
        </div>
      </div>

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
