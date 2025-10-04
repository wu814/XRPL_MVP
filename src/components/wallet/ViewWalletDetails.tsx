"use client";
import { useState, useEffect } from "react";
import { Landmark } from "lucide-react";
import { YONAWallet } from "@/types/appTypes";
import { APIResponse } from "@/types/apiTypes";
import { AccountObject } from "xrpl";
interface ReserveItem {
  type: string;
  description: string;
  xrpAmount: number;
  count: number;
  items?: string[];
}

interface ViewWalletDetailsProps {
  wallet: YONAWallet;
  onBack: () => void;
}

export default function ViewWalletDetails({ wallet, onBack }: ViewWalletDetailsProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [reserveBreakdown, setReserveBreakdown] = useState<ReserveItem[]>([]);
  const [expandedReserveItems, setExpandedReserveItems] = useState<Set<number>>(new Set());
  const [accountFlags, setAccountFlags] = useState<string[]>([]);

  // Constants for reserve calculation
  const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
  const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

  // XRPL Account Flags mapping
  const ACCOUNT_FLAGS = {
    0x00010000: "lsfPasswordSpent",
    0x00020000: "lsfRequireDestTag",
    0x00040000: "lsfRequireAuth",
    0x00080000: "lsfDisallowXRP",
    0x00100000: "lsfDisableMaster",
    0x00200000: "lsfNoFreeze",
    0x00400000: "lsfGlobalFreeze",
    0x00800000: "lsfDefaultRipple",
    0x01000000: "lsfDepositAuth",
    0x02000000: "lsfDisallowIncomingXRP",
    0x04000000: "lsfDisallowIncomingCheck",
    0x08000000: "lsfDisallowIncomingPayChan",
    0x10000000: "lsfDisallowIncomingTrustline",
    0x20000000: "lsfDisallowIncomingNFTokenOffer",
    0x80000000: "lsfAllowTrustLineClawback",
  };

  const FLAG_DESCRIPTIONS: Record<string, string> = {
    lsfPasswordSpent: "Password Spent",
    lsfRequireDestTag: "Require Destination Tag",
    lsfRequireAuth: "Require Authorization for Trustlines",
    lsfDisallowXRP: "Disallow Incoming XRP",
    lsfDisableMaster: "Master Key Disabled",
    lsfNoFreeze: "No Freeze (cannot freeze trustlines)",
    lsfGlobalFreeze: "Global Freeze (all trustlines frozen)",
    lsfDefaultRipple: "Default Ripple (issuer setting)",
    lsfDepositAuth: "Deposit Authorization Required",
    lsfDisallowIncomingXRP: "Disallow Incoming XRP",
    lsfDisallowIncomingCheck: "Disallow Incoming Checks",
    lsfDisallowIncomingPayChan: "Disallow Incoming Payment Channels",
    lsfDisallowIncomingTrustline: "Disallow Incoming Trustlines",
    lsfDisallowIncomingNFTokenOffer: "Disallow Incoming NFT Offers",
    lsfAllowTrustLineClawback: "Allow Trustline Clawback",
  };

  const fetchReserveBreakdown = async (wallet: YONAWallet) => {
    setLoading(true);
    try {
      const [accountObjectsResponse, accountLinesResponse, accountInfoResponse] = await Promise.all([
        fetch("/api/wallet/getAccountObjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
        fetch("/api/wallet/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
        fetch("/api/wallet/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
      ]);

      const accountObjects: APIResponse<AccountObject[]> = await accountObjectsResponse.json();
      const accountLines: APIResponse<any[]> = await accountLinesResponse.json();
      const accountInfo: APIResponse<any> = await accountInfoResponse.json();
      console.log(accountObjects);
      console.log(accountLines);
      console.log(accountInfo);

      // Parse account flags
      if (accountInfo.data?.Flags) {
        const flags = Number(accountInfo.data.Flags);
        const activeFlags: string[] = [];
        
        Object.entries(ACCOUNT_FLAGS).forEach(([flagValue, flagName]) => {
          if ((flags & Number(flagValue)) !== 0) {
            activeFlags.push(flagName);
          }
        });
        
        setAccountFlags(activeFlags);
      } else {
        setAccountFlags([]);
      }

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

      // For issuer wallets, add authorized trustlines reserve
      if (wallet.walletType === "ISSUER" && accountLines.data && accountLines.data.length > 0) {
        const authorizedTrustlines = accountLines.data;
        const trustlineDetails = authorizedTrustlines.map((line: any) => {
          const currency = line.currency || "Unknown";
          // Get the counterparty address (the account that has the trustline TO the issuer)
          const counterparty = line.account || "Unknown";
          return `${currency} with ${counterparty}`;
        });

        if (authorizedTrustlines.length > 0) {
          reserves.push({
            type: "Authorized Trustlines",
            description: `${authorizedTrustlines.length} authorized trustline${authorizedTrustlines.length > 1 ? "s" : ""} requiring reserve`,
            xrpAmount: OWNER_RESERVE_XRP * authorizedTrustlines.length,
            count: authorizedTrustlines.length,
            items: trustlineDetails,
          });
        }
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

      {/* Account Flags Section - Only show if flags exist */}
      {accountFlags.length > 0 && (
        <div className="rounded-lg bg-color2 p-6">
          <h3 className="mb-4 text-lg font-semibold">Account Flags</h3>
          <div className="space-y-2">
            {accountFlags.map((flag, index) => (
              <div 
                key={index} 
                className="flex items-start space-x-3 rounded-lg bg-color3 p-3"
              >
                <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500"></div>
                <div>
                  <div className="font-medium text-sm">{flag}</div>
                  <div className="text-xs text-gray-400">
                    {FLAG_DESCRIPTIONS[flag] || flag}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
