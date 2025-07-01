"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DisplayAdminWallets from "@/components/Wallet/DisplayAdminWallets";
import DisplayUserWallets from "@/components/Wallet/DisplayUserWallets";
import DashboardHeader from "@/components/DashboardHeader";
import AssetTable from "@/components/AssetTable";
import TradePanel from "@/components/Smart/TradePanel";
import TransactionHistory from "@/components/TransactionHistory";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";
import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import DeleteWalletBtn from "@/components/Wallet/DeleteWalletBtn";
import SetTrustlineBtn from "@/components/Wallet/SetTrustlineBtn";
import AuthorizeDepositBtn from "@/components/Wallet/AuthorizeDepositBtn";
import ViewDetailsBtn from "@/components/Wallet/ViewDetailsBtn";
import ClawbackTokenBtn from "@/components/Wallet/ClawbackTokenBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";
import CreateAdminWalletBtn from "@/components/Wallet/CreateAdminWalletBtn";
import CreateUserWalletBtn from "@/components/Wallet/CreateUserWalletBtn";
import Button from "@/components/Button";

// AssetTableWrapper component to access wallet context
function AssetTableWrapper() {
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get the primary wallet for fetching balances
  const primaryWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "STANDBY PATHFIND" ||
      wallet.walletType === "BUSINESS",
  );

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  const fetchAssets = async () => {
    if (!primaryWallet) return;

    setLoading(true);
    try {
      // Fetch account info and lines in parallel
      const [accountInfoResponse, accountLinesResponse] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: primaryWallet }),
        }),
        fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: primaryWallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountLines = await accountLinesResponse.json();

      const newAssets = [];

      // Add XRP balance
      if (accountInfo.data?.Balance) {
        const xrpBalance = parseFloat(accountInfo.data.Balance) / 1000000; // Convert drops to XRP
        newAssets.push({
          currency: "XRP",
          balance: xrpBalance.toFixed(6),
          issuer: null,
          usdValue: (xrpBalance * 0.5).toFixed(2), // Mock USD value
          change24h: "+2.3%",
          changeValue: "+$0.12",
          icon: "/icons/XRP.svg",
        });
      }

      // Add trustline balances
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach((line) => {
          if (parseFloat(line.balance) > 0) {
            const balance = parseFloat(line.balance);
            newAssets.push({
              currency: line.currency,
              balance: balance.toFixed(6),
              issuer: line.account,
              usdValue: (balance * 1.0).toFixed(2), // Mock USD value
              change24h: "+1.5%",
              changeValue: "+$0.08",
              icon: `/icons/${line.currency.toLowerCase()}.svg`,
            });
          }
        });
      }

      setAssets(newAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [primaryWallet]);

  // If no wallets exist, show a simple empty state
  if (currentUserWallets.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-color2">
        <div className="border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">My Assets</h2>
            <div className="text-sm text-gray-400">XRPL Balances</div>
          </div>
        </div>
        <div className="py-8 text-center">
          <div className="text-sm text-gray-400">
            Your wallet balances will appear here once you create a wallet.
          </div>
        </div>
      </div>
    );
  }

  return <AssetTable assets={assets} loading={loading} />;
}

// Welcome/Assets Section Component for Home Page
function WelcomeOrAssetsSection({ session }) {
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  // If user has no wallets, show prominent create wallet section
  if (currentUserWallets.length === 0) {
    return (
      <div className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <h2 className="mb-2 text-xl font-bold">
          Welcome to XRPL MVP, {session.user.username}!
        </h2>
        <p className="mb-4 text-blue-100">
          Get started by creating your first XRPL wallet to manage your digital
          assets.
        </p>
        <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 font-semibold">Create Your First Wallet</h3>
              <p className="text-sm text-blue-100">
                Start managing your XRPL assets with a secure custodial wallet.
              </p>
            </div>
            <CreateUserWalletBtn onWalletCreated={handleWalletCreated} />
          </div>
        </div>
      </div>
    );
  }

  // If user has wallets, show wallet details only
  return <UserWalletDetails />;
}

// User Wallet Details Component
function UserWalletDetails() {
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();
  const [walletBalance, setWalletBalance] = useState(null);
  const [reserveBreakdown, setReserveBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedReserveItems, setExpandedReserveItems] = useState(new Set());

  // Get the user's primary wallet
  const userWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "STANDBY PATHFIND" ||
      wallet.walletType === "BUSINESS",
  );

  // Constants for reserve calculation
  const BASE_RESERVE_XRP = 1; // Base reserve for an account in XRP
  const OWNER_RESERVE_XRP = 0.2; // Owner reserve for each object in XRP

  // Fetch wallet balance and reserve info
  const fetchWalletBalance = async () => {
    if (!userWallet) return;

    setLoading(true);
    try {
      const [accountInfoResponse, accountObjectsResponse] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: userWallet }),
        }),
        fetch("/api/wallets/getAccountObjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: userWallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountObjects = await accountObjectsResponse.json();

      if (accountInfo.data) {
        const balance = parseFloat(accountInfo.data.balance); // Already converted from drops
        const ownerCount = accountInfo.data.ownerCount || 0;
        const totalReserve = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
        const availableBalance = Math.max(0, balance - totalReserve);

        setWalletBalance({
          balance,
          ownerCount,
          totalReserve,
          availableBalance,
        });

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
                  obj.HighLimit?.issuer === userWallet.classicAddress
                    ? obj.LowLimit?.issuer
                    : obj.HighLimit?.issuer;
                details = `${currency} (${issuer?.slice(0, 8)}...)`;
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
                details = `Authorized: ${obj.Authorize?.slice(0, 8)}...`;
                break;
              case "Escrow":
                description = "Escrow";
                details = `Escrowed funds`;
                break;
              case "PayChannel":
                description = "Payment Channel";
                details = `Channel to ${obj.Destination?.slice(0, 8)}...`;
                break;
              case "Check":
                description = "Check";
                details = `Check from ${obj.Account?.slice(0, 8)}...`;
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
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletBalance();
  }, [userWallet]);

  const handleWalletAction = async () => {
    await fetchCurrentUserWallets();
    await fetchWalletBalance();
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

  if (!userWallet) return null;

  return (
    <div className="rounded-lg bg-color2 p-8">
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <h3 className="text-3xl font-bold">My Wallet</h3>
        </div>

        {/* Balance Information */}
        <div className="flex items-baseline space-x-6">
          {walletBalance ? (
            <>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-400">
                  Balance: {walletBalance.balance.toFixed(6)} XRP
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-400">
                  Available: {walletBalance.availableBalance.toFixed(6)} XRP
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-orange-400">
                  Reserved: {walletBalance.totalReserve.toFixed(1)} XRP
                </div>
              </div>
            </>
          ) : (
            <div className="text-lg text-gray-400">Loading balance...</div>
          )}
        </div>
      </div>

      {/* Wallet Address */}
      <div className="mb-6">
        <p className="font-mono text-lg text-gray-400">
          {userWallet.classicAddress}
        </p>
      </div>

      {/* Reserve Breakdown */}
      {reserveBreakdown.length > 0 && (
        <div className="mb-8">
          <h4 className="mb-5 text-2xl font-semibold">Reserve Breakdown</h4>
          <div className="space-y-4">
            {reserveBreakdown.map((reserve, index) => (
              <div key={index} className="rounded-lg bg-color3 p-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600">
                      <span className="text-sm font-bold text-white">R</span>
                    </div>
                    <div>
                      <div className="text-lg font-medium">{reserve.type}</div>
                      <div className="text-base text-gray-400">
                        {reserve.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium">
                      {reserve.xrpAmount.toFixed(1)} XRP
                    </div>
                    <div className="text-base text-gray-400">
                      {reserve.count} item{reserve.count > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                {reserve.items && reserve.items.length > 0 && (
                  <div className="ml-11 border-t border-gray-600 pt-3">
                    <div className="space-y-2 text-base text-gray-500">
                      {expandedReserveItems.has(index) ? (
                        // Show all items when expanded
                        <>
                          {reserve.items.map((item, itemIndex) => (
                            <div key={itemIndex}>• {item}</div>
                          ))}
                          <button
                            onClick={() => toggleReserveItemExpansion(index)}
                            className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Show less
                          </button>
                        </>
                      ) : (
                        // Show first 2 items with expand option
                        <>
                          {reserve.items.slice(0, 2).map((item, itemIndex) => (
                            <div key={itemIndex}>• {item}</div>
                          ))}
                          {reserve.items.length > 2 && (
                            <button
                              onClick={() => toggleReserveItemExpansion(index)}
                              className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                              ... and {reserve.items.length - 2} more (click to expand)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Management Actions */}
      <div className="flex gap-2 border-t border-gray-600 pt-6">
        <TransferBtn
          senderWallet={userWallet}
          issuerWallets={issuerWallets}
          onSuccess={handleWalletAction}
        />
        <SetTrustlineBtn
          setterWallet={userWallet}
          issuerWallets={issuerWallets}
          onSuccess={handleWalletAction}
        />
        <ViewDetailsBtn wallet={userWallet} />
      </div>
    </div>
  );
}

// Additional Welcome Section Component for users with wallets
function AdditionalWelcomeSection({ session }) {
  const { currentUserWallets } = useCurrentUserWallet();

  // Only show this section if user has wallets
  if (currentUserWallets.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-lg bg-color2 p-6">
      <h2 className="mb-6 text-2xl font-bold">
        Welcome, {session.user.username}
      </h2>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-color3 p-6">
          <h3 className="mb-4 text-xl font-semibold">
            Top Earning Pools (24hr)
          </h3>
          <div className="space-y-3 text-lg">
            <div className="flex justify-between">
              <span>XRP/USD</span>
              <span className="text-green-400">2.75%</span>
            </div>
            <div className="flex justify-between">
              <span>XRP/BTC</span>
              <span className="text-green-400">1.58%</span>
            </div>
            <div className="flex justify-between">
              <span>USD/BTC</span>
              <span className="text-green-400">1.23%</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-color3 p-6">
          <h3 className="mb-4 text-xl font-semibold">Recent Activity</h3>
          <div className="space-y-3 text-lg text-gray-400">
            <div>No recent transactions</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Admin Wallets Component
function AdminWalletsView() {
  const { currentUserWallets, fetchCurrentUserWallets } =
    useCurrentUserWallet();
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
            const totalReserve =
              BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
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
                          Issuer: {asset.issuer.slice(0, 8)}...
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
                    {/* Delete Wallet Button */}
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

export default function WalletPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Determine current tab from URL params
  const currentTab = searchParams.get("tab") || "home";
  const isAdmin = session?.user?.role === "ADMIN";

  if (status === "loading") {
    return (
      <div className="ml-64 mr-80 min-h-screen bg-color1 p-8">
        <div className="animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-gray-600"></div>
          <div className="mb-6 h-32 rounded bg-gray-600"></div>
          <div className="h-64 rounded bg-gray-600"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="ml-64 mr-80 min-h-screen bg-color1 p-8">
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-400">
            Please log in to access your wallet
          </h1>
        </div>
      </div>
    );
  }

  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>
        <div
          className="ml-64 min-h-screen w-full bg-color1 p-3"
          style={{ maxWidth: "calc(100vw - 16rem - 32rem)" }}
        >
          {/* Page Header */}
          <div className="mb-4 max-w-full">
            <h1 className="mb-1 text-2xl font-bold">
              {currentTab === "assets"
                ? isAdmin
                  ? "My Wallets"
                  : "My Assets"
                : currentTab === "transactions"
                  ? "Transactions"
                  : "Dashboard"}
            </h1>
            <p className="text-sm text-gray-400">
              {currentTab === "assets"
                ? isAdmin
                  ? "Manage your XRPL wallets"
                  : "View your XRPL assets and balances"
                : currentTab === "transactions"
                  ? "View your complete XRPL transaction history"
                  : "Your XRPL portfolio overview"}
            </p>
          </div>

          {/* Content based on current tab */}
          <div className="max-w-full">
            {currentTab === "home" ? (
              // Home Tab Content
              <div className="space-y-4">
                {/* Dashboard Header with Balance */}
                <div className="w-full">
                  <DashboardHeader />
                </div>

                {/* Welcome or Assets Overview */}
                <WelcomeOrAssetsSection session={session} />

                {/* Additional Welcome Section - only show if user has wallets */}
                <AdditionalWelcomeSection session={session} />
              </div>
            ) : currentTab === "transactions" ? (
              // Transactions Tab Content
              <div className="w-full space-y-4">
                <TransactionHistory />
              </div>
            ) : (
              // Assets/Wallets Tab Content
              <div className="w-full space-y-4">
                {isAdmin ? (
                  <AdminWalletsView />
                ) : (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">My Assets</h2>
                    </div>
                    <AssetTableWrapper />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trade Panel - Always visible */}
        <TradePanel user={session.user} session={session} />
      </IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
