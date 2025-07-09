"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import AssetTable from "@/components/Wallet/AssetTable";
import IssuerAssetTable from "@/components/Wallet/IssuerAssetTable";
import { Wallet, Loader2 } from "lucide-react";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";
import { fetchUsdPrices, getUsdValue, formatCurrencyValue } from "@/utils/currencies";

// Custom hook for live prices
function useLivePrices() {
  const [livePrices, setLivePrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await fetchUsdPrices();
        setLivePrices(prices);
      } catch (error) {
        console.error("Error fetching live prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  return { livePrices, loading };
}

// Custom hook for wallet assets
function useWalletAssets(wallet, livePrices) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
        const [accountInfoResponse, accountLinesResponse] = await Promise.all([
          fetch("/api/wallets/getAccountInfo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet }),
          }),
          fetch("/api/wallets/getAccountLines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet }),
          }),
        ]);

        const accountInfo = await accountInfoResponse.json();
        const accountLines = await accountLinesResponse.json();

        const newAssets = [];

        // Add XRP balance
        if (accountInfo.data?.balance) {
          const xrpBalance = parseFloat(accountInfo.data.balance);
          const usdValue = getUsdValue("XRP", xrpBalance, livePrices);

          newAssets.push({
            id: "xrp-native",
            currency: "XRP",
            balance: formatCurrencyValue(xrpBalance),
            value: formatCurrencyValue(usdValue),
            change24h: "2.3",
            walletAddress: wallet.classicAddress,
            issuer: null,
          });
        }

        // Add trustline balances
        if (accountLines.data?.lines) {
          accountLines.data.lines.forEach((line, index) => {
            if (parseFloat(line.balance) > 0) {
              const balance = parseFloat(line.balance);
              const currency = line.currency;
              const usdValue = getUsdValue(currency, balance, livePrices);

              newAssets.push({
                id: `${line.currency}-${line.account}-${index}`,
                currency: line.currency,
                balance: formatCurrencyValue(balance),
                value: formatCurrencyValue(usdValue),
                change24h: "1.5",
                walletAddress: wallet.classicAddress,
                issuer: line.account,
              });
            }
          });
        }

        setAssets(newAssets);
      } catch (error) {
        console.error("Error fetching assets:", error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [wallet, livePrices]);

  return { assets, loading };
}

// Custom hook for issuer assets
function useIssuerAssets(wallet, livePrices) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchIssuerAssets = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
        const response = await fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        });

        const data = await response.json();
        if (data.data?.lines) {
          // Group and sum balances by currency
          const grouped = data.data.lines.reduce((acc, line) => {
            const currency = line.currency;
            const balance = parseFloat(line.balance);
            acc[currency] = (acc[currency] || 0) + balance;
            return acc;
          }, {});

          // Convert grouped balances to assets array
          const newAssets = Object.entries(grouped).map(([currency, totalBalance]) => {
            const usdValue = getUsdValue(currency, totalBalance, livePrices);

            return {
              id: `issuer-${currency}`,
              currency,
              balance: formatCurrencyValue(totalBalance),
              value: formatCurrencyValue(usdValue),
              change24h: "0",
              walletAddress: wallet.classicAddress,
              issuer: wallet.classicAddress,
            };
          });

          setAssets(newAssets);
        }
      } catch (error) {
        console.error("Error fetching issuer assets:", error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIssuerAssets();
  }, [wallet, livePrices]);

  return { assets, loading };
}

// Simplified AssetTableWrapper component
function AssetTableWrapper({ wallet, livePrices }) {
  const { assets, loading } = useWalletAssets(wallet, livePrices);
  return <AssetTable assets={assets} loading={loading} />;
}

// Simplified IssuerAssetTableWrapper component
function IssuerAssetTableWrapper({ wallet, livePrices }) {
  const { assets, loading } = useIssuerAssets(wallet, livePrices);
  return <IssuerAssetTable assets={assets} loading={loading} wallet={wallet} />;
}

// WalletsWrapper component
function WalletsWrapper() {
  const { currentUserWallets, loading, errorMessage } = useCurrentUserWallet();
  const { livePrices, loading: pricesLoading } = useLivePrices();

  const getWalletDisplayName = (walletType) => {
    const types = {
      "ISSUER": "Issuer Wallet",
      "STANDBY TREASURY": "Treasury Wallet",
      "STANDBY PATHFIND": "Pathfind Wallet",
    };
    return types[walletType] || walletType;
  };

  if (loading || pricesLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="py-8 text-center">
        <div className="mb-4 text-red-500">Error: {errorMessage}</div>
      </div>
    );
  }

  if (currentUserWallets.length === 0) {
    return (
      <div className="py-8 text-center">
        <Wallet className="mx-auto mb-4 h-16 w-16 text-gray-400" />
        <h3 className="mb-2 text-xl font-semibold">No Wallets Found</h3>
        <p className="text-mutedText">
          You haven't created any wallets yet. Create your first wallet to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentUserWallets.map((wallet, index) => (
        <div key={index} className="rounded-lg border border-gray-700 bg-color2 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wallet className="h-8 w-8" />
              <div>
                <h3 className="text-xl font-semibold">
                  {getWalletDisplayName(wallet.walletType)}
                </h3>
                <p className="font-mono text-mutedText">
                  {wallet.classicAddress}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-primary/20 px-3 py-1 text-sm text-primary">
                {wallet.walletType}
              </span>
            </div>
          </div>

          {/* Render appropriate asset table based on wallet type */}
          {wallet.walletType === "ISSUER" ? (
            <IssuerAssetTableWrapper wallet={wallet} livePrices={livePrices} />
          ) : (
            <AssetTableWrapper wallet={wallet} livePrices={livePrices} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function WalletsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-gray-400" />
          <p className="text-mutedText">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthRedirect />;
  }

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen p-2">
          <div className="mx-auto max-w-6xl">
            <WalletsWrapper />
          </div>
          <TradePanel />
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
