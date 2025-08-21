"use client";

import { useEffect, useState } from "react";
import { useCurrentUserWallet } from "../wallet/CurrentUserWalletProvider";
import { YONAWallet } from "@/types/appTypes";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronDown 
} from "lucide-react";
import Button from "../Button";

interface Transaction {
  hash: string;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  counterparty?: string;
  date?: string;
  result?: string;
  fee?: string;
}

interface TransactionResponse {
  transactions?: Transaction[];
  marker?: string;
  error?: string;
}


type TransactionDirection = 
  | "sent" 
  | "received" 
  | "smart_trade" 
  | "offer_create" 
  | "offer_cancel" 
  | "trustline_set" 
  | "amm_deposit" 
  | "amm_withdraw" 
  | "nft_mint" 
  | "nft_create_offer" 
  | "nft_accept_offer";

const getTransactionIcon = (direction: string, type?: string): React.ReactNode => {
  switch (direction as TransactionDirection) {
    case "sent":
      return <ArrowUpRight className="w-4 h-4 text-green-400" />;
    case "received":
      return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
    case "smart_trade":
      return <div className="w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold text-white">S</div>;
    case "offer_create":
      return <div className="w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center text-xs font-bold text-white">+</div>;
    case "offer_cancel":
      return <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center text-xs font-bold text-white">×</div>;
    case "trustline_set":
      return <div className="w-4 h-4 rounded-full bg-purple-400 flex items-center justify-center text-xs font-bold text-white">T</div>;
    case "amm_deposit":
      return <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center text-xs font-bold text-white">D</div>;
    case "amm_withdraw":
      return <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-xs font-bold text-white">W</div>;
    case "nft_mint":
      return <div className="w-4 h-4 rounded-full bg-pink-400 flex items-center justify-center text-xs font-bold text-white">M</div>;
    case "nft_create_offer":
      return <div className="w-4 h-4 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold text-white">O</div>;
    case "nft_accept_offer":
      return <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center text-xs font-bold text-white">A</div>;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const getTransactionColor = (direction: string): string => {
  switch (direction as TransactionDirection) {
    case "sent":
      return "text-green-400";
    case "received":
      return "text-green-400";
    case "smart_trade":
      return "text-yellow-400";
    case "offer_create":
      return "text-blue-400";
    case "offer_cancel":
      return "text-red-400";
    case "trustline_set":
      return "text-purple-400";
    case "amm_deposit":
      return "text-cyan-400";
    case "amm_withdraw":
      return "text-orange-400";
    case "nft_mint":
      return "text-pink-400";
    case "nft_create_offer":
      return "text-indigo-400";
    case "nft_accept_offer":
      return "text-emerald-400";
    default:
      return "text-gray-400";
  }
};

const formatTransactionType = (type: string, direction: string): string => {
  switch (direction as TransactionDirection) {
    case "sent":
      return "Sent";
    case "received":
      return "Received";
    case "smart_trade":
      return "Smart Trade";
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
    case "nft_mint":
      return "NFT Mint";
    case "nft_create_offer":
      return "NFT Create Offer";
    case "nft_accept_offer":
      return "NFT Accept Offer";
    default:
      return type || "Unknown";
  }
};

const formatAddress = (address: string): string => {
  if (!address) return "N/A";
  return address;
};

const formatAmount = (amount: string, currency: string): string => {
  if (!amount || amount === "N/A") return amount;
  
  if (typeof amount === "string" && amount.includes("→")) {
    return amount; // Already formatted for offers
  }
  
  // Check if amount is already formatted (contains currency symbols or +)
  if (typeof amount === "string" && (amount.includes(" ") || amount.includes("+"))) {
    // For AMM deposits like "1.000000 ETH" or "1.000000 ETH + 0.500000 XRP"
    return amount;
  }
  
  if (currency === "XRP") {
    return `${parseFloat(amount).toFixed(6)} XRP`;
  }
  
  return `${parseFloat(amount).toFixed(6)} ${currency}`;
};

export default function TransactionHistory() {
  const { currentUserWallets } = useCurrentUserWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [marker, setMarker] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [selectedWallet, setSelectedWallet] = useState<YONAWallet | null>(null);
  const [showWalletDropdown, setShowWalletDropdown] = useState<boolean>(false);

  // Determine the best default wallet based on user type
  const getDefaultWallet = (wallets: YONAWallet[]): YONAWallet | null => {
    if (!wallets || wallets.length === 0) return null;
    
    // For single wallet users, use the only wallet
    if (wallets.length === 1) return wallets[0];
    
    // For admin with multiple wallets, prioritize in this order:
    const walletTypePriority = [
      "ISSUER",
      "TREASURY",
      "PATHFIND", 
      "USER",
      "BUSINESS"
    ];
    
    for (const type of walletTypePriority) {
      const wallet = wallets.find(w => w.walletType === type);
      if (wallet) return wallet;
    }
    
    // Fallback to first wallet if no priority matches
    return wallets[0];
  };

  // Set default wallet when wallets are loaded
  useEffect(() => {
    if (currentUserWallets && currentUserWallets.length > 0 && !selectedWallet) {
      const defaultWallet = getDefaultWallet(currentUserWallets);
      setSelectedWallet(defaultWallet);
    }
  }, [currentUserWallets, selectedWallet]);

  // Get the current wallet to use for transactions
  const primaryWallet = selectedWallet || getDefaultWallet(currentUserWallets);

  const fetchTransactions = async (isLoadMore: boolean = false): Promise<void> => {
    if (!primaryWallet?.classicAddress) {
      console.log("No primary wallet found:", currentUserWallets);
      return;
    }

    console.log("Fetching transactions for wallet:", primaryWallet.classicAddress);
    console.log("Primary wallet details:", primaryWallet);

    setLoading(true);
    setError(null);

    try {
      const requestBody: any = {
        targetAddress: primaryWallet.classicAddress,
        limit: 50,
      };

      if (isLoadMore && marker) {
        requestBody.marker = marker;
      }

      const response = await fetch("/api/transaction/getAccountTransactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data: TransactionResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transactions");
      }

      if (!data.transactions) {
        console.warn("No transactions in response:", data);
        setTransactions([]);
        setMarker(null);
        setHasMore(false);
        return;
      }

      if (isLoadMore) {
        setTransactions(prev => [...prev, ...data.transactions!]);
      } else {
        setTransactions(data.transactions);
      }

      setMarker(data.marker || null);
      setHasMore(!!data.marker);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletChange = (wallet: YONAWallet): void => {
    setSelectedWallet(wallet);
    setShowWalletDropdown(false);
    setTransactions([]); // Clear existing transactions
    setMarker(null);
    setHasMore(true);
  };

  const handleLoadMore = (): void => {
    if (!loading && hasMore) {
      fetchTransactions(true);
    }
  };

  // Refetch transactions when the selected wallet changes
  useEffect(() => {
    if (primaryWallet) {
      fetchTransactions();
    }
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
          <div className="flex-1">
            <h2 className="text-xl font-bold">Transaction History</h2>
            
            {/* Wallet Selection - Show only if multiple wallets */}
            {currentUserWallets && currentUserWallets.length > 1 && (
              <div className="relative mt-2">
                <button
                  onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                  className="flex items-center justify-between w-full max-w-md px-3 py-2 bg-color3 rounded-lg text-sm hover:bg-color4 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400 font-medium">
                      {primaryWallet.walletType}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showWalletDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-color4 border border-gray-600 rounded-lg shadow-lg z-10">
                    {currentUserWallets.map((wallet) => (
                      <button
                        key={wallet.classicAddress}
                        onClick={() => handleWalletChange(wallet)}
                        className={`w-full px-3 py-2 text-left hover:bg-color5 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          selectedWallet?.classicAddress === wallet.classicAddress 
                            ? 'bg-color5 text-blue-400' 
                            : 'text-gray-300'
                        }`}
                      >
                        <div className="flex items-center">
                          <span className="font-medium">{wallet.walletType}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Single wallet display */}
            {(!currentUserWallets || currentUserWallets.length === 1) && (
              <p className="text-sm text-gray-400 mt-1">
                {formatAddress(primaryWallet.classicAddress)}
              </p>
            )}
          </div>
          
          <Button onClick={() => fetchTransactions()} className="flex items-center space-x-2">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-md">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="h-screen overflow-y-auto">
        {loading && transactions.length === 0 ? (
          <div className="p-6 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
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
                <Button onClick={handleLoadMore} disabled={loading} className="w-full flex flex-row items-center justify-center space-x-2">
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
