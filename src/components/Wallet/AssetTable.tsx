"use client";

import { useState, useEffect } from "react";
import { Wallet, ChevronRight, Loader2 } from "lucide-react";
import Image from "next/image";
import { formatCurrencyValue, getCurrencyIcon, fetchUSDPrices, PriceInfo } from "@/utils/currencyUtils";
import {
  getAssetKey,
  isLpToken,
  getLpTokenCurrencyPair,
  formatLpTokenDisplay,
  Asset,
  CurrencyPair,
  fetchWalletAssets,
} from "@/utils/assetUtils";
import { YONAWallet } from "@/types/appTypes";

interface WalletInfo {
  classicAddress?: string;
  classic_address?: string;
}

interface LpTokenIconProps {
  currencyA: string;
  currencyB: string;
  size?: number;
}

interface AssetTableProps {
  assets?: Asset[];
  loading?: boolean;
  isIssuer?: boolean;
  wallet?: WalletInfo | null;
}

// LP Token Icon Component - shows overlapping currency icons diagonally
function LpTokenIcon({ currencyA, currencyB, size = 40 }: LpTokenIconProps) {
  const iconA = getCurrencyIcon(currencyA);
  const iconB = getCurrencyIcon(currencyB);
  const iconSize = Math.round(size * 0.7); // Calculate icon size once

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* First currency icon (top-left) */}
      <div className="absolute left-0 top-0 z-10">
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
            className="flex items-center justify-center rounded-full bg-gray-500 text-xs font-bold"
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
            className="flex items-center justify-center rounded-full bg-gray-500 text-xs font-bold"
            style={{ width: iconSize, height: iconSize }}
          >
            <span>{currencyB.substring(0, 2)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function useLivePrices() {
  const [livePrices, setLivePrices] = useState<PriceInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await fetchUSDPrices();
        setLivePrices(prices);
      } catch (error) {
        console.error("Error fetching live prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  return { livePrices, loading };
}

export function useWalletAssets(
  wallet: YONAWallet | null,
  livePrices: PriceInfo[],
  isIssuer: boolean = false
) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!wallet) {
      setAssets([]);
      return;
    }

    setLoading(true);
    fetchWalletAssets(wallet, livePrices, isIssuer)
      .then(setAssets)
      .finally(() => setLoading(false));
  }, [wallet, livePrices, isIssuer]);

  return { assets, loading };
}

export default function AssetTable({
  assets = [],
  loading = false,
  isIssuer = false,
  wallet = null,
}: AssetTableProps) {
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [lpTokenPairs, setLpTokenPairs] = useState<Record<string, CurrencyPair>>({});
  const [loadingPairs, setLoadingPairs] = useState<boolean>(false);

  // Load LP token currency pairs when assets change
  useEffect(() => {
    const loadLpTokenPairs = async () => {
      const lpTokens = assets.filter((asset) => isLpToken(asset));

      if (lpTokens.length === 0) {
        setLpTokenPairs({});
        return;
      }

      setLoadingPairs(true);
      const pairs: Record<string, CurrencyPair> = {};

      try {
        // Load currency pairs for all LP tokens
        await Promise.all(
          lpTokens.map(async (asset) => {
            if (asset.issuer) {
              const currencyPair = await getLpTokenCurrencyPair(asset.issuer);
              if (currencyPair) {
                pairs[asset.issuer] = currencyPair;
              }
            }
          }),
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

  const handleAssetClick = (asset: Asset, index: number) => {
    const assetKey = getAssetKey(asset, index);
    const newExpandedAssets = new Set(expandedAssets);
    if (newExpandedAssets.has(assetKey)) {
      newExpandedAssets.delete(assetKey);
    } else {
      newExpandedAssets.add(assetKey);
    }
    setExpandedAssets(newExpandedAssets);
  };

  const getAssetDisplayName = (asset: Asset): string => {
    if (isLpToken(asset) && asset.issuer) {
      const currencyPair = lpTokenPairs[asset.issuer];
      return formatLpTokenDisplay(asset, currencyPair);
    }
    return asset.currency;
  };

  const getAssetIcon = (asset: Asset): string | React.ReactElement => {
    if (isLpToken(asset) && asset.issuer) {
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
    return getCurrencyIcon(asset.currency) || "";
  };

  const tableTitle = isIssuer ? "Issued Assets" : "Assets";
  const emptyStateTitle = isIssuer ? "No Issued Assets" : "No Assets Found";
  const emptyStateMessage = isIssuer
    ? "This issuer wallet has not issued any currencies yet."
    : "Your wallet balances will appear here once you have assets.";

  return (
    <div className="w-full rounded-lg bg-color2">
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{tableTitle}</h2>
          <div className="text-xl font-bold">USD Values</div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
            const currencyPair = isLp && asset.issuer ? lpTokenPairs[asset.issuer] : null;

            return (
              <div key={assetKey}>
                {/* Main Asset Row */}
                <div
                  className="cursor-pointer p-3 transition-colors hover:bg-color3"
                  onClick={() => handleAssetClick(asset, index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center">
                        {typeof iconElement === "string" ? (
                          iconElement ? (
                            <Image
                              src={iconElement}
                              alt={displayName}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-500 text-xs font-bold">
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
                        <div className="text-sm text-gray-400">
                          {formatCurrencyValue(asset.balance)}
                          {isIssuer && " issued"}
                          {isLp && loadingPairs && (
                            <span className="ml-2 text-xs text-yellow-400">
                              Loading...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-xl font-semibold">
                          ${formatCurrencyValue(asset.value || 0)}
                        </div>
                        <div
                          className={`${
                            (parseFloat(asset.change24h) || 0) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {(parseFloat(asset.change24h) || 0) >= 0 ? "+" : ""}
                          {(parseFloat(asset.change24h) || 0).toFixed(2)}%
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-3 w-3 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="bg-color3 p-4">
                    <div className="flex flex-col">
                      {isIssuer ? (
                        <div>
                          <span className="text-gray-400">Issuer Address:</span>
                          <div className="break-all font-mono text-sm">
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
                                  <span className="mr-2 text-gray-400">
                                    AMM:
                                  </span>
                                  <div className="text-sm">{asset.issuer}</div>
                                </div>
                                <div className="flex flex-row">
                                  <span className="mr-2 text-gray-400">
                                    Token:
                                  </span>
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
                              <span className="mr-2 text-gray-400">
                                Issuer:
                              </span>
                              <div className="text-sm">{asset.issuer}</div>
                            </div>
                          )}

                          {asset.walletAddress && (
                            <div className="flex flex-row">
                              <span className="mr-2 text-gray-400">
                                Wallet:
                              </span>
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
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && assets.length === 0 && (
        <div className="py-8 text-center">
          <Wallet className="mx-auto mb-2 h-8 w-8 text-gray-400" />
          <h3 className="mb-1 text-base font-semibold">{emptyStateTitle}</h3>
          <p className="text-gray-400">{emptyStateMessage}</p>
        </div>
      )}
    </div>
  );
};
