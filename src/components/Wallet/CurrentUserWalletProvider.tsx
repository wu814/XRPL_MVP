"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { WalletApiResponse, CurrentUserWalletContextType } from "@/types/wallet";
import { YONAWallet } from "@/types/appTypes";

const CurrentUserWalletContext = createContext<CurrentUserWalletContextType | undefined>(undefined);

interface CurrentUserWalletProviderProps {
  children: ReactNode;
}

export default function CurrentUserWalletProvider({ children }: CurrentUserWalletProviderProps) {
  const { data: session } = useSession();
  const [currentUserWallets, setCurrentUserWallets] = useState<YONAWallet[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCurrentUserWallets = async (): Promise<void> => {
    if (!session?.user?.user_id) {
      console.log("No session or user_id found:", { session: session?.user });
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Changed from POST to GET - the API route uses the session to get user_id
      const response = await fetch("/api/wallet/getWalletsByUserID", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data: WalletApiResponse = await response.json();
      
      if (data.data) {
        const wallets: YONAWallet[] = data.data.map((wallet) => ({
          classicAddress: wallet.classic_address,
          walletType: wallet.wallet_type,
        }));
        setCurrentUserWallets(wallets);
      } else {
        console.log("No wallet data found");
        setCurrentUserWallets([]);
      }
    } catch (error) {
      console.error("Error fetching current user wallets:", error);
      setErrorMessage("Failed to fetch wallets");
      setCurrentUserWallets([]);
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch wallets when session changes
  useEffect(() => {
    if (session?.user?.user_id) {
      fetchCurrentUserWallets();
    }
  }, [session?.user?.user_id]);

  const contextValue: CurrentUserWalletContextType = {
    currentUserWallets,
    loading,
    errorMessage,
    fetchCurrentUserWallets,
  };

  return (
    <CurrentUserWalletContext.Provider value={contextValue}>
      {children}
    </CurrentUserWalletContext.Provider>
  );
};

export function useCurrentUserWallet(): CurrentUserWalletContextType {
  const context = useContext(CurrentUserWalletContext);
  if (context === undefined) {
    throw new Error("useCurrentUserWallet must be used within a CurrentUserWalletProvider");
  }
  return context;
};