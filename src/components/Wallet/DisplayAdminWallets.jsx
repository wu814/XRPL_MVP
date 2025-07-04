"use client";
import { useState, useEffect } from "react";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import DeleteWalletBtn from "@/components/Wallet/DeleteWalletBtn";
import SetTrustlineBtn from "@/components/Wallet/SetTrustlineBtn";
import AuthorizeDepositBtn from "@/components/Wallet/AuthorizeDepositBtn";
import ClawbackTokenBtn from "@/components/Wallet/ClawbackTokenBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";
import CreateAdminWalletBtn from "@/components/Wallet/CreateAdminWalletBtn";
import Button from "@/components/Button";

export default function DisplayAdminWallets() {
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const { issuerWallets, fetchIssuerWallets } = useIssuerWallet();
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [walletAssets, setWalletAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});
  const [expandedReserveItems, setExpandedReserveItems] = useState(new Set());

  // Constants for reserve calculation
  const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
  const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

  // Fetch balance and reserve info for all wallets
  const fetchWalletBalances = async () => {
    const balances = {};

    try {
      const promises = currentUserWallets.map(async (wallet) => {
        try {
          const response = await fetch("/api/wallets/getAccountInfo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet }),
          });

          const data = await response.json();
          if (data.data) {
            const balance = parseFloat(data.data.balance); // Already converted from drops
            const ownerCount = data.data.ownerCount || 0;
            const totalReserve = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
            const availableBalance = Math.max(0, balance - totalReserve);

            balances[wallet.classicAddress] = {
              balance,
              ownerCount,
              totalReserve,
              availableBalance,
            };
          }
        } catch (error) {
          console.error(
            `Error fetching balance for ${wallet.classicAddress}:`,
            error,
          );
          balances[wallet.classicAddress] = {
            balance: 0,
            ownerCount: 0,
            totalReserve: BASE_RESERVE_XRP,
            availableBalance: 0,
          };
        }
      });

      await Promise.all(promises);
      setWalletBalances(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    }
  };

  // Fetch balances when wallets change
  useEffect(() => {
    if (currentUserWallets.length > 0) {
      fetchWalletBalances();
    }
  }, [currentUserWallets]);

  const [reserveBreakdown, setReserveBreakdown] = useState([]);

  const fetchWalletAssets = async (wallet) => {
    setLoading(true);
    try {
      const [
        accountInfoResponse,
        accountLinesResponse,
        accountObjectsResponse,
      ] = await Promise.all([
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
        fetch("/api/wallets/getAccountObjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountLines = await accountLinesResponse.json();
      const accountObjects = await accountObjectsResponse.json();

      const assets = [];

      // Add XRP balance
      if (accountInfo.data?.Balance) {
        const xrpBalance = parseFloat(accountInfo.data.Balance) / 1000000;
        assets.push({
          currency: "XRP",
          balance: xrpBalance.toFixed(6),
          issuer: null,
          usdValue: (xrpBalance * 0.5).toFixed(2),
        });
      }

      // Add trustline balances
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach((line) => {
          assets.push({
            currency: line.currency,
            balance: parseFloat(line.balance).toFixed(6),
            issuer: line.account,
            usdValue: (parseFloat(line.balance) * 1.0).toFixed(6),
          });
        });
      }

      // Process reserve breakdown
      const reserves = [];

      // Base reserve
      reserves.push({
        type: "Base Account Reserve",
        description: "Required reserve for account existence",
        xrpAmount: BASE_RESERVE_XRP,
        count: 1,
      });

      // Process account objects for owner reserves
      if (accountObjects.data?.account_objects) {
        const objectCounts = {};

        accountObjects.data.account_objects.forEach((obj) => {
          const type = obj.LedgerEntryType;
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
              details = `${obj.TakerGets?.currency || "XRP"} → ${obj.TakerPays?.currency || "XRP"}`;
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
      setWalletAssets(assets);
    } catch (error) {
      console.error("Error fetching wallet assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (wallet) => {
    setSelectedWallet(wallet);
    fetchWalletAssets(wallet);
  };

  const handleCloseDetails = () => {
    setSelectedWallet(null);
    setWalletAssets([]);
  };

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
    await fetchIssuerWallets();
  };

  const handleDeleteWallet = async () => {
    await fetchCurrentUserWallets();
    await fetchIssuerWallets();
  };

  const toggleReserveItemExpansion = (index) => {
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

  if (selectedWallet) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={handleCloseDetails}
          className="flex items-center space-x-2 text-blue-400 transition-colors hover:text-blue-300"
        >
          <span>←</span>
          <span>Back to My Wallets</span>
        </button>

        {/* Wallet Details Header */}
        <div className="rounded-lg bg-color2 p-6">
          <h2 className="mb-2 text-xl font-bold">
            {selectedWallet.classicAddress}
          </h2>
          <p className="text-gray-400">Type: {selectedWallet.walletType}</p>
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600">
                        <span className="text-sm font-bold text-white">R</span>
                      </div>
                      <div>
                        <div className="font-medium">{reserve.type}</div>
                        <div className="text-xs text-gray-400">
                          {reserve.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {reserve.xrpAmount.toFixed(1)} XRP
                      </div>
                      <div className="text-xs text-gray-400">
                        {reserve.count} item{reserve.count > 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  {reserve.items && reserve.items.length > 0 && (
                    <div className="ml-11 border-t border-gray-600 pt-2">
                      <div className="space-y-1 text-xs text-gray-500">
                        {expandedReserveItems.has(index) ? (
                          // Show all items when expanded
                          <>
                            {reserve.items.map((item, itemIndex) => (
                              <div key={itemIndex}>• {item}</div>
                            ))}
                            <button
                              onClick={() => toggleReserveItemExpansion(index)}
                              className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
                                className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
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

        {/* Wallet Assets */}
        <div className="rounded-lg bg-color2 p-6">
          <h3 className="mb-4 text-lg font-semibold">Assets</h3>
          {loading ? (
            <div className="py-8 text-center">Loading assets...</div>
          ) : walletAssets.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              No assets found
            </div>
          ) : (
            <div className="space-y-3">
              {walletAssets.map((asset, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-color3 p-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                      <span className="text-sm font-bold text-white">
                        {asset.currency.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{asset.currency}</div>
                      {asset.issuer && (
                        <div className="text-xs text-gray-400">
                          Issuer: {asset.issuer}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{asset.balance}</div>
                    <div className="text-sm text-gray-400">
                      ${asset.usdValue}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Wallets</h2>
      </div>

      {currentUserWallets.length === 0 ? (
        <div className="rounded-lg bg-color2 p-8 text-center">
          <div className="mb-4 text-gray-400">No wallets found</div>
          <p className="text-sm text-gray-500">
            Create your first wallet to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {currentUserWallets.map((wallet) => {
            const balanceInfo = walletBalances[wallet.classicAddress];

            return (
              <div
                key={wallet.classicAddress}
                className="relative rounded-lg bg-color2 p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="mb-1 text-lg font-bold">
                      {wallet.classicAddress}
                    </h3>
                    <p className="text-gray-400">Type: {wallet.walletType}</p>
                  </div>

                  {/* Balance and Reserve Information */}
                  <div className="mx-4 flex items-center space-x-6">
                    {balanceInfo ? (
                      <>
                        <div className="text-right">
                          <div className="text-base font-semibold text-gray-400">
                            Balance: {balanceInfo.balance.toFixed(6)} XRP
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold text-gray-400">
                            Available: {balanceInfo.availableBalance.toFixed(6)}{" "}
                            XRP
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-semibold text-gray-400">
                            Reserve: {balanceInfo.totalReserve.toFixed(1)} XRP (
                            {balanceInfo.ownerCount} objects)
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-400">
                        Loading balance...
                      </div>
                    )}
                  </div>
                </div>

                {/* Wallet Management Options */}
                <div className="flex justify-between gap-2 border-t border-gray-600 pt-4">
                  <div className="flex flex-row gap-2">
                    {/* Transfer Button - Available for all wallets */}
                    <TransferBtn
                      senderWallet={wallet}
                      issuerWallets={issuerWallets}
                      onSuccess={fetchWalletBalances}
                    />

                    {/* Treasury-specific options */}
                    {wallet.walletType === "STANDBY TREASURY" && (
                      <AuthorizeDepositBtn
                        treasuryWallet={wallet}
                        onSuccess={fetchWalletBalances}
                      />
                    )}

                    {/* Trustline options for Treasury and Pathfind wallets */}
                    {(wallet.walletType === "STANDBY TREASURY" ||
                      wallet.walletType === "STANDBY PATHFIND") && (
                      <SetTrustlineBtn
                        setterWallet={wallet}
                        issuerWallets={issuerWallets}
                        onSuccess={fetchWalletBalances}
                      />
                    )}

                    {/* Issuer-specific options */}
                    {wallet.walletType === "ISSUER" && (
                      <ClawbackTokenBtn issuerWallet={wallet} />
                    )}
                  </div>
                  <div>
                    {/* View Details Button */}
                    <Button onClick={() => handleViewDetails(wallet)}>
                      View Details
                    </Button>
                  </div>
                </div>
                <DeleteWalletBtn
                  classicAddress={wallet.classicAddress}
                  onWalletDeleted={handleDeleteWallet}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Create Wallet Button for Admin */}
      <div className="rounded-lg border-2 border-dashed border-gray-600 bg-color2 p-6">
        <div className="text-center">
          <h3 className="mb-2 font-semibold">Create New Wallet</h3>
          <p className="mb-4 text-sm text-gray-400">
            Add a new ISSUER, STANDBY TREASURY, or STANDBY PATHFIND wallet
          </p>
          <CreateAdminWalletBtn onWalletCreated={handleWalletCreated} />
        </div>
      </div>
    </div>
  );
}
