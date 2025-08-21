"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { YONAWallet, WalletBalance } from "@/types/appTypes";
import { useCurrentUserWallet } from "@/components/wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/wallet/IssuerWalletProvider";
import SetTrustlineBtn from "@/components/wallet/SetTrustlineBtn";
import TransferBtn from "@/components/wallet/TransferBtn";
import CreateUserWalletBtn from "@/components/wallet/CreateUserWalletBtn";
import Button from "@/components/Button";
import ViewWalletDetails from "@/components/wallet/ViewWalletDetails";
import AddFundsBtn from "./AddFunds";
import { GetAccountInfoAPIResponse } from "@/types/api/walletAPITypes";


// Additional Welcome Section Component for users with wallets
function AdditionalWelcomeSection() {
  const { data: session } = useSession();
  const { currentUserWallets } = useCurrentUserWallet();

  // Only show this section if user has wallets
  if (currentUserWallets.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg bg-color2 p-6">
      <h2 className="mb-6 text-2xl font-bold">
        Welcome, {session?.user?.username}
      </h2>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-color3 p-6">
          <h3 className="mb-4 text-xl font-semibold">
            Top Earning Pools (24hr)
          </h3>
          <div className="space-y-3 text-lg">
            <div className="flex justify-between">
              <span>XRP/USD</span>
              <span className="text-green-400">2.75%</span>
            </div>
            <div className="flex justify-between">
              <span>XRP/BTC</span>
              <span className="text-green-400">1.58%</span>
            </div>
            <div className="flex justify-between">
              <span>USD/BTC</span>
              <span className="text-green-400">1.23%</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-color3 p-6">
          <h3 className="mb-4 text-xl font-semibold">Recent Activity</h3>
          <div className="space-y-3 text-lg text-gray-400">
            <div>No recent transactions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main DisplayUserWallets Component
export default function DisplayUserWallets() {
  const { data: session } = useSession();
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();
  const [selectedWallet, setSelectedWallet] = useState<YONAWallet | null>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, WalletBalance>>({});

  // Constants for reserve calculation
  const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
  const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

  // Fetch balance and reserve info for all wallets
  const fetchWalletBalances = async (): Promise<void> => {
    const balances: Record<string, WalletBalance> = {};

    try {
      const promises = currentUserWallets.map(async (wallet: YONAWallet) => {
        try {
          const response = await fetch("/api/wallet/getAccountInfo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet }),
          });

          const data: GetAccountInfoAPIResponse = await response.json();
          if (data.data) {
            const balance = parseFloat(data.data.Balance); // Already converted from drops
            const ownerCount = data.data.OwnerCount || 0;
            const totalReserve = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
            const availableBalance = Math.max(0, balance - totalReserve);

            balances[wallet.classicAddress] = {
              balance,
              ownerCount,
              totalReserve,
              availableBalance,
            };
          }
        } catch (error) {
          console.error(
            `Error fetching balance for ${wallet.classicAddress}:`,
            error,
          );
          balances[wallet.classicAddress] = {
            balance: 0,
            ownerCount: 0,
            totalReserve: BASE_RESERVE_XRP,
            availableBalance: 0,
          };
        }
      });

      await Promise.all(promises);
      setWalletBalances(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    }
  };

  // Fetch balances when wallets change
  useEffect(() => {
    if (currentUserWallets.length > 0) {
      fetchWalletBalances();
    }
  }, [currentUserWallets]);

  const handleViewDetails = (wallet: YONAWallet): void => {
    setSelectedWallet(wallet);
  };

  const handleCloseDetails = (): void => {
    setSelectedWallet(null);
  };

  const handleWalletCreated = async (): Promise<void> => {
    await fetchCurrentUserWallets();
  };

  const handleWalletAction = async (): Promise<void> => {
    await fetchCurrentUserWallets();
    await fetchWalletBalances();
  };

  // If a wallet is selected, show the details view
  if (selectedWallet) {
    return (
      <ViewWalletDetails
        wallet={selectedWallet}
        onBack={handleCloseDetails}
      />
    );
  }

  // If user has no wallets, show prominent create wallet section
  if (currentUserWallets.length === 0) {
    return (
      <div className="space-y-4">
        <div className="w-full rounded-lg bg-gradient-to-r from-[#77C7F1] via-[#A156E2] to-[#8875DD] p-6 text-white">
          <h2 className="mb-2 text-xl font-bold">
            Welcome to XRPL MVP, {session?.user?.username}!
          </h2>
          <p className="mb-4 text-blue-100">
            Get started by creating your first XRPL wallet to manage your digital assets.
          </p>
          <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 font-semibold">Create Your First Wallet</h3>
                <p className="text-sm text-blue-100">
                  Start managing your XRPL assets with a secure custodial wallet.
                </p>
              </div>
              <CreateUserWalletBtn onWalletCreated={handleWalletCreated} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user has wallets, show wallet details and additional sections
  return (
    <div className="space-y-4">
      {/* Wallet Display - Same pattern as DisplayAdminWallets */}
      <div className="space-y-6">
        <div className="grid gap-4">
          {currentUserWallets.map((wallet: YONAWallet) => {
            const balanceInfo = walletBalances[wallet.classicAddress];

            return (
              <div
                key={wallet.classicAddress}
                className="relative rounded-lg bg-color2 p-8"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{wallet.walletType}</h3>
                  </div>

                  {/* Balance Information */}
                  <div className="flex items-baseline space-x-6">
                    {balanceInfo ? (
                      <>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-400">
                            Balance: {balanceInfo.balance.toFixed(6)} XRP
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-400">
                            Reserved: {balanceInfo.totalReserve.toFixed(1)} XRP
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-green-500">
                            Available: {balanceInfo.availableBalance.toFixed(6)} XRP
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-lg text-gray-400">Loading balance...</div>
                    )}
                  </div>
                </div>

                {/* Wallet Address */}
                <div className="mb-6">
                  <p className="font-mono text-lg text-gray-400">
                    {wallet.classicAddress}
                  </p>
                </div>

                {/* Wallet Management Options */}
                <div className="flex justify-between gap-2 border-t border-gray-600 pt-4">
                  <div className="flex flex-row gap-2">
                    <TransferBtn
                      senderWallet={wallet}
                      issuerWallets={issuerWallets}
                      onSuccess={handleWalletAction}
                    />
                    <SetTrustlineBtn
                      setterWallet={wallet}
                      issuerWallets={issuerWallets}
                      onSuccess={handleWalletAction}
                    />
                  </div>
                  <div>
                    {/* View Details Button */}
                    <Button onClick={() => handleViewDetails(wallet)}>
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddFundsBtn />
      <AdditionalWelcomeSection />
    </div>
  );
}
