"use client";

import { Star, Wallet, ArrowUpRight, ArrowDownLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Button from "../Button";

export default function IssuerAssetTable({ wallet }) {
  const [watchlist, setWatchlist] = useState(new Set());
  const [expandedAssets, setExpandedAssets] = useState(new Set());
  const [linesData, setLinesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedBalances, setGroupedBalances] = useState({});

  const toggleWatchlist = (assetId) => {
    const newWatchlist = new Set(watchlist);
    if (newWatchlist.has(assetId)) {
      newWatchlist.delete(assetId);
    } else {
      newWatchlist.add(assetId);
    }
    setWatchlist(newWatchlist);
  };

  const formatBalance = (balance) => {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  };

  const getCurrencyIcon = (currency) => {
    const iconPaths = {
      XRP: "/icons/XRP.svg",
      USD: "/icons/USD.svg",
      EUR: "/icons/EUR.svg",
      BTC: "/icons/BTC.svg",
      ETH: "/icons/ETH.svg",
      SOL: "/icons/SOL.svg",
    };
    return iconPaths[currency] || null;
  };

  const handleAssetClick = (currency) => {
    const newExpandedAssets = new Set(expandedAssets);
    if (newExpandedAssets.has(currency)) {
      newExpandedAssets.delete(currency);
    } else {
      newExpandedAssets.add(currency);
    }
    setExpandedAssets(newExpandedAssets);
  };

  // Fetch account lines for the wallet
  useEffect(() => {
    const fetchIssuerData = async () => {
      if (!wallet) return;

      setLoading(true);
      try {
        const response = await fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        });

        const data = await response.json();
        if (data.data?.lines) {
          setLinesData(data.data.lines);
          
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
          
          setGroupedBalances(grouped);
        }
      } catch (error) {
        console.error("Error fetching issuer data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssuerData();
  }, [wallet]);

  // Convert grouped balances to array for rendering
  const assets = Object.entries(groupedBalances).map(([currency, totalBalance]) => ({
    currency,
    balance: totalBalance.toFixed(6),
    value: totalBalance * 1.0, // Mock USD value
    change24h: 0, // Mock 24h change
  }));

  return (
    <div className="w-full bg-color2 border border-gray-700 rounded-lg">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Issued Assets</h2>
          <div className="text-xl font-bold">USD Values</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-mutedText">Loading...</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-700">
          {assets.map((asset) => {
            const isExpanded = expandedAssets.has(asset.currency);
            
            return (
              <div key={asset.currency}>
                {/* Main Asset Row */}
                <div 
                  className="p-3 hover:bg-color3 transition-colors cursor-pointer"
                  onClick={() => handleAssetClick(asset.currency)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 flex items-center justify-center">
                        {getCurrencyIcon(asset.currency) ? (
                          <Image
                            src={getCurrencyIcon(asset.currency)}
                            alt={asset.currency}
                            width={30}
                            height={30}
                            className="w-8 h-8"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center font-bold">
                            <span>{asset.currency.substring(0, 2)}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">{asset.currency}</div>
                        <div className="text-gray-400">
                          {formatBalance(asset.balance)} issued
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-semibold text-xl">${formatBalance(asset.value || 0)}</div>
                        <div className={`${
                          (parseFloat(asset.change24h) || 0) >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {(parseFloat(asset.change24h) || 0) >= 0 ? "+" : ""}
                          {(parseFloat(asset.change24h) || 0).toFixed(2)}%
                        </div>
                      </div>
                      <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 bg-color3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-gray-400">Total Issued:</span>
                        <div className="font-medium">{formatBalance(asset.balance)} {asset.currency}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">USD Value:</span>
                        <div className="font-medium">${formatBalance(asset.value || 0)}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400">Issuer Address:</span>
                        <div className="font-mono break-all">
                          {wallet?.classicAddress || wallet?.classic_address}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 mt-3">
                      <Button variant="primary" className="flex flex-row items-center space-x-1">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Manage</span>
                      </Button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(asset.currency);
                        }}
                        className={`p-1 rounded transition-colors ${
                          watchlist.has(asset.currency)
                            ? "text-yellow-400 hover:text-yellow-300"
                            : "text-gray-400 hover:text-gray-300"
                        }`}
                        title="Add to Watchlist"
                      >
                        <Star className={`w-4 h-4 ${watchlist.has(asset.currency) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && assets.length === 0 && (
        <div className="text-center py-8">
          <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold mb-1">No Issued Assets</h3>
          <p className="text-gray-400">This issuer wallet has not issued any currencies yet.</p>
        </div>
      )}
    </div>
  );
} 