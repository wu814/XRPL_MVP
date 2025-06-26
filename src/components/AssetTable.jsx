"use client";

import { Star, Wallet, ArrowUpRight, ArrowDownLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function AssetTable({ assets = [] }) {
  const [watchlist, setWatchlist] = useState(new Set());
  const [expandedAsset, setExpandedAsset] = useState(null);

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
    const icons = {
      XRP: "◊",
      USD: "$",
      EUR: "€",
      BTC: "₿",
      ETH: "Ξ",
    };
    return icons[currency] || currency.substring(0, 2);
  };

  const getCurrencyColor = (currency) => {
    const colors = {
      XRP: "bg-blue-500",
      USD: "bg-green-500",
      EUR: "bg-purple-500",
      BTC: "bg-orange-500",
      ETH: "bg-gray-600",
    };
    return colors[currency] || "bg-gray-500";
  };

  const handleAssetClick = (asset) => {
    setExpandedAsset(expandedAsset?.id === asset.id ? null : asset);
  };

  return (
    <div className="bg-color2 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">My Assets</h2>
          <div className="text-sm text-gray-400">XRPL Balances</div>
        </div>
      </div>

      {/* Compact Asset List */}
      <div className="divide-y divide-gray-700">
        {assets.map((asset, index) => (
          <div key={asset.id || index}>
            {/* Main Asset Row */}
            <div 
              className="p-3 hover:bg-color3 transition-colors cursor-pointer"
              onClick={() => handleAssetClick(asset)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-7 h-7 ${getCurrencyColor(asset.currency)} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                    {getCurrencyIcon(asset.currency)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{asset.currency}</div>
                    <div className="text-xs text-gray-400">
                      {formatBalance(asset.balance)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="font-semibold text-sm">${formatBalance(asset.value || 0)}</div>
                    <div className={`text-xs ${
                      (parseFloat(asset.change24h) || 0) >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {(parseFloat(asset.change24h) || 0) >= 0 ? "+" : ""}
                      {(parseFloat(asset.change24h) || 0).toFixed(2)}%
                    </div>
                  </div>
                  <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${
                    expandedAsset?.id === asset.id ? "rotate-90" : ""
                  }`} />
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedAsset?.id === asset.id && (
              <div className="px-3 pb-3 bg-color3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Balance:</span>
                    <div className="font-medium">{formatBalance(asset.balance)} {asset.currency}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">USD Value:</span>
                    <div className="font-medium">${formatBalance(asset.value || 0)}</div>
                  </div>
                  {asset.issuer && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Issuer:</span>
                      <div className="font-mono text-xs">
                        {asset.issuer.substring(0, 12)}...{asset.issuer.substring(-8)}
                      </div>
                    </div>
                  )}
                  {asset.walletAddress && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Wallet:</span>
                      <div className="font-mono text-xs">
                        {asset.walletAddress.substring(0, 12)}...{asset.walletAddress.substring(-8)}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-2 mt-3">
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors flex items-center space-x-1"
                    title="Send"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Send</span>
                  </button>
                  <button 
                    className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs transition-colors flex items-center space-x-1"
                    title="Receive"
                  >
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>Receive</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWatchlist(asset.id || asset.currency);
                    }}
                    className={`p-1 rounded transition-colors ${
                      watchlist.has(asset.id || asset.currency)
                        ? "text-yellow-400 hover:text-yellow-300"
                        : "text-gray-400 hover:text-gray-300"
                    }`}
                    title="Add to Watchlist"
                  >
                    <Star className={`w-3 h-3 ${watchlist.has(asset.id || asset.currency) ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="text-center py-8">
          <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold mb-1">No Assets Found</h3>
          <p className="text-gray-400 text-xs">Your wallet balances will appear here once you have assets.</p>
        </div>
      )}
    </div>
  );
} 