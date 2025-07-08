"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import AssetTable from "@/components/Wallet/AssetTable";
import IssuerAssetTable from "@/components/Wallet/IssuerAssetTable";
import { Wallet } from "lucide-react";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";

// AssetTableWrapper component to handle wallet assets
function AssetTableWrapper({ wallet }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletAssets = async () => {
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

        const fetchedAssets = [];

        // Add XRP balance
        if (accountInfo.data?.balance) {
          const xrpBalance = parseFloat(accountInfo.data.balance); // Already converted from drops to XRP
          fetchedAssets.push({
            currency: "XRP",
            balance: xrpBalance.toFixed(6),
            issuer: null,
            value: xrpBalance * 0.5, // Mock USD value
            change24h: 0,
            walletAddress: wallet.classicAddress,
          });
        }

        // Add trustline balances
        if (accountLines.data?.lines) {
          accountLines.data.lines.forEach((line) => {
            fetchedAssets.push({
              currency: line.currency,
              balance: parseFloat(line.balance).toFixed(6),
              issuer: line.account,
              value: parseFloat(line.balance) * 1.0, // Mock USD value
              change24h: 0,
              walletAddress: wallet.classicAddress,
            });
          });
        }

        setAssets(fetchedAssets);
      } catch (error) {
        console.error("Error fetching wallet assets:", error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletAssets();
  }, [wallet]);

  if (loading) {
    return (
      <div className="w-full bg-color2 border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Assets</h2>
            <div className="text-xl font-bold">USD Values</div>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-mutedText">Loading assets...</p>
        </div>
      </div>
    );
  }

  return <AssetTable assets={assets} />;
}

// WalletsWrapper component to access wallet context
function WalletsWrapper() {
  const { currentUserWallets, loading, errorMessage } = useCurrentUserWallet();

  const getWalletDisplayName = (walletType) => {
    switch (walletType) {
      case "ISSUER":
        return "Issuer Wallet";
      case "STANDBY TREASURY":
        return "Treasury Wallet";
      case "STANDBY PATHFIND":
        return "Pathfind Wallet";
      default:
        return walletType;
    }
  };

  const getWalletIcon = (walletType) => {
    return <Wallet className="h-8 w-8" />;
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <p className="text-mutedText">Loading wallets...</p>
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
          You haven't created any wallets yet. Create your first wallet to
          get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentUserWallets.map((wallet, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-700 bg-color2 p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getWalletIcon(wallet.walletType)}
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
            <IssuerAssetTable wallet={wallet} />
          ) : (
            <AssetTableWrapper wallet={wallet} />
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
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
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
