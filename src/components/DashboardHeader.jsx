"use client";

import { ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";

export default function DashboardHeader({
  totalBalance,
}) {
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
      // Step 1: Get treasury wallet (oracle account)
      const treasuryResponse = await fetch("/api/wallets/getTreasuryWallet");
      const treasuryData = await treasuryResponse.json();

      if (!treasuryData.data || treasuryData.data.length === 0) {
        console.error("No treasury wallet found");
        return;
      }

      const treasuryWallet = treasuryData.data[0];

      // Step 2: Get live prices from oracle
      const pricesResponse = await fetch("/api/oracle/getLivePrices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: treasuryWallet.classic_address,
          oracleDocumentId: 1, // Using default oracle document ID
          ledgerIndex: "validated",
        }),
      });

      const pricesData = await pricesResponse.json();

      // Step 3: Get user's wallet assets
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

      console.log(accountInfo);
      console.log(accountLines);

      // Step 4: Calculate total USD value
      let totalUsdValue = 0;

      // Add XRP balance if not an issuer wallet
      if (primaryWallet.walletType !== "ISSUER") {
        if (accountInfo.data?.balance && pricesData.success) {
          const xrpBalance = parseFloat(accountInfo.data.balance);
          const xrpPrice = pricesData.livePrices.find(
            (p) => p.baseAsset === "XRP",
          );

          if (xrpPrice && xrpPrice.available) {
            totalUsdValue += xrpBalance * xrpPrice.price;
          }
        }
      }

      // Add trustline balances
      if (accountLines.data?.lines && pricesData.success) {
        accountLines.data.lines.forEach((line) => {
          const balance = parseFloat(line.balance);
          const currency = line.currency;

          // Find corresponding price in live prices
          if (currency === "USD") {
            totalUsdValue += balance;
          } else {
            const priceInfo = pricesData.livePrices.find(
              (p) => p.baseAsset === currency,
            );

            if (priceInfo && priceInfo.available) {
              const usdValue = balance * priceInfo.price;
              totalUsdValue += usdValue;
            }
          }
        });
      }

      setCalculatedBalance(totalUsdValue);
      setLastUpdated(new Date().toLocaleTimeString());

      console.log(`💰 Total Portfolio Value: $${totalUsdValue.toFixed(2)}`);
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
    <div className="mb-4 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              )}
              <span className="text-5xl font-bold text-primary">
                $
                {displayBalance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTotalBalance}
            disabled={loading || !primaryWallet}
            className="rounded-lg bg-color2 p-2 transition-colors hover:bg-color3 disabled:cursor-not-allowed disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <span className="text-xs text-gray-400">
            Live prices from CoinGecko
          </span>
        </div>
      </div>
    </div>
  );
}
