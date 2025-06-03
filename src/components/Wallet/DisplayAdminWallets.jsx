"use client";

import React from "react";
import CreateAdminWalletBtn from "./CreateAdminWalletBtn";
import DeleteWalletBtn from "./DeleteWalletBtn";
import SetTrustlineBtn from "./SetTrustlineBtn";
import AuthorizeDepositBtn from "./AuthorizeDepositBtn";
import ViewDetailsBtn from "./ViewDetailsBtn";
import TransferBtn from "./TransferBtn";
import ErrorMdl from "../ErrorMdl";
import { useWallet } from "@/components/WalletContext";
import { useEffect } from "react";

const typeOrder = {
  ISSUER: 0,
  "STANDBY TREASURY": 1,
  "STANDBY PATHFIND": 2,
};

const DisplayAdminWallets = () => {
  const {
    currentUserWallets,
    issuerWallets,
    loading,
    errorMessage,
    fetchWallets,
    fetchIssuerWallets,
  } = useWallet();

  // Handle wallet creation (append and sort)
  const handleWalletCreated = async (walletType) => {
    await fetchWallets(); // Refresh all wallets from server for consistency
    await fetchIssuerWallets(); // Refresh issuer wallets as well
  };

  const handleDeleteWallet = async (walletType) => {
    await fetchWallets(); // Re-fetch after deletion
    await fetchIssuerWallets(); // Re-fetch issuer wallets to ensure consistency
  };

  const sortedWallets = [...currentUserWallets].sort(
    (a, b) => typeOrder[a.walletType] - typeOrder[b.walletType],
  );

  
  return (
    <div className="container mx-auto mr-4">
      {loading ? (
        <p className="text-center">Loading Wallets...</p>
      ) : sortedWallets.length === 0 ? (
        <p className="text-center">No wallets found.</p>
      ) : (
        <div className="flex flex-col space-y-4">
          {sortedWallets.map((wallet) => (
            <div
              key={wallet.classicAddress}
              className="relative rounded-lg bg-color2 p-4 shadow-lg"
            >
              <h3 className="mb-6 text-xl font-bold">
                {wallet.classicAddress}
              </h3>
              <p>Type: {wallet.walletType}</p>
              <DeleteWalletBtn
                classicAddress={wallet.classicAddress}
                onWalletDeleted={handleDeleteWallet}
              />
              <div className="absolute bottom-3 right-3 flex flex-row space-x-2">
                <TransferBtn
                  senderWallet={wallet}
                  issuerWallets={issuerWallets}
                />
                {(wallet.walletType === "STANDBY TREASURY" ||
                  wallet.walletType === "STANDBY PATHFIND") && (
                  <SetTrustlineBtn
                    setterWallet={wallet}
                    issuerWallets={issuerWallets}
                  />
                )}
                {wallet.walletType === "STANDBY TREASURY" && (
                  <AuthorizeDepositBtn treasuryWallet={wallet} />
                )}
                <ViewDetailsBtn wallet={wallet} />
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAdminWalletBtn onWalletCreated={handleWalletCreated} />

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
    </div>
  );
};

export default DisplayAdminWallets;
