"use client";

import { Star, Wallet, ArrowUpRight, ArrowDownLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

export default function AssetTable({ assets = [] }) {
  const [watchlist, setWatchlist] = useState(new Set());
  const [expandedAssets, setExpandedAssets] = useState(new Set());

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

  const getAssetKey = (asset, index) => {
    return asset.id || `${asset.currency}-${asset.walletAddress || index}`;
  };

  const handleAssetClick = (asset, index) => {
    const assetKey = getAssetKey(asset, index);
    const newExpandedAssets = new Set(expandedAssets);
    if (newExpandedAssets.has(assetKey)) {
      newExpandedAssets.delete(assetKey);
    } else {
      newExpandedAssets.add(assetKey);
    }
    setExpandedAssets(newExpandedAssets);
  };

  return (
    <div className="bg-color2 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">My Assets</h2>
          <div className="text-gray-400">USD Values</div>
        </div>
      </div>

      {/* Compact Asset List */}
      <div className="divide-y divide-gray-700">
        {assets.map((asset, index) => {
          const assetKey = getAssetKey(asset, index);
          const isExpanded = expandedAssets.has(assetKey);
          
          return (
            <div key={assetKey}>
              {/* Main Asset Row */}
              <div 
                className="p-3 hover:bg-color3 transition-colors cursor-pointer"
                onClick={() => handleAssetClick(asset, index)}
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
                        {formatBalance(asset.balance)}
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
                        <div className="font-mono break-all">
                          {asset.issuer}
                        </div>
                      </div>
                    )}
                    {asset.walletAddress && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Wallet:</span>
                        <div className="font-mono break-all">
                          {asset.walletAddress}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 mt-3">
                    <button 
                      className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors flex items-center space-x-1"
                      title="Send"
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                    <button 
                      className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors flex items-center space-x-1"
                      title="Receive"
                    >
                      <ArrowDownLeft className="w-3 h-3" />
                      <span>Receive</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWatchlist(assetKey);
                      }}
                      className={`p-1 rounded transition-colors ${
                        watchlist.has(assetKey)
                          ? "text-yellow-400 hover:text-yellow-300"
                          : "text-gray-400 hover:text-gray-300"
                      }`}
                      title="Add to Watchlist"
                    >
                      <Star className={`w-3 h-3 ${watchlist.has(assetKey) ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="text-center py-8">
          <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold mb-1">No Assets Found</h3>
          <p className="text-gray-400">Your wallet balances will appear here once you have assets.</p>
        </div>
      )}
    </div>
  );
} 