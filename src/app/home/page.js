"use client";
import { useSession } from "next-auth/react";
import usePageTitle from "@/utils/usePageTitle";
import { Plus } from "lucide-react";
import DisplayAdminWallets from "@/components/Wallet/DisplayAdminWallets";
import DisplayUserWallets from "@/components/Wallet/DisplayUserWallets";
import DashboardHeader from "@/components/Wallet/DashboardHeader";

import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import CreateUserWalletBtn from "@/components/Wallet/CreateUserWalletBtn";
import CreateAdminWalletBtn from "@/components/Wallet/CreateAdminWalletBtn";

// Welcome/Dashboard Section Component
function WelcomeSection() {
  const { data: session } = useSession();
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();
  const { fetchIssuerWallets } = useIssuerWallet();

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  const handleAdminWalletCreated = async () => {
    await fetchCurrentUserWallets();
    await fetchIssuerWallets();
  };

  // If user has no wallets, show prominent create wallet section
  if (currentUserWallets.length === 0) {
    return (
      <div className="rounded-lg bg-gradient-to-r from-[#30ccfe] to-[#b06cfd] p-6">
        <h2 className="mb-2 text-xl font-bold">
          Welcome to XRPL MVP, {session.user.username}!
        </h2>
        <p className="mb-4">
          Get started by creating your first XRPL wallet to manage your digital
          assets.
        </p>
        <div className="rounded-lg border border-white/20 bg-white/10 p-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <Plus className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 font-semibold">Create Your First Wallet</h3>
              <p className="text-sm">
                Start managing your XRPL assets with a secure custodial wallet.
              </p>
            </div>
            {session.user.role === "ADMIN" ? (
              <CreateAdminWalletBtn
                onWalletCreated={handleAdminWalletCreated}
              />
            ) : (
              <CreateUserWalletBtn onWalletCreated={handleWalletCreated} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // If user has wallets, show welcome dashboard
  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="w-full rounded-lg bg-gradient-to-r from-[#30ccfe] to-[#b06cfd] p-6 text-white">
        <h2 className="mb-2 text-xl font-bold">
          Welcome back, {session.user.username}!
        </h2>
        <p className="text-green-100">
          {session.user.role === "ADMIN"
            ? "Manage your XRPL infrastructure and monitor system performance."
            : "Your XRPL portfolio is ready. Start trading or manage your assets."}
        </p>
      </div>

      {/* User Wallets or Admin Wallets Section */}
      {session.user.role === "ADMIN" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Admin Wallets Overview</h3>
          </div>
          <DisplayAdminWallets />
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-bold">User Wallets Overview</h3>
          <DisplayUserWallets />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();

  // Set dynamic page title
  usePageTitle("Home - YONA");

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-color1 p-8">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-gray-600"></div>
          <div className="mb-6 h-32 rounded bg-gray-600"></div>
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
            Please log in to access your dashboard
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-color1 p-2">
      {/* Content */}
      <div className="h-full space-y-4 overflow-y-auto">
        {/* Dashboard Header with Balance */}
        <div className="w-full">
          <DashboardHeader />
        </div>
        {/* Welcome Section */}
        <WelcomeSection />
      </div>
    </div>
  );
}
