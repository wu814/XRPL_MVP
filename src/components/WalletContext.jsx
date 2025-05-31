"use client";

import { createContext, useContext, useEffect, useState } from "react";

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [currentUserWallets, setCurrentUserWallets] = useState([]);
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const typeOrder = {
    ISSUER: 0,
    "STANDBY TREASURY": 1,
    "STANDBY PATHFIND": 2,
  };

  const fetchWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getWalletsByUserID");
      const result = await res.json();
      const normalizedWallets = (result.data || [])
        .map((wallet) => ({
          classicAddress: wallet.classic_address,
          walletType: wallet.wallet_type,
          seed: wallet.seed,
        }))
        .sort((a, b) => typeOrder[a.walletType] - typeOrder[b.walletType]);

      setCurrentUserWallets(normalizedWallets);
      setCurrentUserWallets(normalizedWallets);
    } catch (err) {
      setErrorMessage(err.message || "Failed to fetch user wallets");
    } finally {
      setLoading(false);
    }
  };

  const fetchIssuerWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getIssuerWallets");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const issuerWalletsData = result.data.map((wallet) => ({
          classicAddress: wallet.classic_address,
          walletType: wallet.wallet_type,
          seed: wallet.seed,
        }));
        setIssuerWallets(issuerWalletsData);
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch issuer wallets");
    }
  };

  useEffect(() => {
    fetchWallets();
    fetchIssuerWallets();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        currentUserWallets,
        issuerWallets,
        loading,
        errorMessage,
        fetchWallets,
        fetchIssuerWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
