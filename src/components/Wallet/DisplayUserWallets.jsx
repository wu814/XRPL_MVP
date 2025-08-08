"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import AssetTable from "@/components/Wallet/AssetTable";
import SetTrustlineBtn from "@/components/Wallet/SetTrustlineBtn";
import TransferBtn from "@/components/Wallet/TransferBtn";
import CreateUserWalletBtn from "@/components/Wallet/CreateUserWalletBtn";
import Button from "@/components/Button";
import ViewWalletDetails from "@/components/Wallet/ViewWalletDetails";
import AddFundsBtn from "./AddFunds";


// User Wallet Details Component
function UserWalletDetails({ onViewDetails }) {
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();
  const [walletBalance, setWalletBalance] = useState(null);
  const [reserveBreakdown, setReserveBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedReserveItems, setExpandedReserveItems] = useState(new Set());

  // Get the user's primary wallet
  const userWallet = currentUserWallets?.find(
    (wallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "PATHFIND" ||
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
        const balance = parseFloat(accountInfo.data.balance);
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
          <h3 className="text-2xl font-bold">My Wallet</h3>
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
                <div className="text-lg font-semibold text-gray-400">
                  Reserved: {walletBalance.totalReserve.toFixed(1)} XRP
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-500">
                  Available: {walletBalance.availableBalance.toFixed(6)} XRP
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
    

      {/* Wallet Management Actions */}
      <div className="flex justify-between border-t border-gray-600 pt-6">
        <div className="flex gap-2">
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
        </div>
        <Button onClick={() => onViewDetails(userWallet)}>View Details</Button>
      </div>
    </div>
  );
}

// Additional Welcome Section Component for users with wallets
function AdditionalWelcomeSection() {
  const { data: session } = useSession();
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

// Main DisplayUserWallets Component
export default function DisplayUserWallets() {
  const { data: session } = useSession();
  const { currentUserWallets, fetchCurrentUserWallets } = useCurrentUserWallet();
  const [selectedWallet, setSelectedWallet] = useState(null);

  const handleWalletCreated = async () => {
    await fetchCurrentUserWallets();
  };

  const handleViewDetails = (wallet) => {
    setSelectedWallet(wallet);
  };

  const handleCloseDetails = () => {
    setSelectedWallet(null);
  };

  // If a wallet is selected, show the details view
  if (selectedWallet) {
    return (
      <ViewWalletDetails
        wallet={selectedWallet}
        onBack={handleCloseDetails}
      />
    );
  }

  // If user has no wallets, show prominent create wallet section
  if (currentUserWallets.length === 0) {
    return (
      <div className="space-y-4">
        <div className="w-full rounded-lg bg-gradient-to-r from-[#77C7F1] via-[#A156E2] to-[#8875DD] p-6 text-white">
          <h2 className="mb-2 text-xl font-bold">
            Welcome to XRPL MVP, {session.user.username}!
          </h2>
          <p className="mb-4 text-blue-100">
            Get started by creating your first XRPL wallet to manage your digital assets.
          </p>
          <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center space-x-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-6 w-6" />
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
      </div>
    );
  }

  // If user has wallets, show wallet details and additional sections
  return (
    <div className="space-y-4">
      <UserWalletDetails onViewDetails={handleViewDetails} />
      <AddFundsBtn />
      <AdditionalWelcomeSection />
    </div>
  );
}
