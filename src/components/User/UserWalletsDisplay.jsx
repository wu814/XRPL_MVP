"use client";

import React, { useState, useEffect } from "react";
import CreateUserWalletBtn from "./CreateUserWalletBtn";
import DeleteWalletBtn from "../DeleteWalletBtn";
import SetTrustlineBtn from "../SetTrustlineBtn";
import ViewDetailsBtn from "../ViewDetailsBtn";
import TransferBtn from "../TransferBtn";

class Wallet {
  constructor(classicAddress, walletType, seed) {
    this.classicAddress = classicAddress;
    this.walletType = walletType;
    this.seed = seed;
  }
}

const UserWalletsDisplay = () => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [issuerWallets, setIssuerWallets] = useState([]);

  const fetchIssuerWallets = async () => {
    try {
      const response = await fetch("/api/wallets/getIssuerWallets");
      const data = await response.json();
      const issuerWalletsData = data.data.map(
        (wallet) =>
          new Wallet(
            wallet.classic_address,
            wallet.wallet_type,
            wallet.seed,
            wallet.xrp_balance,
          ),
      );
      setIssuerWallets(issuerWalletsData);
    } catch (error) {
      console.error("Error fetching issuer wallets:", error);
    }
  };

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/wallets/getWalletsByUserID");
      const data = await response.json();
      const walletsData = data.data.map(
        (wallet) =>
          new Wallet(
            wallet.classic_address,
            wallet.wallet_type,
            wallet.seed,
            wallet.xrp_balance,
          ),
      );
      setWallets(walletsData);
    } catch (error) {
      console.error("Error fetching wallets:", error);
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
      <CreateUserWalletBtn issuerWallets={issuerWallets} onWalletCreated={handleWalletCreated} />
    </div>
  );
};

export default UserWalletsDisplay;
