"use client";
import { useState, useEffect } from "react";
import { Landmark } from "lucide-react";
import { ReserveItem } from "@/types/wallet";
import { YONAWallet } from "@/types/appTypes";
import { GetAccountObjectsAPIResponse } from "@/types/api/walletAPITypes";


interface ViewWalletDetailsProps {
  wallet: YONAWallet;
  onBack: () => void;
}

export default function ViewWalletDetails({ wallet, onBack }: ViewWalletDetailsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [reserveBreakdown, setReserveBreakdown] = useState<ReserveItem[]>([]);
  const [expandedReserveItems, setExpandedReserveItems] = useState<Set<number>>(new Set());

  // Constants for reserve calculation
  const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
  const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

  const fetchReserveBreakdown = async (wallet: YONAWallet) => {
    setLoading(true);
    try {
      const accountObjectsResponse = await fetch("/api/wallet/getAccountObjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });

      const accountObjects: GetAccountObjectsAPIResponse = await accountObjectsResponse.json();
      console.log(accountObjects);

      // Process reserve breakdown
      const reserves: ReserveItem[] = [];

      // Base reserve
      reserves.push({
        type: "Base Account Reserve",
        description: "Required reserve for account existence",
        xrpAmount: BASE_RESERVE_XRP,
        count: 1,
      });

      // Process account objects for owner reserves
      if (accountObjects.data) {
        const objectCounts: Record<string, { description: string; items: string[]; count: number }> = {};

        accountObjects.data.forEach((obj) => {
          const type = obj.LedgerEntryType;
          
          // Skip RippleState (trustlines) for issuer wallets
          if (type === "RippleState" && (wallet.walletType === "ISSUER")) {
            return;
          }
          
          let description = "";
          let details = "";

          switch (type) {
            case "RippleState":
              description = "Trustline";
              const currency = obj.Balance?.currency || "Unknown";
              const issuer =
                obj.HighLimit?.issuer === wallet.classicAddress
                  ? obj.LowLimit?.issuer
                  : obj.HighLimit?.issuer;
              details = `${currency} (${issuer})`;
              break;
            case "Offer":
              description = "DEX Offer";
              const takerGets = typeof obj.TakerGets === 'string' 
                ? { value: obj.TakerGets, currency: 'XRP' }
                : { value: obj.TakerGets.value, currency: obj.TakerGets.currency };
              const takerPays = typeof obj.TakerPays === 'string'
                ? { value: obj.TakerPays, currency: 'XRP' }
                : { value: obj.TakerPays.value, currency: obj.TakerPays.currency };
              details = `${takerGets.value} ${takerGets.currency} → ${takerPays.value} ${takerPays.currency}`;
              break;
            case "AMM":
              description = "AMM Pool";
              details = `AMM participation`;
              break;
            case "DepositPreauth":
              description = "Deposit Authorization";
              details = `Authorized: ${obj.Authorize}`;
              break;
            case "Escrow":
              description = "Escrow";
              details = `Escrowed funds`;
              break;
            case "PayChannel":
              description = "Payment Channel";
              details = `Channel to ${obj.Destination}`;
              break;
            case "Check":
              description = "Check";
              details = `Check from ${obj.Account}`;
              break;
            default:
              description = type;
              details = "Reserve-consuming object";
          }

          if (!objectCounts[type]) {
            objectCounts[type] = { description, items: [], count: 0 };
          }
          objectCounts[type].items.push(details);
          objectCounts[type].count++;
        });

        // Add owner reserves to breakdown
        Object.entries(objectCounts).forEach(([type, data]) => {
          reserves.push({
            type: data.description,
            description: `${data.count} object${data.count > 1 ? "s" : ""} requiring reserve`,
            xrpAmount: OWNER_RESERVE_XRP * data.count,
            count: data.count,
            items: data.items,
          });
        });
      }

      setReserveBreakdown(reserves);
    } catch (error) {
      console.error("Error fetching reserve breakdown:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReserveItemExpansion = (index: number) => {
    setExpandedReserveItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Fetch reserve breakdown when component mounts or wallet changes
  useEffect(() => {
    if (wallet) {
      fetchReserveBreakdown(wallet);
    }
  }, [wallet]);

  if (!wallet) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-primary hover:scale-105 ml-2"
      >
        <span>←</span>
        <span>Back to My Wallets</span>
      </button>

      {/* Wallet Details Header */}
      <div className="rounded-lg bg-color2 p-6">
        <h2 className="mb-2 text-xl font-bold">
          {wallet.classicAddress}
        </h2>
        <p className="text-gray-400">Type: {wallet.walletType}</p>
      </div>

      {/* Reserved XRP Breakdown */}
      <div className="rounded-lg bg-color2 p-6">
        <h3 className="mb-4 text-lg font-semibold">Reserved</h3>
        {loading ? (
          <div className="py-8 text-center">Loading reserve breakdown...</div>
        ) : reserveBreakdown.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No reserve information found
          </div>
        ) : (
          <div className="space-y-3">
            {reserveBreakdown.map((reserve, index) => (
              <div key={index} className="rounded-lg bg-color3 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Landmark className="w-7 h-7 text-primary" />
                    <div>
                      <div className="font-medium">{reserve.type}</div>
                      <div className="text-sm text-gray-400">
                        {reserve.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {reserve.xrpAmount.toFixed(1)} XRP
                    </div>
                    <div className="text-sm text-gray-400">
                      {reserve.count} item{reserve.count > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                {reserve.items && reserve.items.length > 0 && (
                  <div className="ml-11 border-t border-gray-600 pt-2">
                    <div className="space-y-1 text-sm text-gray-500">
                      {expandedReserveItems.has(index) ? (
                        // Show all items when expanded
                        <>
                          {reserve.items.map((item, itemIndex) => (
                            <div key={itemIndex}>• {item}</div>
                          ))}
                          <button
                            onClick={() => toggleReserveItemExpansion(index)}
                            className="mt-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Show less
                          </button>
                        </>
                      ) : (
                        // Show first 3 items with expand option
                        <>
                          {reserve.items.slice(0, 3).map((item, itemIndex) => (
                            <div key={itemIndex}>• {item}</div>
                          ))}
                          {reserve.items.length > 3 && (
                            <button
                              onClick={() => toggleReserveItemExpansion(index)}
                              className="mt-1 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                              ... and {reserve.items.length - 3} more (click to expand)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 rounded-lg border-2 border-orange-600 bg-color3 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Reserved:</span>
                <span className="font-bold text-orange-400">
                  {reserveBreakdown
                    .reduce((sum, reserve) => sum + reserve.xrpAmount, 0)
                    .toFixed(1)}{" "}
                  XRP
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
