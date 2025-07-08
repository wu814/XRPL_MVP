"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import AuthRedirect from "@/components/AuthRedirect";
import AssetTable from "@/components/Wallet/AssetTable";
import IssuerAssetTable from "@/components/Wallet/IssuerAssetTable";
import { Wallet, Loader2 } from "lucide-react";
import {
  CurrentUserWalletProvider,
  useCurrentUserWallet,
} from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import TradePanel from "@/components/Smart/TradePanel";

// AssetTableWrapper component to handle wallet assets
function AssetTableWrapper({ wallet }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      // Step 1: Get treasury wallet (oracle account)
      const treasuryResponse = await fetch("/api/wallets/getTreasuryWallet");
      const treasuryData = await treasuryResponse.json();

      let livePrices = [];
      if (treasuryData.data && treasuryData.data.length > 0) {
        const treasuryWallet = treasuryData.data[0];

        // Step 2: Get live prices from oracle
        const pricesResponse = await fetch("/api/oracle/getLivePrices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: treasuryWallet.classic_address,
            oracleDocumentId: 1, // Using default oracle document ID
            ledgerIndex: "validated",
          }),
        });

        const pricesData = await pricesResponse.json();
        if (pricesData.success) {
          livePrices = pricesData.livePrices;
        }
      }

      // Step 3: Fetch account info and lines
      const [accountInfoResponse, accountLinesResponse] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
        fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountLines = await accountLinesResponse.json();

      const newAssets = [];

      // Add XRP balance
      if (accountInfo.data?.balance) {
        const xrpBalance = parseFloat(accountInfo.data.balance);
        
        // Calculate USD value using live prices
        let usdValue = 0;
        const xrpPrice = livePrices.find(p => p.baseAsset === "XRP");
        if (xrpPrice && xrpPrice.available) {
          usdValue = xrpBalance * xrpPrice.price;
        }

        newAssets.push({
          id: "xrp-native",
          currency: "XRP",
          balance: xrpBalance.toFixed(6),
          value: usdValue.toFixed(2),
          change24h: "2.3", // You might want to get real change data too
          walletAddress: wallet.classicAddress,
          issuer: null,
        });
      }

      // Add trustline balances
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach((line, index) => {
          if (parseFloat(line.balance) > 0) {
            const balance = parseFloat(line.balance);
            const currency = line.currency;
            console.log(currency);
            
            // Calculate USD value using live prices
            let usdValue = 0;
            if (currency === "USD") {
              // USD is 1:1 ratio
              usdValue = balance;
            } else {
              const priceInfo = livePrices.find(p => p.baseAsset === currency);
              if (priceInfo && priceInfo.available) {
                usdValue = balance * priceInfo.price;
              }
            }

            newAssets.push({
              id: `${line.currency}-${line.account}-${index}`,
              currency: line.currency,
              balance: balance.toFixed(6),
              value: usdValue.toFixed(2),
              change24h: "1.5", // You might want to get real change data too
              walletAddress: wallet.classicAddress,
              issuer: line.account,
            });
          }
        });
      }

      setAssets(newAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [wallet]);

  return <AssetTable assets={assets} loading={loading} />;
}

// IssuerAssetTableWrapper component to handle issuer wallet assets
function IssuerAssetTableWrapper({ wallet }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchIssuerAssets = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      // Step 1: Get treasury wallet (oracle account)
      const treasuryResponse = await fetch("/api/wallets/getTreasuryWallet");
      const treasuryData = await treasuryResponse.json();

      let livePrices = [];
      if (treasuryData.data && treasuryData.data.length > 0) {
        const treasuryWallet = treasuryData.data[0];

        // Step 2: Get live prices from oracle
        const pricesResponse = await fetch("/api/oracle/getLivePrices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: treasuryWallet.classic_address,
            oracleDocumentId: 1,
            ledgerIndex: "validated",
          }),
        });

        const pricesData = await pricesResponse.json();
        if (pricesData.success) {
          livePrices = pricesData.livePrices;
        }
      }

      // Step 3: Fetch account lines for issuer
      const response = await fetch("/api/wallets/getAccountLines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });

      const data = await response.json();
      if (data.data?.lines) {
        // Group and sum balances by currency
        const grouped = data.data.lines.reduce((acc, line) => {
          const currency = line.currency;
          const balance = parseFloat(line.balance);

          if (!acc[currency]) {
            acc[currency] = 0;
          }
          acc[currency] += balance;
          return acc;
        }, {});

        // Convert grouped balances to assets array
        const newAssets = Object.entries(grouped).map(([currency, totalBalance]) => {
          // Calculate USD value using live prices
          let usdValue = 0;
          if (currency === "USD") {
            usdValue = totalBalance;
          } else {
            const priceInfo = livePrices.find(p => p.baseAsset === currency);
            if (priceInfo && priceInfo.available) {
              usdValue = totalBalance * priceInfo.price;
            }
          }

          return {
            id: `issuer-${currency}`,
            currency,
            balance: totalBalance.toFixed(6),
            value: usdValue.toFixed(2),
            change24h: "0", // Mock 24h change
            walletAddress: wallet.classicAddress,
            issuer: wallet.classicAddress,
          };
        });

        setAssets(newAssets);
      }
    } catch (error) {
      console.error("Error fetching issuer assets:", error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuerAssets();
  }, [wallet]);

  return <IssuerAssetTable assets={assets} loading={loading} wallet={wallet} />;
}

// WalletsWrapper component to access wallet context
function WalletsWrapper() {
  const { currentUserWallets, loading, errorMessage } = useCurrentUserWallet();

  const getWalletDisplayName = (walletType) => {
    switch (walletType) {
      case "ISSUER":
        return "Issuer Wallet";
      case "STANDBY TREASURY":
        return "Treasury Wallet";
      case "STANDBY PATHFIND":
        return "Pathfind Wallet";
      default:
        return walletType;
    }
  };

  const getWalletIcon = (walletType) => {
    return <Wallet className="h-8 w-8" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="py-8 text-center">
        <div className="mb-4 text-red-500">Error: {errorMessage}</div>
      </div>
    );
  }

  if (currentUserWallets.length === 0) {
    return (
      <div className="py-8 text-center">
        <Wallet className="mx-auto mb-4 h-16 w-16 text-gray-400" />
        <h3 className="mb-2 text-xl font-semibold">No Wallets Found</h3>
        <p className="text-mutedText">
          You haven't created any wallets yet. Create your first wallet to
          get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {currentUserWallets.map((wallet, index) => (
        <div
          key={index}
          className="rounded-lg border border-gray-700 bg-color2 p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getWalletIcon(wallet.walletType)}
              <div>
                <h3 className="text-xl font-semibold">
                  {getWalletDisplayName(wallet.walletType)}
                </h3>
                <p className="font-mono text-mutedText">
                  {wallet.classicAddress}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-primary/20 px-3 py-1 text-sm text-primary">
                {wallet.walletType}
              </span>
            </div>
          </div>

          {/* Render appropriate asset table based on wallet type */}
          {wallet.walletType === "ISSUER" ? (
            <IssuerAssetTableWrapper wallet={wallet} />
          ) : (
            <AssetTableWrapper wallet={wallet} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function WalletsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-gray-400" />
          <p className="text-mutedText">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <AuthRedirect />;
  }

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div className="min-h-screen p-2">
          <div className="mx-auto max-w-6xl">
            <WalletsWrapper />
          </div>
          <TradePanel />
        </div>
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
