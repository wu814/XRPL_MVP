"use client";

import { useState, useEffect } from "react";
import AssetTable from "./AssetTable";

export default function WalletAssetTable({ wallet }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletAssets = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
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

        const fetchedAssets = [];

        // Add XRP balance
        if (accountInfo.data?.Balance) {
          const xrpBalance = parseFloat(accountInfo.data.Balance) / 1000000;
          fetchedAssets.push({
            currency: "XRP",
            balance: xrpBalance.toFixed(6),
            issuer: null,
            value: xrpBalance * 0.5, // Mock USD value
            change24h: 0,
            walletAddress: wallet.classic_address,
          });
        }

        // Add trustline balances
        if (accountLines.data?.lines) {
          accountLines.data.lines.forEach((line) => {
            fetchedAssets.push({
              currency: line.currency,
              balance: parseFloat(line.balance).toFixed(6),
              issuer: line.account,
              value: parseFloat(line.balance) * 1.0, // Mock USD value
              change24h: 0,
              walletAddress: wallet.classic_address,
            });
          });
        }

        setAssets(fetchedAssets);
      } catch (error) {
        console.error("Error fetching wallet assets:", error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWalletAssets();
  }, [wallet]);

  if (loading) {
    return (
      <div className="w-full bg-color2 border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Assets</h2>
            <div className="text-xl font-bold">USD Values</div>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-mutedText">Loading assets...</p>
        </div>
      </div>
    );
  }

  return <AssetTable assets={assets} />;
} 