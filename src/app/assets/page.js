"use client";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import AssetTable from "@/components/Wallet/AssetTable";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";
import CreateUserWalletBtn from "@/components/Wallet/CreateUserWalletBtn";
import { useLivePrices, useWalletAssets } from "@/utils/xrpl/assets";
import usePageTitle from "@/utils/usePageTitle";

// AssetTableWrapper component to access wallet context
function AssetTableWrapper() {
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const { livePrices } = useLivePrices();

  // Get the primary wallet for fetching balances
  const primaryWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "STANDBY PATHFIND" ||
      wallet.walletType === "BUSINESS",
  );

  const { assets, loading } = useWalletAssets(primaryWallet, livePrices, false);

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  // If no wallets exist, show create wallet prompt
  if (currentUserWallets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="w-full rounded-lg bg-gradient-to-r from-[#30ccfe] to-[#b06cfd] p-6">
          <h2 className="mb-2 text-xl font-bold">No Wallet Found</h2>
          <p className="mb-4">
            Create your first XRPL wallet to start managing your digital assets.
          </p>
          <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-6 w-6" />
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
  
  // Set page title
  usePageTitle("Assets - YONA");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-gray-600"></div>
          <div className="h-64 rounded bg-gray-600"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-color1 p-8">
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
        <div className="min-h-screen p-2">
          <AssetTableWrapper />
          <TradePanel />
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
