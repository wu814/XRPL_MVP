"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import DashboardHeader from "@/components/DashboardHeader";
import WalletAssetTable from "@/components/Wallet/WalletAssetTable";
import IssuerAssetTable from "@/components/Wallet/IssuerAssetTable";
import { Wallet } from "lucide-react";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";
export default function WalletsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch wallets for the current user
  useEffect(() => {
    const fetchWallets = async () => {
      if (!session?.user?.user_id) return;

      try {
        const response = await fetch("/api/wallets/getWalletsByUserID");
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setWallets(data.data || []);
        }
      } catch (err) {
        console.error("Error fetching wallets:", err);
        setError("Failed to fetch wallets");
      } finally {
        setLoading(false);
      }
    };

    fetchWallets();
  }, [session]);

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
    <div className="min-h-screen p-2">
      <div className="mx-auto max-w-6xl">
        {loading ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-mutedText">Loading wallets...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <div className="mb-4 text-red-500">Error: {error}</div>
          </div>
        ) : wallets.length === 0 ? (
          <div className="py-8 text-center">
            <Wallet className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold">No Wallets Found</h3>
            <p className="text-mutedText">
              You haven't created any wallets yet. Create your first wallet to
              get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-700 bg-color2 p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getWalletIcon(wallet.wallet_type)}
                    <div>
                      <h3 className="text-xl font-semibold">
                        {getWalletDisplayName(wallet.wallet_type)}
                      </h3>
                      <p className="font-mono text-mutedText">
                        {wallet.classic_address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-primary/20 px-3 py-1 text-sm text-primary">
                      {wallet.wallet_type}
                    </span>
                  </div>
                </div>

                {/* Render appropriate asset table based on wallet type */}
                {wallet.wallet_type === "ISSUER" ? (
                  <IssuerAssetTable wallet={wallet} />
                ) : (
                  <WalletAssetTable wallet={wallet} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <IssuerWalletProvider>
        <CurrentUserWalletProvider>
          <TradePanel />
        </CurrentUserWalletProvider>
      </IssuerWalletProvider>
    </div>
  );
}
