"use client";

import { useEffect, useState } from "react";
import { useCurrentUserWallet } from "./Wallet/CurrentUserWalletProvider";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink, Clock, CheckCircle, XCircle } from "lucide-react";

const getTransactionIcon = (direction, type) => {
  switch (direction) {
    case "sent":
      return <ArrowUpRight className="w-4 h-4 text-red-400" />;
    case "received":
      return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    case "offer_create":
      return <div className="w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center text-xs font-bold text-white">+</div>;
    case "offer_cancel":
      return <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-xs font-bold text-white">×</div>;
    case "trustline_set":
      return <div className="w-4 h-4 rounded-full bg-purple-400 flex items-center justify-center text-xs font-bold text-white">T</div>;
    case "amm_deposit":
      return <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-bold text-white">D</div>;
    case "amm_withdraw":
      return <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-xs font-bold text-white">W</div>;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const getTransactionColor = (direction) => {
  switch (direction) {
    case "sent":
      return "text-red-400";
    case "received":
      return "text-green-400";
    case "offer_create":
      return "text-blue-400";
    case "offer_cancel":
      return "text-gray-400";
    case "trustline_set":
      return "text-purple-400";
    case "amm_deposit":
      return "text-cyan-400";
    case "amm_withdraw":
      return "text-orange-400";
    default:
      return "text-gray-400";
  }
};

const formatTransactionType = (type, direction) => {
  switch (direction) {
    case "sent":
      return "Sent";
    case "received":
      return "Received";
    case "offer_create":
      return "Create Offer";
    case "offer_cancel":
      return "Cancel Offer";
    case "trustline_set":
      return "Set Trustline";
    case "amm_deposit":
      return "AMM Deposit";
    case "amm_withdraw":
      return "AMM Withdraw";
    default:
      return type || "Unknown";
  }
};

const formatAddress = (address) => {
  if (!address) return "N/A";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};

const formatAmount = (amount, currency) => {
  if (!amount || amount === "N/A") return amount;
  
  if (typeof amount === "string" && amount.includes("→")) {
    return amount; // Already formatted for offers
  }
  
  if (currency === "XRP") {
    return `${parseFloat(amount).toFixed(6)} XRP`;
  }
  
  return `${parseFloat(amount).toFixed(6)} ${currency}`;
};

export default function TransactionHistory() {
  const { currentUserWallets } = useCurrentUserWallet();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [marker, setMarker] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Find the primary wallet - try USER first, then any wallet that has the balance
  const primaryWallet = currentUserWallets?.find(
    (wallet) => wallet.walletType === "USER"
  ) || currentUserWallets?.find(
    (wallet) => wallet.walletType === "STANDBY PATHFIND"
  ) || currentUserWallets?.[0]; // Fallback to first wallet if none match

  const fetchTransactions = async (isLoadMore = false) => {
    if (!primaryWallet?.classicAddress) {
      console.log("No primary wallet found:", currentUserWallets);
      return;
    }

    console.log("Fetching transactions for wallet:", primaryWallet.classicAddress);
    console.log("Primary wallet details:", primaryWallet);

    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        wallet: primaryWallet,
        limit: 50, // Fetch more transactions initially
      };

      if (isLoadMore && marker) {
        requestBody.marker = marker;
      }

      const response = await fetch("/api/wallets/getAccountTransactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transactions");
      }

      // Handle case where no transactions are returned
      if (!data.transactions) {
        console.warn("No transactions in response:", data);
        setTransactions([]);
        setMarker(null);
        setHasMore(false);
        return;
      }

      if (isLoadMore) {
        setTransactions(prev => [...prev, ...data.transactions]);
      } else {
        setTransactions(data.transactions);
      }

      setMarker(data.marker);
      setHasMore(!!data.marker);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(true);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [primaryWallet]);

  if (!primaryWallet) {
    return (
      <div className="bg-color2 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Transaction History</h2>
        <div className="text-center py-8 text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No wallet found. Please create a wallet to view transactions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-color2 rounded-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Transaction History</h2>
            <p className="text-sm text-gray-400 mt-1">
              {formatAddress(primaryWallet.classicAddress)}
            </p>
          </div>
          <button
            onClick={() => fetchTransactions()}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-96 max-h-screen overflow-y-auto">
        {loading && transactions.length === 0 ? (
          <div className="p-6 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-gray-400">Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-400">Error: {error}</p>
            <button
              onClick={() => fetchTransactions()}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400 opacity-50" />
            <p className="text-gray-400">No transactions found</p>
            <p className="text-sm text-gray-500 mt-2">Your transaction history will appear here</p>
          </div>
        ) : (
          <>
            {/* Transaction List */}
            <div className="divide-y divide-gray-700">
              {transactions.map((tx, index) => (
                                 <div key={`${tx.hash}-${index}`} className="p-6 hover:bg-color3 transition-colors">
                  <div className="flex items-center justify-between">
                    {/* Left Section - Icon, Type, and Details */}
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        {getTransactionIcon(tx.direction, tx.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${getTransactionColor(tx.direction)}`}>
                            {formatTransactionType(tx.type, tx.direction)}
                          </span>
                          {tx.result === "tesSUCCESS" ? (
                            <CheckCircle className="w-3 h-3 text-green-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        
                                                 <div className="text-sm text-gray-400 mt-1">
                           {tx.counterparty && (
                             <span>
                               {tx.direction === "sent" ? "To: " : "From: "}
                               {formatAddress(tx.counterparty)}
                             </span>
                           )}
                           {tx.date && (
                             <span className="ml-2">
                               {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString()}
                             </span>
                           )}
                         </div>
                      </div>
                    </div>

                    {/* Right Section - Amount and Hash */}
                    <div className="flex items-center space-x-4 text-right">
                      <div>
                        <div className={`font-medium ${getTransactionColor(tx.direction)}`}>
                          {formatAmount(tx.amount, tx.currency)}
                        </div>
                        {tx.fee && (
                          <div className="text-xs text-gray-500">
                            Fee: {tx.fee} XRP
                          </div>
                        )}
                      </div>
                      
                      <a
                        href={`https://testnet.xrpl.org/transactions/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="View on XRPL Explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="p-4 border-t border-gray-700">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 