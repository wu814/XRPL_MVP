"use client";

import { useState, useEffect } from "react";
import { useCurrentUserWallet } from "@/components/wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/wallet/IssuerWalletProvider";
import DeleteWalletBtn from "@/components/wallet/DeleteWalletBtn";
import SetTrustlineBtn from "@/components/wallet/SetTrustlineBtn";
import AuthorizeDepositBtn from "@/components/wallet/AuthorizeDepositBtn";
import ClawbackTokenBtn from "@/components/wallet/ClawbackTokenBtn";
import TransferBtn from "@/components/wallet/TransferBtn";
import CreateAdminWalletBtn from "@/components/wallet/CreateAdminWalletBtn";
import Button from "@/components/Button";
import ManageOracleBtn from "@/components/wallet/ManageOracleBtn";
import ViewWalletDetails from "@/components/wallet/ViewWalletDetails";
import { YONAWallet, WalletBalance } from "@/types/appTypes";
import { GetAccountInfoAPIResponse } from "@/types/api/walletAPITypes";


export default function DisplayAdminWallets() {
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const { issuerWallets, fetchIssuerWallets } = useIssuerWallet();
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
    await fetchIssuerWallets();
  };

  const handleDeleteWallet = async (): Promise<void> => {
    await fetchCurrentUserWallets();
    await fetchIssuerWallets();
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

  return (
    <div className="space-y-6">
      {currentUserWallets.length === 0 ? (
        <div className="rounded-lg bg-color2 p-8 text-center">
          <div className="mb-4 text-gray-400">No wallets found</div>
          <p className="text-sm text-gray-500">
            Create your first wallet to get started
          </p>
        </div>
      ) : (
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
                    {/* Transfer Button - Available for all wallets */}
                    <TransferBtn
                      senderWallet={wallet}
                      issuerWallets={issuerWallets}
                      onSuccess={fetchWalletBalances}
                    />

                    {/* Treasury-specific options */}
                    {wallet.walletType === "TREASURY" && (
                      <>
                        <AuthorizeDepositBtn
                          treasuryWallet={wallet}
                          onSuccess={fetchWalletBalances}
                        />
                        <ManageOracleBtn
                          treasuryWallet={wallet}
                          onSuccess={fetchWalletBalances}
                        />
                      </>
                    )}

                    {/* Trustline options for Treasury and Pathfind wallets */}
                    {(wallet.walletType === "TREASURY" ||
                      wallet.walletType === "PATHFIND") && (
                      <SetTrustlineBtn
                        setterWallet={wallet}
                        issuerWallets={issuerWallets}
                        onSuccess={fetchWalletBalances}
                      />
                    )}

                    {/* Issuer-specific options */}
                    {wallet.walletType === "ISSUER" && (
                      <ClawbackTokenBtn issuerWallet={wallet} />
                    )}
                  </div>
                  <div>
                    {/* View Details Button */}
                    <Button onClick={() => handleViewDetails(wallet)}>
                      View Details
                    </Button>
                  </div>
                </div>
                <DeleteWalletBtn
                  classicAddress={wallet.classicAddress}
                  onWalletDeleted={handleDeleteWallet}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Create Wallet Button for Admin */}
      <div className="rounded-lg border-2 border-dashed border-gray-600 bg-color2 p-6">
        <div className="text-center">
          <h3 className="mb-2 font-semibold">Create New Wallet</h3>
          <p className="mb-4 text-sm text-gray-400">
            Add a new ISSUER, TREASURY, or PATHFIND wallet
          </p>
          <CreateAdminWalletBtn onWalletCreated={handleWalletCreated} />
        </div>
      </div>
    </div>
  );
};
