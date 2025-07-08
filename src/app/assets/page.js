"use client";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import AssetTable from "@/components/Wallet/AssetTable";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";
import CreateUserWalletBtn from "@/components/Wallet/CreateUserWalletBtn";

// AssetTableWrapper component to access wallet context
function AssetTableWrapper() {
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get the primary wallet for fetching balances
  const primaryWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "STANDBY PATHFIND" ||
      wallet.walletType === "BUSINESS",
  );

  const fetchAssets = async () => {
    if (!primaryWallet) return;

    setLoading(true);
    try {
      // Fetch account info and lines in parallel
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

      const newAssets = [];

      // Add XRP balance
      if (accountInfo.data?.Balance) {
        const xrpBalance = parseFloat(accountInfo.data.Balance) / 1000000; // Convert drops to XRP
        newAssets.push({
          id: "xrp-native",
          currency: "XRP",
          balance: xrpBalance.toFixed(6),
          value: (xrpBalance * 0.5).toFixed(2), // Mock USD value - you might want to get real prices
          change24h: "2.3", // Mock change percentage
          walletAddress: primaryWallet.classicAddress,
          issuer: null,
        });
      }

      // Add trustline balances
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach((line, index) => {
          if (parseFloat(line.balance) > 0) {
            const balance = parseFloat(line.balance);
            newAssets.push({
              id: `${line.currency}-${line.account}-${index}`,
              currency: line.currency,
              balance: balance.toFixed(6),
              value: (balance * 1.0).toFixed(2), // Mock USD value
              change24h: "1.5", // Mock change percentage
              walletAddress: primaryWallet.classicAddress,
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

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  useEffect(() => {
    fetchAssets();
  }, [primaryWallet]);

  // If no wallets exist, show create wallet prompt
  if (currentUserWallets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h2 className="mb-2 text-xl font-bold">No Wallet Found</h2>
          <p className="mb-4">
            Create your first XRPL wallet to start managing your digital assets.
          </p>
          <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-semibold">Create Your First Wallet</h3>
                <p className="text-sm">
                  Start managing your XRPL assets with a secure custodial
                  wallet.
                </p>
              </div>
              <CreateUserWalletBtn onWalletCreated={handleWalletCreated} />
            </div>
          </div>
        </div>

        {/* Empty asset table */}
        <AssetTable assets={[]} />
      </div>
    );
  }

  return <AssetTable assets={assets} loading={loading} />;
}

export default function AssetsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="  min-h-screen bg-color1 p-8">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-gray-600"></div>
          <div className="h-64 rounded bg-gray-600"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="  min-h-screen bg-color1 p-8">
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-400">
            Please log in to view your assets
          </h1>
        </div>
      </div>
    );
  }

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className=" min-h-screen bg-color1">
          <AssetTableWrapper />
          <TradePanel />
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
