"use client";

import { createContext, useContext, useEffect, useState } from "react";

const IssuerWalletContext = createContext();

export const IssuerWalletProvider = ({ children }) => {
  const [issuerWallets, setIssuerWallets] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchIssuerWallets = async () => {
    try {
      const res = await fetch("/api/wallets/getIssuerWallets");
      const result = await res.json();

      const issuerWalletsData = (result.data || []).map((wallet) => ({
        classicAddress: wallet.classic_address,
        walletType: wallet.wallet_type,
        seed: wallet.seed,
      }));

      setIssuerWallets(issuerWalletsData);
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch issuer wallets");
    }
  };

  useEffect(() => {
    fetchIssuerWallets();
  }, []);

  return (
    <IssuerWalletContext.Provider
      value={{
        issuerWallets,
        errorMessage,
        fetchIssuerWallets,
      }}
    >
      {children}
    </IssuerWalletContext.Provider>
  );
};

export const useIssuerWallet = () => useContext(IssuerWalletContext);
