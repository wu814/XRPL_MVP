"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import DashboardHeader from "@/components/DashboardHeader";
import WalletAssetTable from "@/components/Wallet/WalletAssetTable";
import IssuerAssetTable from "@/components/Wallet/IssuerAssetTable";
import { Wallet } from "lucide-react";

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
    return <Wallet className="w-8 h-8" />;
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-mutedText">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthRedirect />;
  }

  return (
    <div className="min-h-screen bg-color1">
      <DashboardHeader />
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">My Wallets</h1>
          <p className="text-mutedText">
            Manage your XRPL wallets and view their assets
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-mutedText">Loading wallets...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">Error: {error}</div>
          </div>
        ) : wallets.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Wallets Found</h3>
            <p className="text-mutedText">
              You haven't created any wallets yet. Create your first wallet to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {wallets.map((wallet, index) => (
              <div key={index} className="bg-color2 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getWalletIcon(wallet.wallet_type)}
                    <div>
                      <h3 className="text-xl font-semibold">
                        {getWalletDisplayName(wallet.wallet_type)}
                      </h3>
                      <p className="text-mutedText font-mono">
                        {wallet.classic_address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
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
    </div>
  );
}
