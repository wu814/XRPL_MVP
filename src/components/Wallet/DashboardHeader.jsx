"use client";

import { RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import {
  fetchUSDPrices,
  getUSDValue,
  formatCurrencyValue,
} from "@/utils/currencyUtils";

export default function DashboardHeader({ totalBalance }) {
  const { currentUserWallets } = useCurrentUserWallet();
  const [calculatedBalance, setCalculatedBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Get the user's primary wallet
  const primaryWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "BUSINESS" ||
      wallet.walletType === "ISSUER",
  );

  const fetchTotalBalance = async () => {
    if (!primaryWallet) return;

    setLoading(true);
    try {
      // Step 1: Get live prices using utility function
      const livePrices = await fetchUSDPrices();

      if (!livePrices || livePrices.length === 0) {
        console.error("No live prices available");
        return;
      }

      // Step 2: Get user's wallet assets
      const [accountInfoResponse, accountLinesResponse] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: primaryWallet }),
        }),
        fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: primaryWallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountLines = await accountLinesResponse.json();


      // Step 3: Calculate total USD value using utility function
      let totalUsdValue = 0;

      // Add XRP balance if not an issuer wallet
      if (primaryWallet.walletType !== "ISSUER" && accountInfo.data?.balance) {
        const xrpBalance = parseFloat(accountInfo.data.balance);
        totalUsdValue += getUSDValue("XRP", xrpBalance, livePrices);
      }

      // Add trustline balances
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach((line) => {
          const balance = parseFloat(line.balance);
          const currency = line.currency;
          totalUsdValue += getUSDValue(currency, balance, livePrices);
        });
      }

      setCalculatedBalance(totalUsdValue);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Error calculating total balance:", error);
      // Fallback to passed totalBalance or 0
      setCalculatedBalance(totalBalance || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (primaryWallet) {
      fetchTotalBalance();
    }
  }, [primaryWallet]);

  // Use calculated balance if available, otherwise use passed totalBalance
  const displayBalance =
    calculatedBalance != 0 ? calculatedBalance : totalBalance || 0;

  return (
    <div className="p-4">
      <div className="pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Total Balance</h1>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Last updated: {lastUpdated}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              {loading && (
                <Loader2 className="h-7 w-7 animate-spin" />
              )}
              <span className="text-5xl font-bold">
                ${formatCurrencyValue(displayBalance)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTotalBalance}
            disabled={loading || !primaryWallet}
            className="rounded-lg bg-color1 p-2 text-gray-400 transition-colors hover:bg-color3 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <span className="text-xs text-gray-400">
            Live prices from CoinGecko
          </span>
        </div>
      </div>
    </div>
  );
}
