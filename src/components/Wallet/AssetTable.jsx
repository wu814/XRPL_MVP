"use client";

import { Wallet, ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Button from "../Button";
import { 
  formatCurrencyValue, 
  getCurrencyIcon, 
  getAssetKey, 
  isLpToken, 
  getLpTokenCurrencyPair, 
  formatLpTokenDisplay 
} from "@/utils/xrpl/assets";

// LP Token Icon Component - shows overlapping currency icons diagonally
const LpTokenIcon = ({ currencyA, currencyB, size = 40 }) => {
  const iconA = getCurrencyIcon(currencyA);
  const iconB = getCurrencyIcon(currencyB);
  const iconSize = Math.round(size * 0.7); // Calculate icon size once
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* First currency icon (top-left) */}
      <div className="absolute top-0 left-0 z-10">
        {iconA ? (
          <Image
            src={iconA}
            alt={currencyA}
            width={iconSize}
            height={iconSize}
            className="rounded-full"
          />
        ) : (
          <div 
            className="bg-gray-500 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ width: iconSize, height: iconSize }}
          >
            <span>{currencyA.substring(0, 2)}</span>
          </div>
        )}
      </div>
      
      {/* Second currency icon (bottom-right) */}
      <div className="absolute bottom-0 right-0 z-20">
        {iconB ? (
          <Image
            src={iconB}
            alt={currencyB}
            width={iconSize}
            height={iconSize}
            className="rounded-full"
          />
        ) : (
          <div 
            className="bg-gray-500 rounded-full flex items-center justify-center font-bold text-xs"
            style={{ width: iconSize, height: iconSize }}
          >
            <span>{currencyB.substring(0, 2)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function AssetTable({ 
  assets = [], 
  loading = false, 
  isIssuer = false,
  wallet = null 
}) {
  const [expandedAssets, setExpandedAssets] = useState(new Set());
  const [lpTokenPairs, setLpTokenPairs] = useState({});
  const [loadingPairs, setLoadingPairs] = useState(false);

  // Load LP token currency pairs when assets change
  useEffect(() => {
    const loadLpTokenPairs = async () => {
      const lpTokens = assets.filter(asset => isLpToken(asset));
      
      if (lpTokens.length === 0) {
        setLpTokenPairs({});
        return;
      }
      
      setLoadingPairs(true);
      const pairs = {};
      
      try {
        // Load currency pairs for all LP tokens
        await Promise.all(
          lpTokens.map(async (asset) => {
            const currencyPair = await getLpTokenCurrencyPair(asset.issuer);
            if (currencyPair) {
              pairs[asset.issuer] = currencyPair;
            }
          })
        );
        
        setLpTokenPairs(pairs);
      } catch (error) {
        console.error("Error loading LP token pairs:", error);
      } finally {
        setLoadingPairs(false);
      }
    };

    loadLpTokenPairs();
  }, [assets]);

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

  const getAssetDisplayName = (asset) => {
    if (isLpToken(asset)) {
      const currencyPair = lpTokenPairs[asset.issuer];
      return formatLpTokenDisplay(asset, currencyPair);
    }
    return asset.currency;
  };

  const getAssetIcon = (asset) => {
    if (isLpToken(asset)) {
      const currencyPair = lpTokenPairs[asset.issuer];
      if (currencyPair) {
        return (
          <LpTokenIcon 
            currencyA={currencyPair.currencyA} 
            currencyB={currencyPair.currencyB} 
            size={40} 
          />
        );
      }
      // Fallback while loading
      return "/icons/liquidity-pool-swap.png";
    }
    return getCurrencyIcon(asset.currency);
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
            const displayName = getAssetDisplayName(asset);
            const iconElement = getAssetIcon(asset);
            const isLp = isLpToken(asset);
            const currencyPair = isLp ? lpTokenPairs[asset.issuer] : null;
            
            return (
              <div key={assetKey}>
                {/* Main Asset Row */}
                <div 
                  className="p-3 hover:bg-color3 transition-colors cursor-pointer"
                  onClick={() => handleAssetClick(asset, index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 flex items-center justify-center">
                        {typeof iconElement === 'string' ? (
                          iconElement ? (
                            <Image
                              src={iconElement}
                              alt={displayName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center font-bold text-xs">
                              <span>{displayName.substring(0, 2)}</span>
                            </div>
                          )
                        ) : (
                          // Render the LP token icon component
                          iconElement
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">{displayName}</div>
                        <div className="text-gray-400 text-sm">
                          {formatCurrencyValue(asset.balance)}
                          {isIssuer && " issued"}
                          {isLp && loadingPairs && (
                            <span className="text-xs text-yellow-400 ml-2">
                              Loading...
                            </span>
                          )}
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
                    <div className="flex flex-col">
                      {isIssuer ? (
                        <div>
                          <span className="text-gray-400">Issuer Address:</span>
                          <div className="font-mono break-all text-sm">
                            {wallet?.classicAddress || wallet?.classic_address}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* LP Token specific details */}
                          {isLp && (
                            <div>
                              <div className="mt-2">
                                <div className="flex flex-row">
                                  <span className="text-gray-400 mr-2">AMM:</span>
                                  <div className="text-sm">
                                    {asset.issuer}
                                  </div>
                                </div>
                                <div className="flex flex-row">
                                  <span className="text-gray-400 mr-2">Token:</span>
                                  <div className="text-sm">
                                    {asset.currency}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Regular asset details */}
                          {!isLp && asset.issuer && (
                            <div className="flex flex-row">
                              <span className="text-gray-400 mr-2">Issuer:</span>
                              <div className="text-sm">
                                {asset.issuer}
                              </div>
                            </div>
                          )}
                          
                          {asset.walletAddress && (
                            <div className="flex flex-row">
                              <span className="text-gray-400 mr-2">Wallet:</span>
                              <div className="text-sm">
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