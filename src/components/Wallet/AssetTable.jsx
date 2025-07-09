"use client";

import { Wallet, ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import Button from "../Button";
import { formatCurrencyValue, getCurrencyIcon, getAssetKey } from "@/utils/xrpl/assets";

export default function AssetTable({ 
  assets = [], 
  loading = false, 
  isIssuer = false,
  wallet = null 
}) {
  const [expandedAssets, setExpandedAssets] = useState(new Set());

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

  const tableTitle = isIssuer ? "Issued Assets" : "Assets";
  const emptyStateTitle = isIssuer ? "No Issued Assets" : "No Assets Found";
  const emptyStateMessage = isIssuer 
    ? "This issuer wallet has not issued any currencies yet."
    : "Your wallet balances will appear here once you have assets.";

  return (
    <div className="w-full bg-color2 rounded-lg">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{tableTitle}</h2>
          <div className="text-xl font-bold">USD Values</div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Asset List */}
      {!loading && (
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
                          {formatCurrencyValue(asset.balance)}
                          {isIssuer && " issued"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-semibold text-xl">${formatCurrencyValue(asset.value || 0)}</div>
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
                  <div className="p-4 bg-color3">
                    <div className="flex flex-row justify-start gap-7">
                      {isIssuer ? (
                        <div>
                          <span className="text-gray-400">Issuer Address:</span>
                          <div className="font-mono break-all">
                            {wallet?.classicAddress || wallet?.classic_address}
                          </div>
                        </div>
                      ) : (
                        <>
                          {asset.issuer && (
                            <div>
                              <span className="text-gray-400">Issuer:</span>
                              <div className="font-mono break-all">
                                {asset.issuer}
                              </div>
                            </div>
                          )}
                          {asset.walletAddress && (
                            <div>
                              <span className="text-gray-400">Wallet:</span>
                              <div className="font-mono break-all">
                                {asset.walletAddress}
                              </div>
                            </div>
                          )}
                        </>
                      )}
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
          <h3 className="text-base font-semibold mb-1">{emptyStateTitle}</h3>
          <p className="text-gray-400">{emptyStateMessage}</p>
        </div>
      )}
    </div>
  );
} 