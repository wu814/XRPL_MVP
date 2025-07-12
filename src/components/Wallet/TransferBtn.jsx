"use client";

import { use, useEffect, useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import SlippagePanel from "../SlippagePanel";
import { Settings, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
// Import calculation functions
import { calculateExactAMMInput, calculateEstimateOutput } from "@/utils/xrpl/amm/calculations";

export default function TransferBtn({
  senderWallet,
  issuerWallets,
  presetRecipientUsername,
  onSuccess,
}) {
  const { data: session, status } = useSession();

  const [showMdl, setShowMdl] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [useUsername, setUseUsername] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Slippage state
  const [slippage, setSlippage] = useState("0"); // Default 0% slippage
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);

  const [paymentType, setPaymentType] = useState("direct"); // "direct" or "convertable"
  const [convertInputType, setConvertInputType] = useState(null); // "exact_input" or "exact_output"
  const [sendCurrency, setSendCurrency] = useState(""); // for cross-currency
  const [receiveCurrency, setReceiveCurrency] = useState(""); // for cross-currency

  const [sendAmount, setSendAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");

  // Add calculation states
  const [calculatingAmounts, setCalculatingAmounts] = useState(false);
  const [calculationError, setCalculationError] = useState(null);
  
  // AMM data states for convertable payments
  const [ammData, setAmmData] = useState(null);
  const [loadingAmmData, setLoadingAmmData] = useState(false);
  const [ammDataError, setAmmDataError] = useState(null);

  useEffect(() => {
    if (presetRecipientUsername) {
      setRecipientUsername(presetRecipientUsername);
    }
  }, [presetRecipientUsername]);

  // Fetch AMM data when currencies change (for convertable payments)
  useEffect(() => {
    if (paymentType === "convertable" && sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency) {
      fetchAmmData();
    } else {
      setAmmData(null);
      setAmmDataError(null);
    }
  }, [sendCurrency, receiveCurrency, paymentType]);

  // Calculate output when send amount changes
  useEffect(() => {
    if (paymentType === "convertable" && sendAmount && parseFloat(sendAmount) > 0 && 
        sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency && 
        convertInputType === "exact_input" && ammData) {
      calculateOutput();
    }
  }, [sendAmount, sendCurrency, receiveCurrency, convertInputType, ammData, paymentType]);

  // Calculate input when receive amount changes
  useEffect(() => {
    if (paymentType === "convertable" && receiveAmount && parseFloat(receiveAmount) > 0 && 
        sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency && 
        convertInputType === "exact_output" && ammData) {
      calculateInput();
    }
  }, [receiveAmount, sendCurrency, receiveCurrency, convertInputType, slippage, ammData, paymentType]);

  const fetchAmmData = async () => {
    setLoadingAmmData(true);
    setAmmDataError(null);
    setAmmData(null);

    try {
      const response = await fetch("/api/amms/getAmmInfoByCurrencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellCurrency: sendCurrency,
          buyCurrency: receiveCurrency,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to get AMM data");
      }

      setAmmData(result.data);
    } catch (error) {
      setAmmDataError(error.message);
    } finally {
      setLoadingAmmData(false);
    }
  };

  const calculateOutput = async () => {
    if (!ammData) return;

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {      
      // Determine pool balances from cached AMM data
      let poolSend, poolReceive;
      if (ammData.amount.currency === sendCurrency) {
        poolSend = parseFloat(ammData.amount.value);
        poolReceive = parseFloat(ammData.amount2.value);
      } else {
        poolSend = parseFloat(ammData.amount2.value);
        poolReceive = parseFloat(ammData.amount.value);
      }

      // Calculate estimated output
      const calculation = calculateEstimateOutput(poolSend, poolReceive, sendAmount, ammData.trading_fee || 0);
      
      if (calculation.success) {
        setReceiveAmount(calculation.estimatedOutput.toFixed(6));
      } else {
        throw new Error(calculation.error);
      }
    } catch (error) {
      setCalculationError(error.message);
      setReceiveAmount("");
    } finally {
      setCalculatingAmounts(false);
    }
  };

  const calculateInput = async () => {
    if (!ammData) return;

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {
      // Determine pool balances from cached AMM data
      let poolSend, poolReceive;
      if (ammData.amount.currency === sendCurrency) {
        poolSend = parseFloat(ammData.amount.value);
        poolReceive = parseFloat(ammData.amount2.value);
      } else {
        poolSend = parseFloat(ammData.amount2.value);
        poolReceive = parseFloat(ammData.amount.value);
      }

      // Calculate required input
      const calculation = calculateExactAMMInput(
        poolSend, 
        poolReceive, 
        parseFloat(receiveAmount), 
        parseFloat(slippage) / 100, 
        ammData.trading_fee || 0
      );
      
      if (calculation.success) {
        setSendAmount(calculation.inputWithSlippage.toFixed(6));
      } else {
        throw new Error(calculation.error);
      }
    } catch (error) {
      setCalculationError(error.message);
      setSendAmount("");
    } finally {
      setCalculatingAmounts(false);
    }
  };

  // When toggling paymentType, reset convertable fields
  const handlePaymentTypeChange = (type) => {
    setPaymentType(type);
    setConvertInputType(null);
    setSendAmount("");
    setReceiveAmount("");
    setAmount("");
    setCurrency("");
    setCalculationError(null);
  };

  const handleSendAmountChange = (e) => {
    const value = e.target.value;
    setSendAmount(value);
    setReceiveAmount("");
    setConvertInputType(value ? "exact_input" : null);
  };

  const handleReceiveAmountChange = (e) => {
    const value = e.target.value;
    setReceiveAmount(value);
    setSendAmount("");
    setConvertInputType(value ? "exact_output" : null);
  };

  // Reset amounts when send currency changes
  useEffect(() => {
    if (paymentType === "convertable") {
      setSendAmount("");
      setReceiveAmount("");
      setCalculationError(null);
    }
  }, [sendCurrency, paymentType]);

  // Reset amounts when receive currency changes  
  useEffect(() => {
    if (paymentType === "convertable") {
      setSendAmount("");
      setReceiveAmount("");
      setCalculationError(null);
    }
  }, [receiveCurrency, paymentType]);

  const handleSubmit = async () => {
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

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      if (!presetRecipientUsername) setRecipientUsername("");
      setRecipientAddress("");
      setAmount("");
      setCurrency("");
      setSendCurrency("");
      setReceiveCurrency("");
      setDestinationTag("");
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowMdl(true)}>
        Send
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-auto min-w-96 space-y-4 rounded-lg bg-color3 p-6">
            <div className="relative mb-6 flex justify-between">
              <h2 className="text-start text-2xl font-semibold">
                Transfer / Pay
              </h2>
              {paymentType === "convertable" && (
                <button onClick={() => setShowSlippagePanel((prev) => !prev)} className="p-2 hover:bg-color4 rounded-lg transition-colors hover:text-white text-gray-400">
                  <Settings className="h-5 w-5" />
                </button>
              )}
              {showSlippagePanel && (
                <SlippagePanel
                  slippage={slippage}
                  setSlippage={setSlippage}
                  onClose={() => setShowSlippagePanel(false)}
                />
              )}
            </div>
            <div
              className={`flex ${session?.user?.role === "ADMIN" ? "justify-between space-x-2" : "justify-center"}`}
            >
              <div
                className={`flex space-x-1 rounded-lg bg-color4 p-1 ${!session?.user?.role === "ADMIN" ? "w-full" : ""}`}
              >
                <button
                  className={`flex-1 rounded-lg px-3 py-1 transition-colors ${paymentType === "direct" ? "bg-primary text-black" : "text-gray-300 hover:text-white"}`}
                  onClick={() => handlePaymentTypeChange("direct")}
                >
                  Direct
                </button>
                <button
                  className={`flex-1 rounded-lg px-3 py-1 transition-colors ${paymentType === "convertable" ? "bg-primary text-black" : "text-gray-300 hover:text-white"}`}
                  onClick={() => handlePaymentTypeChange("convertable")}
                >
                  Convertable
                </button>
              </div>

              {/* Only show option to send with address for Admin */}
              {session?.user?.role === "ADMIN" && (
                <div className="flex space-x-1 rounded-lg bg-color4 p-1">
                  {[true, false].map((type) => (
                    <button
                      key={String(type)}
                      className={`rounded-lg px-2 py-1 ${
                        useUsername === type
                          ? "bg-primary text-black"
                          : "text-white"
                      }`}
                      onClick={() => setUseUsername(type)}
                    >
                      {type ? "Username" : "Address"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show AMM loading state for convertable payments */}
            {paymentType === "convertable" && loadingAmmData && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <p className="text-blue-400 text-sm">Loading AMM pool data...</p>
                </div>
              </div>
            )}

            {/* Show AMM data error for convertable payments */}
            {paymentType === "convertable" && ammDataError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
                <p className="text-red-400 text-sm">AMM Pool Error: {ammDataError}</p>
              </div>
            )}

            {/* Show calculation error if any */}
            {paymentType === "convertable" && calculationError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
                <p className="text-red-400 text-sm">Calculation Error: {calculationError}</p>
              </div>
            )}

            {/* Show AMM pool info when loaded for convertable payments */}
            {paymentType === "convertable" && ammData && !loadingAmmData && (
              <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded-lg">
                <p className="text-green-400 text-sm">
                  ✅ AMM Pool: {ammData.amount.currency}/{ammData.amount2.currency} 
                  {ammData.trading_fee > 0 && ` (${ammData.trading_fee/1000}% fee)`}
                </p>
              </div>
            )}

            {useUsername ? (
              <div>
                <label className="block text-sm text-mutedText">
                  Recipient Username
                </label>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                  placeholder="Enter recipient username..."
                  readOnly={Boolean(presetRecipientUsername)}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-mutedText">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                  placeholder="Enter recipient address..."
                />
              </div>
            )}

            {paymentType === "convertable" ? (
              <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-mutedText">
                    Send Currency
                  </label>
                  <CurrencyDropDown
                    value={sendCurrency}
                    onChange={setSendCurrency}
                    disabledOptions={[]}
                  />
                </div>
                <div>
                  <label className="block text-sm text-mutedText">
                    Receive Currency
                  </label>
                  <CurrencyDropDown
                    value={receiveCurrency}
                    onChange={setReceiveCurrency}
                    disabledOptions={[]}
                  />
                </div>
              </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-mutedText">
                      Send Amount
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={sendAmount}
                      onChange={handleSendAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none ${
                        convertInputType === "exact_output" || calculatingAmounts || loadingAmmData ? "cursor-not-allowed opacity-60" : ""
                      }`}
                      placeholder="0.00"
                      disabled={convertInputType === "exact_output" || calculatingAmounts || loadingAmmData}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-mutedText">
                      Receive Amount
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      min="0"
                      value={receiveAmount}
                      onChange={handleReceiveAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none ${
                        convertInputType === "exact_input" || calculatingAmounts || loadingAmmData ? "cursor-not-allowed opacity-60" : ""
                      }`}
                      placeholder="0.00"
                      disabled={convertInputType === "exact_input" || calculatingAmounts || loadingAmmData}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-mutedText">
                    Currency
                  </label>
                  <CurrencyDropDown
                    value={currency}
                    onChange={setCurrency}
                    disabledOptions={[]}
                  />
                </div>
                <div>
                  <label className="block text-sm text-mutedText">Amount</label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-mutedText">
                Destination Tag (optional)
              </label>
              <input
                type="text"
                value={destinationTag}
                onChange={(e) => setDestinationTag(e.target.value)}
                className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
                placeholder="Enter destination tag..."
              />
            </div>

            <div className="flex space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowMdl(false)}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  loading ||
                  calculatingAmounts ||
                  loadingAmmData ||
                  !(useUsername ? recipientUsername : recipientAddress) ||
                  (paymentType === "convertable"
                    ? !sendCurrency ||
                      !receiveCurrency ||
                      (!sendAmount && !receiveAmount)
                    : !amount || (paymentType === "direct" && !currency))
                }
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : loadingAmmData ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading Pool...</span>
                  </div>
                ) : calculatingAmounts ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Calculating...</span>
                  </div>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <SuccessMdl
          successMessage={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
    </>
  );
}
