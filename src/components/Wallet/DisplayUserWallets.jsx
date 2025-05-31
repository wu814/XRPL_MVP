"use client";

import React from "react";
import CreateUserWalletBtn from "./CreateUserWalletBtn";
import AddFundsBtn from "./AddFunds";
import DeleteWalletBtn from "./DeleteWalletBtn";
import SetTrustlineBtn from "./SetTrustlineBtn";
import ViewDetailsBtn from "./ViewDetailsBtn";
import TransferBtn from "./TransferBtn";
import ErrorMdl from "../ErrorMdl";
import { useWallet } from "@/components/WalletContext";

const DisplayUserWallets = () => {
  const {
    currentUserWallets,
    issuerWallets,
    loading,
    errorMessage,
    fetchWallets,
    fetchIssuerWallets
  } = useWallet();

  const handleWalletCreated = () => {
    fetchWallets(); // re-fetch from server
    fetchIssuerWallets(); // re-fetch issuer wallets to ensure consistency
  };

  const handleDeleteWallet = () => {
    fetchWallets(); // re-fetch after deletion
    fetchIssuerWallets(); // re-fetch issuer wallets to ensure consistency
  };

  return (
    <div className="container mx-auto mr-4">
      {loading ? (
        <p className="text-center">Loading Wallets...</p>
      ) : currentUserWallets.length === 0 ? (
        <p className="text-center">No wallets found.</p>
      ) : (
        <div className="flex flex-col space-y-4">
          {currentUserWallets.map((wallet) => (
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
                <SetTrustlineBtn
                  buttonName="Add Currency"
                  setterWallet={wallet}
                  issuerWallets={issuerWallets}
                />
                <ViewDetailsBtn wallet={wallet} />
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUserWallets.length === 0 ? (
        <CreateUserWalletBtn
          issuerWallets={issuerWallets}
          onWalletCreated={handleWalletCreated}
        />
      ) : (
        <AddFundsBtn />
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
    </div>
  );
};

export default DisplayUserWallets;
