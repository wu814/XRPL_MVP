"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { WalletApiResponse, IssuerWalletContextType } from "@/types/wallet";
import { YONAWallet } from "@/types/appTypes";

const IssuerWalletContext = createContext<IssuerWalletContextType | undefined>(undefined);

interface IssuerWalletProviderProps {
  children: ReactNode;
}

export default function IssuerWalletProvider({ children }: IssuerWalletProviderProps) {
  const { data: session } = useSession();
  const [issuerWallets, setIssuerWallets] = useState<YONAWallet[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchIssuerWallets = async (): Promise<void> => {
    try {
      const response = await fetch("/api/wallet/getIssuerWallets", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data: WalletApiResponse = await response.json();
      if (data.data) {
        const wallets: YONAWallet[] = data.data.map((wallet) => ({
          classicAddress: wallet.classic_address,
          walletType: wallet.wallet_type,
        }));
        setIssuerWallets(wallets);
      } else {
        setIssuerWallets([]);
      }
    } catch (error) {
      console.error("Error fetching issuer wallets:", error);
      setErrorMessage("Failed to fetch issuer wallets");
      setIssuerWallets([]);
    }
  };

  useEffect(() => {
    fetchIssuerWallets();
  }, []);

  const contextValue: IssuerWalletContextType = {
    issuerWallets,
    errorMessage,
    fetchIssuerWallets,
  };

  return (
    <IssuerWalletContext.Provider value={contextValue}>
      {children}
    </IssuerWalletContext.Provider>
  );
};

export function useIssuerWallet(): IssuerWalletContextType {
  const context = useContext(IssuerWalletContext);
  if (context === undefined) {
    throw new Error("useIssuerWallet must be used within an IssuerWalletProvider");
  }
  return context;
};
