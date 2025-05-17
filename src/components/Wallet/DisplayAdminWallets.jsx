"use client";

import React, { useState, useEffect } from "react";
import CreateAdminWalletBtn from "./CreateAdminWalletBtn";
import DeleteWalletBtn from "./DeleteWalletBtn";
import SetTrustlineBtn from "./SetTrustlineBtn";
import ViewDetailsBtn from "./ViewDetailsBtn";
import TransferBtn from "./TransferBtn";
import ErrorModal from "../ErrorMdl";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}

const DisplayAdminWallets = () => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  // Define a sort order for wallet types. Issuer always on top, then Standby, then Operational.
  const typeOrder = {
    "ISSUER": 0,
    "STANDBY TREASURY": 1,
    "STANDBY PATHFIND": 2,
  };

  const updateIssuerWallets = (walletsArray) => {
    const issuerWallets = walletsArray.filter(
      (wallet) => wallet.walletType === "ISSUER",
    );
    setIssuerWallets(issuerWallets);
  };

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/wallets/getWalletsByUserID");
      const data = await response.json();
      const walletsData = data.data
        .map(
          (wallet) =>
            new Wallet(
              wallet.classic_address,
              wallet.wallet_type,
              wallet.seed,
              wallet.xrp_balance,
            ),
        )
        .sort((a, b) => typeOrder[a.walletType] - typeOrder[b.walletType]);
      setWallets(walletsData);
      updateIssuerWallets(walletsData);
    } catch (error) {
      setErrorMessage("Error fetching wallets: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  // Instead of re-fetching wallets, update the state with the new wallet, and update the issuer wallets.
  const handleWalletCreated = (newWalletData) => {
    setWallets((prevWallets) => {
      const updatedWallets = [...prevWallets, newWalletData].sort(
        (a, b) => typeOrder[a.walletType] - typeOrder[b.walletType],
      );
      updateIssuerWallets(updatedWallets);
      return updatedWallets;
    });
  };

  // Instead of re-fetching wallets, filter out the deleted wallet, and update the issuer wallets.
  const handleDeleteWallet = (deletedClassicAddress) => {
    setWallets((prevWallets) => {
      const updatedWallets = prevWallets.filter(
        (wallet) => wallet.classicAddress !== deletedClassicAddress,
      );
      updateIssuerWallets(updatedWallets);
      return updatedWallets;
    });
  };

  return (
    <div className="container mx-auto mr-4">
      {loading ? (
        <p className="text-center">Loading Wallets...</p>
      ) : wallets.length === 0 ? (
        <p className="text-center">No wallets found.</p>
      ) : (
        <div className="flex flex-col space-y-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.classicAddress}
              className="relative rounded-lg bg-[#242639] p-4 shadow-lg"
            >
              <h3 className="text-xl font-bold mb-3">{wallet.classicAddress}</h3>
              <p>Type: {wallet.walletType}</p>
              <DeleteWalletBtn
                classicAddress={wallet.classicAddress}
                onWalletDeleted={handleDeleteWallet}
              />
              <div className="absolute right-3 bottom-3 flex flex-row space-x-2">
                <TransferBtn
                  senderWallet={wallet}
                  issuerWallets={issuerWallets}
                />
                {/* Conditionally render set trustline buttons */}
                {(wallet.walletType === "STANDBY TREASURY" ||
                  wallet.walletType === "STANDBY PATHFIND") && (
                    <SetTrustlineBtn
                      setterWallet={wallet}
                      issuerWallets={issuerWallets}
                    />
                  )}
                <ViewDetailsBtn wallet={wallet} />
              </div>
            </div>
          ))}
        </div>
      )}
      <CreateAdminWalletBtn onWalletCreated={handleWalletCreated} />

      {errorMessage && (
        <ErrorModal
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
};

export default DisplayAdminWallets;
