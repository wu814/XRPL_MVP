"use client";

import { useState, useContext, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Building2, Search, Star, X, ChevronDown, RefreshCw } from "lucide-react";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";

// Custom Currency Dropdown Component
function CurrencyDropdown({ value, onChange, currencies, className = "", isOpen, onToggle, dropdownId }) {
  const selectedCurrency = currencies.find(c => c.id === value) || currencies[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(dropdownId)}
        className="w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 flex items-center justify-between hover:border-gray-500 focus:border-blue-500 outline-none"
      >
        <div className="flex items-center space-x-3">
          <img
            src={selectedCurrency.avatar}
            alt={selectedCurrency.name}
            className="w-6 h-6 rounded-full"
          />
          <span className="text-white font-medium">{selectedCurrency.id}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-color2 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {currencies.map((currency) => (
            <button
              key={currency.id}
              type="button"
              onClick={() => {
                onChange(currency.id);
                onToggle(null);
              }}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-color3 text-left transition-colors"
            >
              <img
                src={currency.avatar}
                alt={currency.name}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-white font-medium">{currency.id}</span>
              <span className="text-gray-400 text-sm">- {currency.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Asset Selection Component for Convert Tab
function AssetSelector({ asset, onSelect, label, availableAmount, currencies }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-color3 rounded-lg p-5 mb-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 ${asset.color} rounded-full flex items-center justify-center text-white font-bold`}>
            <img
              src={asset.avatar}
              alt={asset.name}
              className="w-8 h-8 rounded-full"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span style={{ display: 'none' }}>{asset.icon}</span>
          </div>
          <div>
            <div className="font-medium text-lg">{label}</div>
            <div className="text-sm text-gray-400">{asset.name}</div>
          </div>
        </div>
        {availableAmount && (
          <div className="text-right">
            <div className="font-medium text-lg">${availableAmount}</div>
            <div className="text-sm text-gray-400">Available</div>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-color2 rounded transition-colors"
        >
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-3 left-0 right-0 bg-color2 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {currencies.map((currency) => (
            <button
              key={currency.id}
              type="button"
              onClick={() => {
                onSelect(currency.id);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-color3 text-left transition-colors"
            >
              <img
                src={currency.avatar}
                alt={currency.name}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-white font-medium">{currency.id}</span>
              <span className="text-gray-400 text-sm">- {currency.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradePanel({ user, session }) {
  const [activeTab, setActiveTab] = useState("Convert");
  const [amount, setAmount] = useState("");
  
  // Available currencies with avatars
  const availableCurrencies = [
    { id: "XRP", name: "XRP", icon: "◊", color: "bg-blue-500", avatar: "/icons/xrp.svg" },
    { id: "USD", name: "USD", icon: "$", color: "bg-green-500", avatar: "/icons/usd.svg" },
    { id: "EUR", name: "EUR", icon: "€", color: "bg-purple-500", avatar: "/icons/eur.svg" },
    { id: "BTC", name: "Bitcoin", icon: "₿", color: "bg-orange-500", avatar: "/icons/btc.svg" },
    { id: "ETH", name: "Ethereum", icon: "Ξ", color: "bg-gray-600", avatar: "/icons/eth.svg" },
    { id: "SOL", name: "Solana", icon: "◎", color: "bg-indigo-500", avatar: "/icons/sol.svg" },
  ];

  // Trade panel assets for Convert
  const [fromAsset, setFromAsset] = useState(availableCurrencies[3]); // BTC
  const [toAsset, setToAsset] = useState(availableCurrencies[4]); // ETH
  
  // Send form states
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendCurrency, setSendCurrency] = useState("XRP");
  const [receiveCurrency, setReceiveCurrency] = useState("USD");
  const [sendDestTag, setSendDestTag] = useState("");
  const [sendSlippage, setSendSlippage] = useState("0.0");
  const [sendMode, setSendMode] = useState("direct"); // "direct" or "convertible"
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open

  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Get the primary wallet for sending
  const senderWallet = currentUserWallets?.find(
    (wallet) => wallet.walletType === "USER" || wallet.walletType === "STANDBY PATHFIND"
  );

  // Ensure send and receive currencies are different for convertible payments
  useEffect(() => {
    if (sendMode === "convertible" && sendCurrency === receiveCurrency) {
      // Find a different currency for receive
      const differentCurrency = availableCurrencies.find(c => c.id !== sendCurrency);
      if (differentCurrency) {
        setReceiveCurrency(differentCurrency.id);
      }
    }
  }, [sendCurrency, receiveCurrency, sendMode, availableCurrencies]);

  // Mock favorites and recents for the modal
  const favorites = [
    { name: "Matthew Goodman", address: "rhkDbx...k9uhgG", lastSent: "3 wk. ago" }
  ];

  const recents = [
    { address: "rwnYLU...nqf63J", lastSent: "2 months ago" },
    { address: "0xf839...0369e4", lastSent: "11 months ago" },
    { address: "rUy72X...zNDTD2", lastSent: "1 year ago" }
  ];
  
  const handleMax = () => {
    if (activeTab === "Convert") {
      setAmount("10.49");
    }
  };

  const getCurrencyData = (currencyId) => {
    return availableCurrencies.find(c => c.id === currencyId) || availableCurrencies[0];
  };

  const handleRecipientClick = (recipient) => {
    setSendRecipient(recipient.address || recipient.name);
  };

  const handleDropdownToggle = (dropdownId) => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  const handleSendSubmit = async (e) => {
    e.preventDefault();
    if (!sendRecipient || !sendAmount || !senderWallet) return;

    setIsLoading(true);
    setMessage("");

    try {
      if (sendMode === "direct") {
        // Direct payment (trustline-to-trustline)
        const endpoint = sendCurrency === "XRP" ? "/api/transactions/sendXRP" : "/api/transactions/sendIOU";
        const payload = {
          senderWallet: senderWallet,
          amount: sendAmount,
          recipient: sendRecipient,
          useUsername: true,
          ...(sendCurrency !== "XRP" && { 
            currency: sendCurrency, 
            issuerWallets: issuerWallets 
          }),
          ...(sendDestTag && { destinationTag: parseInt(sendDestTag) })
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (response.ok) {
          setMessage("Direct payment sent successfully!");
          setSendRecipient("");
          setSendAmount("");
          setSendDestTag("");
        } else {
          setMessage(`Error: ${result.error}`);
        }
      } else {
        // Convertible payment (cross-currency)
        const response = await fetch("/api/transactions/sendCrossCurrency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderWallet: senderWallet,
            recipient: sendRecipient,
            useUsername: true,
            sendAmount: sendAmount,
            sendCurrency: sendCurrency,
            receiveCurrency: receiveCurrency,
            issuerAddress: issuerWallets?.[0]?.classicAddress,
            slippagePercent: parseFloat(sendSlippage),
            paymentType: "exact_input",
            ...(sendDestTag && { destinationTag: parseInt(sendDestTag) })
          })
        });

        const result = await response.json();
        if (response.ok) {
          setMessage("Cross-currency payment sent successfully!");
          setSendRecipient("");
          setSendAmount("");
          setSendDestTag("");
          setSendSlippage("0.0");
        } else {
          setMessage(`Error: ${result.error}`);
        }
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="w-[32rem] fixed right-0 top-0 h-full bg-color2 border-l border-gray-700 overflow-y-auto">
        {/* Smart Trade Header */}
        <div className="p-6 border-b border-gray-600 text-center">
          <h2 className="text-2xl font-bold text-white">Smart Trade</h2>
        </div>
        
        {/* Trade Section */}
        <div className="mb-8 p-8">
          {/* Tab Buttons */}
          <div className="flex bg-color3 rounded-lg p-1 mb-8">
            {["Convert", "Send"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white text-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Convert" ? (
            // Convert Layout
            <>
              {/* Amount Input */}
              <div className="mb-8 bg-color3 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="bg-transparent text-6xl font-light w-full outline-none text-white"
                    />
                    <div className="text-xl font-medium mb-2 text-gray-300">USD</div>
                    <div className="text-blue-400 text-sm flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      ≈ 0 {toAsset.name}
                    </div>
                  </div>
                  <button 
                    onClick={handleMax}
                    className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg text-sm font-medium ml-4"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* From Section */}
              <AssetSelector
                asset={fromAsset}
                onSelect={(assetId) => setFromAsset(getCurrencyData(assetId))}
                label="From"
                availableAmount="10.49"
                currencies={availableCurrencies}
              />

              {/* Swap Icon */}
              <div className="flex justify-center my-4">
                <button
                  onClick={() => {
                    const temp = fromAsset;
                    setFromAsset(toAsset);
                    setToAsset(temp);
                  }}
                  className="p-3 bg-color3 rounded-full hover:bg-gray-600 transition-colors"
                >
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* To Section */}
              <AssetSelector
                asset={toAsset}
                onSelect={(assetId) => setToAsset(getCurrencyData(assetId))}
                label="To"
                currencies={availableCurrencies}
              />

              {/* Review Order Button */}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-medium transition-colors mt-8 text-lg">
                Review order
              </button>
            </>
          ) : (
            // Send Layout
            <>
              {/* Recipient Search */}
              <div className="relative mb-6">
                <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Username, address, or ENS"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  className="w-full bg-color3 border border-gray-600 rounded-lg pl-12 pr-4 py-4 outline-none focus:border-blue-500 text-lg"
                />
              </div>

              {/* Payment Mode Toggle */}
              <div className="mb-6">
                <div className="flex bg-color3 rounded-lg p-1">
                  <button
                    onClick={() => setSendMode("direct")}
                    className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                      sendMode === "direct"
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Send Direct
                  </button>
                  <button
                    onClick={() => setSendMode("convertible")}
                    className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                      sendMode === "convertible"
                        ? "bg-green-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Send Convertible
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  {sendMode === "direct" 
                    ? "Trustline-to-trustline payment" 
                    : "Cross-currency XRPL send"}
                </div>
              </div>

              {/* Send Form */}
              <form onSubmit={handleSendSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Amount"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-blue-500 text-lg"
                      required
                    />
                    
                    {/* Send Currency Dropdown */}
                    <CurrencyDropdown
                      value={sendCurrency}
                      onChange={setSendCurrency}
                      currencies={sendMode === "convertible" ? availableCurrencies.filter(c => c.id !== receiveCurrency) : availableCurrencies}
                      className="w-full"
                      isOpen={openDropdown === "sendCurrency"}
                      onToggle={handleDropdownToggle}
                      dropdownId="sendCurrency"
                    />
                  </div>

                  {/* Show destination currency for convertible payments */}
                  {sendMode === "convertible" && (
                    <div className="bg-color3 border border-gray-600 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-2">Recipient will receive:</div>
                      <CurrencyDropdown
                        value={receiveCurrency}
                        onChange={setReceiveCurrency}
                        currencies={availableCurrencies.filter(c => c.id !== sendCurrency)}
                        className="w-full"
                        isOpen={openDropdown === "receiveCurrency"}
                        onToggle={handleDropdownToggle}
                        dropdownId="receiveCurrency"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Destination tag (optional)"
                    value={sendDestTag}
                    onChange={(e) => setSendDestTag(e.target.value)}
                    className="w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-blue-500"
                  />
                </div>



                <button
                  type="submit"
                  disabled={isLoading || !senderWallet}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-4 rounded-lg font-medium transition-colors text-lg"
                >
                  {isLoading ? "Sending..." : `Send ${sendMode === "direct" ? "Direct" : "Convertible"}`}
                </button>
              </form>

              {message && (
                <div className={`mt-5 p-4 rounded-lg text-sm ${
                  message.includes("Error") ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"
                }`}>
                  {message}
                </div>
              )}

              {/* Favorites Section */}
              {favorites.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-lg">Favorites</h3>
                    <button className="text-blue-400 text-sm">See all</button>
                  </div>
                  {favorites.map((fav, index) => (
                    <div 
                      key={index} 
                      className="flex items-center space-x-4 p-3 hover:bg-color3 rounded-lg cursor-pointer"
                      onClick={() => handleRecipientClick(fav)}
                    >
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <Star className="w-5 h-5 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{fav.name}</div>
                        <div className="text-xs text-gray-400">{fav.address}</div>
                      </div>
                      <div className="text-xs text-gray-400">{fav.lastSent}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recents Section */}
              {recents.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-lg">Recents</h3>
                    <button className="text-blue-400 text-sm">See all</button>
                  </div>
                  {recents.map((recent, index) => (
                    <div 
                      key={index} 
                      className="flex items-center space-x-4 p-3 hover:bg-color3 rounded-lg cursor-pointer"
                      onClick={() => handleRecipientClick(recent)}
                    >
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{recent.address}</div>
                        <div className="text-xs text-gray-400">Sent to {recent.lastSent}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick Actions Section */}
        <div className="p-8 pt-0">
          <h3 className="text-xl font-bold mb-6">Quick Actions</h3>
          
          <div className="grid grid-cols-1 gap-4">
            <button className="bg-color3 hover:bg-gray-600 rounded-lg p-5 flex items-center space-x-4 transition-colors">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-lg">Receive crypto</div>
                <div className="text-sm text-gray-400">Get your wallet address</div>
              </div>
            </button>

            <button className="bg-color3 hover:bg-gray-600 rounded-lg p-5 flex items-center space-x-4 transition-colors">
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-lg">Wrap Assets</div>
                <div className="text-sm text-gray-400">Secured by our custodian</div>
              </div>
            </button>

            <button className="bg-color3 hover:bg-gray-600 rounded-lg p-5 flex items-center space-x-4 transition-colors">
              <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-lg">Return Wrapped Assets</div>
                <div className="text-sm text-gray-400">Released from our custody</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 