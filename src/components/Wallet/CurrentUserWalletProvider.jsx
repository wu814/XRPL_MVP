"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CurrentUserWalletContext = createContext();

export const CurrentUserWalletProvider = ({ children }) => {
  const [currentUserWallets, setCurrentUserWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const typeOrder = {
    "ISSUER": 0,
    "PATHFIND": 1,
    "TREASURY": 2,
  };

  const fetchCurrentUserWallets = async () => {
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
    } catch (err) {
      setErrorMessage(err.message || "Failed to fetch user wallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUserWallets();
  }, []);

  return (
    <CurrentUserWalletContext.Provider
      value={{
        currentUserWallets,
        loading,
        errorMessage,
        fetchCurrentUserWallets,
      }}
    >
      {children}
    </CurrentUserWalletContext.Provider>
  );
};

export const useCurrentUserWallet = () => useContext(CurrentUserWalletContext);
