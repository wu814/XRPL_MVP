"use client";

import { useState, useContext, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowUpDown, Building2, Search, Star, X, ChevronDown, Settings, Loader2 } from "lucide-react";
import ConvertCurrencyDropDown from "@/components/Currency/ConvertCurrencyDropDown";
import SendCurrencyDropDown from "@/components/Currency/SendCurrencyDropDown";
import CurrencyDropDown from "@/components/Currency/CurrencyDropDown";
import FavoritesList from "@/components/Smart/FavoritesList";
import SlippagePanel from "@/components/SlippagePanel";
import ErrorMdl from "@/components/ErrorMdl";
import SuccessMdl from "@/components/SuccessMdl";
import Button from "../Button";
import { useCurrentUserWallet } from "@/components/Wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/Wallet/IssuerWalletProvider";
import { availableCurrencies } from "@/utils/currencies";
import { useSession } from "next-auth/react";

export default function TradePanel() {
  const { data: sessionData, status } = useSession();
  const [activeTab, setActiveTab] = useState("Convert");

  // Convert states (integrated from SmartTradeMenu)
  const [sellCurrency, setSellCurrency] = useState("USD");
  const [buyCurrency, setBuyCurrency] = useState("XRP");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [activeInput, setActiveInput] = useState("sell");
  const [tradeInputType, setTradeInputType] = useState("exact_input");
  
  // Send form states (Enhanced from TransferBtn)
  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [useUsername, setUseUsername] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [destinationTag, setDestinationTag] = useState("");
  const [paymentType, setPaymentType] = useState("direct"); // "direct" or "convertable"
  const [convertInputType, setConvertInputType] = useState(null); // "exact_input" or "exact_output"
  const [sendCurrency, setSendCurrency] = useState("USD"); // for cross-currency
  const [receiveCurrency, setReceiveCurrency] = useState("XRP"); // for cross-currency
  const [sendAmount, setSendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");
  
  // Common states
  const [slippage, setSlippage] = useState("0");
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Get the primary wallet
  const senderWallet = currentUserWallets?.find(
    (wallet) => wallet.walletType === "USER" || wallet.walletType === "BUSINESS" || wallet.walletType === "ISSUER"
  );

  // Add new state for wallet balance
  const [walletBalances, setWalletBalances] = useState({});
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Convert functionality integration
  const handleSellAmountChange = (e) => {
    setActiveInput("sell");
    setSellAmount(e.target.value);
    setBuyAmount(""); // Clear the other field
    setTradeInputType("exact_input");
  };

  const handleBuyAmountChange = (e) => {
    setActiveInput("buy");
    setBuyAmount(e.target.value);
    setSellAmount(""); // Clear the other field
    setTradeInputType("exact_output");
  };

  const handleCurrencySwap = () => {
    const temp = sellCurrency;
    setSellCurrency(buyCurrency);
    setBuyCurrency(temp);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setActiveInput("sell");
  };

  const handleSmartTrade = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!senderWallet) {
        throw new Error("No suitable wallet found");
      }

      if (!issuerWallets || issuerWallets.length === 0) {
        throw new Error("No issuer wallet found");
      }

      const response = await fetch("/api/smart/smartTrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          senderWallet: senderWallet,
          sendCurrency: sellCurrency,
          sendAmount: sellAmount,
          receiveCurrency: buyCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: parseFloat(slippage),
          paymentType: tradeInputType,
          exactOutputAmount: buyAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Smart trade failed");
      }

      setSuccessMessage(result.message || "Smart trade completed successfully!");
      fetchWalletBalances();

      // Reset form
      setSellAmount("");
      setBuyAmount("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // TransferBtn functionality for Send tab
  const handlePaymentTypeChange = (type) => {
    setPaymentType(type);
    setConvertInputType(null);
    setSendAmount("");
    setReceiveAmount("");
    setAmount("");
    setCurrency("");
  };

  const handleSendAmountChangeForPayment = (e) => {
    const value = e.target.value;
    setSendAmount(value);
    setReceiveAmount("");
    setConvertInputType(value ? "exact_input" : null);
  };

  const handleReceiveAmountChangeForPayment = (e) => {
    const value = e.target.value;
    setReceiveAmount(value);
    setSendAmount("");
    setConvertInputType(value ? "exact_output" : null);
  };

  const handleSendSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const tag = destinationTag.trim() !== "" ? Number(destinationTag) : null;
      let endpoint, requestBody;

      if (paymentType === "convertable") {
        endpoint = "/api/transactions/sendCrossCurrency";
        requestBody = {
          senderWallet,
          sendCurrency,
          sendAmount: sendAmount,
          receiveCurrency,
          issuerAddress: issuerWallets[0].classicAddress,
          slippagePercent: parseFloat(slippage),
          destinationTag: tag,
          useUsername,
          recipient: useUsername ? recipientUsername : recipientAddress,
          paymentType: convertInputType,
          exactOutputAmount:
            convertInputType === "exact_output" ? receiveAmount : undefined,
        };
      } else {
        endpoint =
          currency === "XRP"
            ? "/api/transactions/sendXRP"
            : "/api/transactions/sendIOU";
        requestBody = {
          senderWallet,
          amount,
          destinationTag: tag,
          useUsername,
          ...(currency !== "XRP" && { currency, issuerWallets }),
          recipient: useUsername ? recipientUsername : recipientAddress,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSuccessMessage(result.message || "Payment sent!");
      fetchWalletBalances();
      
      // Reset form
      if (!recipientUsername) setRecipientUsername("");
      setRecipientAddress("");
      setAmount("");
      setCurrency("");
      setSendCurrency("");
      setReceiveCurrency("");
      setDestinationTag("");
      setSendAmount("");
      setReceiveAmount("");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  
  const recents = [
    { address: "rwnYLU...nqf63J", lastSent: "2 months ago" },
    { address: "0xf839...0369e4", lastSent: "11 months ago" },
    { address: "rUy72X...zNDTD2", lastSent: "1 year ago" }
  ];
  
  const handleMax = () => {
    if (activeTab === "Convert" && sellCurrency) {
      const maxBalance = walletBalances[sellCurrency] || 0;
      setSellAmount(maxBalance.toString());
      setBuyAmount("");
      setActiveInput("sell");
      setTradeInputType("exact_input");
    }
  };

  const getCurrencyData = (currencyId) => {
    return availableCurrencies.find(c => c.id === currencyId) || availableCurrencies[0];
  };

  const handleRecipientClick = (recipient) => {
    if (useUsername) {
      setRecipientUsername(recipient);
    } else {
      setRecipientAddress(recipient);
    }
  };

  const handleDropdownToggle = (dropdownId) => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  const canTrade = sellCurrency && buyCurrency && sellCurrency !== buyCurrency && 
    ((sellAmount && parseFloat(sellAmount) > 0) || (buyAmount && parseFloat(buyAmount) > 0));

  // Add function to fetch wallet balances
  const fetchWalletBalances = async () => {
    if (!senderWallet) return;
    
    setLoadingBalance(true);
    try {
      const [accountInfoResponse, accountLinesResponse] = await Promise.all([
        fetch("/api/wallets/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: senderWallet }),
        }),
        fetch("/api/wallets/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: senderWallet }),
        }),
      ]);

      const accountInfo = await accountInfoResponse.json();
      const accountLines = await accountLinesResponse.json();


      const balances = {};

      // Add XRP balance (accounting for reserves)
      if (accountInfo.data?.balance) {
        const xrpBalance = parseFloat(accountInfo.data.balance); // Already converted from drops
        const ownerCount = accountInfo.data.ownerCount || 0;
        const BASE_RESERVE_XRP = 1;
        const OWNER_RESERVE_XRP = 0.2;
        const totalReserve = BASE_RESERVE_XRP + (OWNER_RESERVE_XRP * ownerCount);
        const availableBalance = Math.max(0, xrpBalance - totalReserve);
        
        balances["XRP"] = availableBalance;
      }

      // Add IOU balances from account lines
      if (accountLines.data?.lines) {
        accountLines.data.lines.forEach(line => {
          if (line.currency && line.balance) {
            balances[line.currency] = parseFloat(line.balance);
          }
        });
      }

      setWalletBalances(balances);
    } catch (error) {
      console.error("Error fetching wallet balances:", error);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Fetch balances when wallet changes
  useEffect(() => {
    if (senderWallet) {
      fetchWalletBalances();
    }
  }, [senderWallet]);

  // Reset amounts when sell currency changes
  useEffect(() => {
    setSellAmount("");
  }, [sellCurrency]);

  // Reset amounts when buy currency changes  
  useEffect(() => {
    setBuyAmount("");
  }, [buyCurrency]);

  return (
    <>
      <div className="w-[32rem] fixed right-0 top-24 bottom-0 bg-color2 overflow-y-auto mt-2 rounded-lg">
        {/* Smart Trade Header */}
        <div className="p-6 border-b border-gray-600">
          <div className="flex flex-row justify-between items-center relative">
            <h2 className="text-2xl font-bold text-white">Smart Trade / Payment</h2>
            {/* Slippage Settings Button - Show for both tabs */}
            <button 
              onClick={() => setShowSlippagePanel((prev) => !prev)}
              className="p-2 hover:bg-color3 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
            {showSlippagePanel && (
              <SlippagePanel
                slippage={slippage}
                setSlippage={setSlippage}
                onClose={() => setShowSlippagePanel(false)}
              />
            )}
          </div>
        </div>
        
        {/* Trade Section */}
        <div className="mb-8 p-8">
          {/* Tab Buttons */}
          <div className="flex bg-color3 rounded-lg p-1 mb-6">
            {["Convert", "Send"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 rounded-md font-semibold text-md transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Convert" ? (
            // Convert Layout - Integrated SmartTradeMenu functionality
            <>
              {/* Sell Section */}
              <div className="mb-4 bg-color3 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-1 flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">Sell</label>
                    <ConvertCurrencyDropDown
                      asset={getCurrencyData(sellCurrency)}
                      onSelect={setSellCurrency}
                      label=""
                      currencies={availableCurrencies.filter(c => c.id !== buyCurrency)}
                    />
                    {sellCurrency && (
                        <div className="text-sm text-gray-400">
                          Balance: {loadingBalance ? "Loading..." : (walletBalances[sellCurrency]?.toFixed(6) || "0.000000")} {sellCurrency}
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col items-end">
                    <input
                      type="number"
                      step="0.000001"
                      value={sellAmount}
                      onChange={handleSellAmountChange}
                      placeholder="0.00"
                      className={`bg-transparent text-right text-4xl font-light outline-none text-white w-48 ${!!buyAmount ? "cursor-not-allowed opacity-60" : ""}`}
                      min="0"
                      disabled={!!buyAmount}
                    />
                    <div className="flex items-center space-x-2 mt-2">
                      
                      <button 
                        onClick={handleMax}
                        disabled={loadingBalance || !sellCurrency || (walletBalances[sellCurrency] || 0) <= 0}
                        className="bg-color5 hover:bg-color6 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center my-4">
                <button
                  onClick={handleCurrencySwap}
                  className="p-3 bg-color3 rounded-full hover:bg-color4 transition-colors"
                  disabled={!sellCurrency || !buyCurrency}
                >
                  <ArrowUpDown className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-8 bg-color3 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">Buy</label>
                    <ConvertCurrencyDropDown
                      asset={getCurrencyData(buyCurrency)}
                      onSelect={setBuyCurrency}
                      label=""
                      currencies={availableCurrencies.filter(c => c.id !== sellCurrency)}
                    />
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    value={buyAmount}
                    onChange={handleBuyAmountChange}
                    placeholder="0.00"
                    className={`bg-transparent text-right text-4xl font-light outline-none text-white w-48 ${!!sellAmount ? "cursor-not-allowed opacity-60" : ""}`}
                    min="0"
                    disabled={!!sellAmount}
                  />
                </div>
              </div>

              {/* Execute Trade Button */}
              <Button
                onClick={handleSmartTrade}
                disabled={!canTrade || loading}
                className="w-full text-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Trading...</span>
                  </div>
                ) : (
                  "Execute Smart Trade"
                )}
              </Button>
            </>
          ) : (
            // Send Layout - Full TransferBtn functionality integration
            <>
              {/* Payment Type and Username/Address Toggle */}
              <div className={`flex ${sessionData?.user?.role === "ADMIN" ? "justify-between space-x-2" : "justify-center"} mb-6`}>
                <div className={`flex space-x-1 rounded-lg bg-color3 p-1 ${!sessionData?.user?.role === "ADMIN" ? "w-full" : ""}`}>
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-md transition-colors ${paymentType === "direct" ? "bg-primary text-black" : "bg-color3 text-gray-300 hover:text-white"}`}
                    onClick={() => handlePaymentTypeChange("direct")}
                  >
                    Direct
                  </button>
                  <button
                    className={`flex-1 rounded-lg px-3 py-2 text-md transition-colors ${paymentType === "convertable" ? "bg-primary text-black" : "bg-color3 text-gray-300 hover:text-white"}`}
                    onClick={() => handlePaymentTypeChange("convertable")}
                  >
                    Convertable
                  </button>
                </div>

                {/* Only show option to send with address for Admin */}
                {sessionData?.user?.role === "ADMIN" && (
                  <div className="flex space-x-1 rounded-lg bg-color3 p-1">
                    {[true, false].map((type) => (
                      <button
                        key={String(type)}
                        className={`rounded-lg px-2 py-1 text-md ${
                          useUsername === type
                            ? "bg-primary text-black"
                            : "text-gray-300 hover:text-white"
                        }`}
                        onClick={() => setUseUsername(type)}
                      >
                        {type ? "Username" : "Address"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment type info */}
              <div className="text-xs text-gray-400 mb-6">
                {paymentType === "direct" 
                  ? "Trustline-to-trustline payment" 
                  : "Cross-currency XRPL send"}
              </div>

              {/* Send Form */}
              <form onSubmit={handleSendSubmit} className="space-y-5">
                {/* Recipient Input */}
                {useUsername ? (
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Recipient Username"
                      value={recipientUsername || ""}
                      onChange={(e) => setRecipientUsername(e.target.value || "")}
                      className="w-full bg-color3 border border-gray-600 rounded-lg pl-12 pr-4 py-4 outline-none focus:border-primary text-lg"
                      required
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Recipient Address"
                      value={recipientAddress || ""}
                      onChange={(e) => setRecipientAddress(e.target.value || "")}
                      className="w-full bg-color3 border border-gray-600 rounded-lg pl-12 pr-4 py-4 outline-none focus:border-primary text-lg"
                      required
                    />
                  </div>
                )}

                {paymentType === "convertable" ? (
                  <>
                    {/* Send Currency */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Send Currency</label>
                      <SendCurrencyDropDown
                        value={sendCurrency}
                        onChange={setSendCurrency}
                        currencies={availableCurrencies}
                        isOpen={openDropdown === "sendCurrency"}
                        onToggle={handleDropdownToggle}
                        dropdownId="sendCurrency"
                      />
                    </div>
                    
                    {/* Receive Currency */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Receive Currency</label>
                      <SendCurrencyDropDown
                        value={receiveCurrency}
                        onChange={setReceiveCurrency}
                        currencies={availableCurrencies}
                        isOpen={openDropdown === "receiveCurrency"}
                        onToggle={handleDropdownToggle}
                        dropdownId="receiveCurrency"
                      />
                    </div>
                    
                    {/* Send and Receive Amounts */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Send Amount</label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={sendAmount}
                          onChange={handleSendAmountChangeForPayment}
                          className={`w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-primary ${convertInputType === "exact_output" ? "cursor-not-allowed opacity-60" : ""}`}
                          placeholder="0.00"
                          disabled={convertInputType === "exact_output"}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Receive Amount</label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={receiveAmount}
                          onChange={handleReceiveAmountChangeForPayment}
                          className={`w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-primary ${convertInputType === "exact_input" ? "cursor-not-allowed opacity-60" : ""}`}
                          placeholder="0.00"
                          disabled={convertInputType === "exact_input"}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Currency */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Currency</label>
                      <SendCurrencyDropDown
                        value={currency}
                        onChange={setCurrency}
                        currencies={availableCurrencies}
                        isOpen={openDropdown === "currency"}
                        onToggle={handleDropdownToggle}
                        dropdownId="currency"
                      />
                    </div>
                    
                    {/* Amount */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Amount</label>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-primary"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Destination Tag */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Destination Tag (optional)</label>
                  <input
                    type="text"
                    placeholder="Enter destination tag..."
                    value={destinationTag}
                    onChange={(e) => setDestinationTag(e.target.value)}
                    className="w-full bg-color3 border border-gray-600 rounded-lg px-4 py-3 outline-none focus:border-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !(useUsername ? recipientUsername : recipientAddress) ||
                    (paymentType === "convertable"
                      ? !sendCurrency ||
                        !receiveCurrency ||
                        (!sendAmount && !receiveAmount)
                      : !amount || (paymentType === "direct" && !currency))
                  }
                  className="w-full text-xl py-2"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    "Send"
                  )}
                </Button>
              </form>

              {/* Favorites Section */}
              <FavoritesList onRecipientClick={handleRecipientClick} />

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

      {/* Error Modal */}
      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </>
  );
} 