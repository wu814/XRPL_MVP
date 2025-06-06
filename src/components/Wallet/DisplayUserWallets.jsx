"use client";

import CreateUserWalletBtn from "./CreateUserWalletBtn";
import AddFundsBtn from "./AddFunds";
import DeleteWalletBtn from "./DeleteWalletBtn";
import SetTrustlineBtn from "./SetTrustlineBtn";
import ViewDetailsBtn from "./ViewDetailsBtn";
import TransferBtn from "./TransferBtn";
import ErrorMdl from "../ErrorMdl";
import { useEffect, useState } from "react";
import { useCurrentUserWallet } from "./CurrentUserWalletProvider";
import { useIssuerWallet } from "./IssuerWalletProvider";

const DisplayUserWallets = () => {
  const {
    currentUserWallets,
    fetchCurrentUserWallets,
    loading: userWalletsLoading,
    errorMessage: userWalletsErrorMessage,
  } = useCurrentUserWallet();
  const {
    issuerWallets,
    fetchIssuerWallets,
    loading: issuerWalletsLoading,
    errorMessage: issuerWalletsErrorMessage,
  } = useIssuerWallet();
  const loading = userWalletsLoading || issuerWalletsLoading;
  const loadWalletErrorMessage =
    userWalletsErrorMessage || issuerWalletsErrorMessage;
  const [errorMessage, setErrorMessage] = useState(loadWalletErrorMessage);
  useEffect(() => {
    if (loadWalletErrorMessage) {
      setErrorMessage(loadWalletErrorMessage);
    }
  }, [loadWalletErrorMessage]);

  const handleWalletCreated = async () => {
    await fetchIssuerWallets(); // re-fetch issuer wallets to ensure consistency
    await fetchCurrentUserWallets(); // re-fetch from server
  };

  const handleDeleteWallet = async () => {
    await fetchIssuerWallets(); // re-fetch issuer wallets to ensure consistency
    await fetchCurrentUserWallets(); // re-fetch after deletion
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
              className="relative rounded-lg bg-color2 p-4"
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
