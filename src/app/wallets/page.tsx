"use client";

import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import AssetTable, { useLivePrices, useWalletAssets } from "@/components/wallet/AssetTable";
import { Wallet, Loader2 } from "lucide-react";
import {
  useCurrentUserWallet,
} from "@/components/wallet/CurrentUserWalletProvider";
import usePageTitle from "@/utils/usePageTitle";
import { YONAWallet } from "@/types/appTypes";
import { PriceInfo } from "@/utils/currencyUtils";
import { getWalletDisplayName } from "@/utils/assetUtils";

// Wallet component that displays individual wallet and its assets
interface WalletComponentProps {
  wallet: YONAWallet;
  livePrices: PriceInfo[];
}

function WalletComponent({ wallet, livePrices }: WalletComponentProps) {
  const isIssuer = wallet.walletType === "ISSUER";
  const { assets, loading } = useWalletAssets(wallet, livePrices, isIssuer);

  return (
    <div className="rounded-lg bg-color2 p-6">
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

      <AssetTable 
        assets={assets} 
        loading={loading} 
        isIssuer={isIssuer}
        wallet={wallet}
      />
    </div>
  );
}

// WalletsWrapper component
function WalletsWrapper() {
  const { currentUserWallets, loading, errorMessage } = useCurrentUserWallet();
  const { livePrices, loading: pricesLoading } = useLivePrices();

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
          You haven&apos;t created any wallets yet. Create your first wallet to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentUserWallets.map((wallet, index) => (
        <WalletComponent 
          key={index} 
          wallet={wallet} 
          livePrices={livePrices}
        />
      ))}
    </div>
  );
}

export default function WalletsPage() {
  const { data: session, status } = useSession();
  
  // Set page title
  usePageTitle("My Wallets - YONA");

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
    <div className="min-h-screen p-2">
      <div className="mx-auto max-w-6xl">
        <WalletsWrapper />
      </div>
    </div>
  );
}
