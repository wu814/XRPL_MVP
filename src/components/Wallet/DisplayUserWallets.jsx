"use client";

import React, { useState, useEffect } from "react";
import CreateUserWalletBtn from "./CreateUserWalletBtn";
import AddFundsBtn from "./AddFunds";
import DeleteWalletBtn from "./DeleteWalletBtn";
import SetTrustlineBtn from "./SetTrustlineBtn";
import ViewDetailsBtn from "./ViewDetailsBtn";
import TransferBtn from "./TransferBtn";
import ErrorMdl from "../ErrorMdl";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}

const DisplayUserWallets = () => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchIssuerWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getIssuerWallets");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const issuerWalletsData = result.data.map(
          (wallet) =>
            new Wallet(wallet.classic_address, wallet.wallet_type, wallet.seed),
        );
        setIssuerWallets(issuerWalletsData);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch issuer wallets");
    }
  };

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallets/getWalletsByUserID");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const walletsData = result.data.map(
          (wallet) =>
            new Wallet(wallet.classic_address, wallet.wallet_type, wallet.seed),
        );
        setWallets(walletsData);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch user wallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
    fetchIssuerWallets();
  }, []);

  const handleWalletCreated = (newWalletData) => {
    setWallets((prevWallets) => {
      const updatedWallets = [...prevWallets, newWalletData];
      return updatedWallets;
    });
  };

  const handleDeleteWallet = (deletedClassicAddress) => {
    setWallets((prevWallets) => {
      const updatedWallets = prevWallets.filter(
        (wallet) => wallet.classicAddress !== deletedClassicAddress,
      );
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
      {wallets.length === 0 ? (
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
