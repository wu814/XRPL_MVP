"use client";

import { useState, useEffect } from "react";
import Button from "@/components/Button";
import ErrorMdl from "@/components/ErrorMdl";
import SuccessMdl from "@/components/SuccessMdl";
import CurrencyDropDown from "@/components/currency/CurrencyDropDown";
import SlippagePanel from "../SlippagePanel";
import { Settings, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { calculateExactAMMInput, calculateEstimateOutput } from "@/utils/xrpl/amm/calculations";
import { YONAWallet } from "@/types/appTypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";
import { GetFormattedAMMInfoByCurrenciesAPIResponse } from "@/types/api/ammAPITypes";
import { sendCrossCurrencyAPIResponse, sendIOUAPIResponse, sendXRPAPIResponse } from "@/types/api/transactionAPITypes";


interface TransferBtnProps {
  senderWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  presetRecipientUsername?: string;
  onSuccess?: () => void; // Made optional
}

type PaymentType = "direct" | "convertable";
type ConvertInputType = "exact_input" | "exact_output" | null;

export default function TransferBtn({
  senderWallet,
  issuerWallets,
  presetRecipientUsername,
  onSuccess,
}: TransferBtnProps) {
  const { data: session, status } = useSession();

  const [showMdl, setShowMdl] = useState<boolean>(false);
  const [recipientUsername, setRecipientUsername] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [useUsername, setUseUsername] = useState<boolean>(true);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [destinationTag, setDestinationTag] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Slippage state
  const [slippage, setSlippage] = useState<number>(0);
  const [showSlippagePanel, setShowSlippagePanel] = useState<boolean>(false);

  const [paymentType, setPaymentType] = useState<PaymentType>("direct");
  const [convertInputType, setConvertInputType] = useState<ConvertInputType>(null);
  const [sendCurrency, setSendCurrency] = useState<string>("USD");
  const [receiveCurrency, setReceiveCurrency] = useState<string>("XRP");

  const [sendAmount, setSendAmount] = useState<number | null>(null);
  const [receiveAmount, setReceiveAmount] = useState<number | null>(null);

  // Add calculation states
  const [calculatingAmounts, setCalculatingAmounts] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  
  // AMM data states for convertable payments
  const [ammData, setAMMData] = useState<any>(null);
  const [loadingAMMData, setLoadingAMMData] = useState<boolean>(false);
  const [ammDataError, setAMMDataError] = useState<string | null>(null);

  useEffect(() => {
    if (presetRecipientUsername) {
      setRecipientUsername(presetRecipientUsername);
    }
  }, [presetRecipientUsername]);

  // Fetch AMM data when currencies change (for convertable payments)
  useEffect(() => {
    if (paymentType === "convertable" && sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency) {
      fetchAMMData();
    } else {
      setAMMData(null);
      setAMMDataError(null);
    }
  }, [sendCurrency, receiveCurrency, paymentType]);

  // Calculate output when send amount changes
  useEffect(() => {
    if (paymentType === "convertable" && sendAmount && sendAmount > 0 && 
        sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency && 
        convertInputType === "exact_input" && ammData) {
      calculateOutput();
    }
  }, [sendAmount, sendCurrency, receiveCurrency, convertInputType, ammData, paymentType]);

  // Calculate input when receive amount changes
  useEffect(() => {
    if (paymentType === "convertable" && receiveAmount && receiveAmount > 0 && 
        sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency && 
        convertInputType === "exact_output" && ammData) {
      calculateInput();
    }
  }, [receiveAmount, sendCurrency, receiveCurrency, convertInputType, slippage, ammData, paymentType]);

  const fetchAMMData = async (): Promise<void> => {
    setLoadingAMMData(true);
    setAMMDataError(null);
    setAMMData(null);

    try {
      const response = await fetch("/api/amm/getFormattedAMMInfoByCurrencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellCurrency: sendCurrency,
          buyCurrency: receiveCurrency,
        }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setAMMDataError(errorData.message);
        return;
      }
      
      const result: GetFormattedAMMInfoByCurrenciesAPIResponse = await response.json();
      setAMMData(result.data);
    } catch (error: any) {
      setAMMDataError(error.message);
    } finally {
      setLoadingAMMData(false);
    }
  };

  const calculateOutput = async () => {
    if (!ammData) return;

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {      
      // Determine pool balances from cached AMM data
      let poolSend: number, poolReceive: number;
      if (ammData.formattedAmount1.currency === sendCurrency) {
        poolSend = parseFloat(ammData.formattedAmount1.value);
        poolReceive = parseFloat(ammData.formattedAmount2.value);
      } else {
        poolSend = parseFloat(ammData.formattedAmount2.value);
        poolReceive = parseFloat(ammData.formattedAmount1.value);
      }

      // Calculate estimated output
      const calculation = calculateEstimateOutput(poolSend, poolReceive, sendAmount, (ammData.tradingFee || 0) / 100000);
      
      if (calculation.success && calculation.estimatedOutput !== undefined) {
        setReceiveAmount(Number(calculation.estimatedOutput.toFixed(6)));
      } else {
        throw new Error(calculation.error || "Calculation failed");
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setReceiveAmount(null);
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
      let poolSend: number, poolReceive: number;
      if (ammData.formattedAmount1.currency === sendCurrency) {
        poolSend = parseFloat(ammData.formattedAmount1.value);
        poolReceive = parseFloat(ammData.formattedAmount2.value);
      } else {
        poolSend = parseFloat(ammData.formattedAmount2.value);
        poolReceive = parseFloat(ammData.formattedAmount1.value);
      }

      // Calculate required input
      const calculation = calculateExactAMMInput(
        poolSend, 
        poolReceive, 
        receiveAmount, 
        slippage / 100, 
        ammData.tradingFee / 100000 || 0
      );
      
      if (calculation.success && calculation.inputWithSlippage !== undefined) {
        setSendAmount(Number(calculation.inputWithSlippage.toFixed(6)));
      } else {
        throw new Error(calculation.error || "Calculation failed");
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setSendAmount(null);
    } finally {
      setCalculatingAmounts(false);
    }
  };

  // When toggling paymentType, reset convertable fields
  const handlePaymentTypeChange = (type: PaymentType) => {
    setPaymentType(type);
    setConvertInputType(null);
    setSendAmount(null);
    setReceiveAmount(null);
    setAmount(null);
    setCalculationError(null);
  };

  const handleSendAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSendAmount(value === "" ? null : parseFloat(value));
    setReceiveAmount(null);
    setConvertInputType(value ? "exact_input" : null);
  };

  const handleReceiveAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReceiveAmount(value === "" ? null : parseFloat(value));
    setSendAmount(null);
    setConvertInputType(value ? "exact_output" : null);
  };

  // Reset amounts when send currency changes
  useEffect(() => {
    if (paymentType === "convertable") {
      setSendAmount(null);
      setReceiveAmount(null);
      setCalculationError(null);
    }
  }, [sendCurrency, paymentType]);

  // Reset amounts when receive currency changes  
  useEffect(() => {
    if (paymentType === "convertable") {
      setSendAmount(null);
      setReceiveAmount(null);
      setCalculationError(null);
    }
  }, [receiveCurrency, paymentType]);

  const handleSubmit = async (): Promise<void> => {
    if (!senderWallet?.classicAddress) {
      setErrorMessage("No sender wallet available");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const tag = destinationTag.trim() !== "" ? Number(destinationTag) : null;
      let endpoint: string, requestBody: any;

      if (paymentType === "convertable") {
        endpoint = "/api/transaction/sendCrossCurrency";
        requestBody = {
          senderWallet,
          sendCurrency,
          sendAmount: sendAmount,
          receiveCurrency,
          issuerAddress: issuerWallets[0]?.classicAddress,
          slippagePercent: slippage,
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
            ? "/api/transaction/sendXRP"
            : "/api/transaction/sendIOU";
        requestBody = {
          senderWallet,
          amount,
          destinationTag: tag,
          useUsername,
          ...(currency !== "XRP" && { currency, issuerWallets }),
          recipient: useUsername ? recipientUsername : recipientAddress,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: sendIOUAPIResponse | sendXRPAPIResponse | sendCrossCurrencyAPIResponse = await response.json();
      setSuccessMessage(result.message);

      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      if (!presetRecipientUsername) setRecipientUsername("");
      setRecipientAddress("");
      setAmount(null);
      setSendAmount(null);
      setReceiveAmount(null);
      setDestinationTag("");
    }
  };

  return (
    <>
      <Button 
        variant="primary" 
        onClick={() => setShowMdl(true)}
        className="text-sm px-3 py-1"
      >
        Transfer
      </Button>
      
      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-auto min-w-96 space-y-4 rounded-lg bg-color3 p-6">
            <div className="relative mb-6 flex justify-between">
              <h2 className="text-start text-2xl font-semibold">
                Transfer / Pay
              </h2>
              {paymentType === "convertable" && (
                <button onClick={() => setShowSlippagePanel((prev) => !prev)} className="p-2 hover:bg-color4 rounded-full transition-colors hover:text-white text-gray-400">
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
                className={`flex space-x-1 rounded-full bg-color4 p-1 ${session?.user?.role !== "ADMIN" ? "w-full" : ""}`}
              >
                <button
                  className={`flex-1 rounded-full px-3 py-1 transition-colors ${paymentType === "direct" ? "bg-primary/20 text-primary border border-primary" : "text-gray-300 hover:text-white"}`}
                  onClick={() => handlePaymentTypeChange("direct")}
                >
                  Direct
                </button>
                <button
                  className={`flex-1 rounded-full px-3 py-1 transition-colors ${paymentType === "convertable" ? "bg-primary/20 text-primary border border-primary" : "text-gray-300 hover:text-white"}`}
                  onClick={() => handlePaymentTypeChange("convertable")}
                >
                  Convertable
                </button>
              </div>

              {/* Only show option to send with address for Admin */}
              {session?.user?.role === "ADMIN" && (
                <div className="flex space-x-1 rounded-full bg-color4 p-1">
                  {[true, false].map((type) => (
                    <button
                      key={String(type)}
                      className={`rounded-full px-2 py-1 ${
                        useUsername === type
                          ? "bg-primary/20 text-primary border border-primary"
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

            {/* Show AMM loading state for convertable payments */}
            {paymentType === "convertable" && loadingAMMData && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500 rounded-full">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <p className="text-blue-400 text-sm">Loading AMM pool data...</p>
                </div>
              </div>
            )}

            {/* Show AMM data error for convertable payments */}
            {paymentType === "convertable" && ammDataError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-full">
                <p className="text-red-400 text-sm">{ammDataError}</p>
              </div>
            )}

            {/* Show calculation error if any */}
            {paymentType === "convertable" && calculationError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-full">
                <p className="text-red-400 text-sm">Calculation Error: {calculationError}</p>
              </div>
            )}

            {/* Show AMM pool info when loaded for convertable payments */}
            {paymentType === "convertable" && ammData && !loadingAMMData && (
              <div className="mb-4 p-3 bg-green-900/20 border border-green-500 rounded-full">
                <p className="text-green-400 text-sm">
                  AMM Pool: {ammData.formattedAmount1.currency}/{ammData.formattedAmount2.currency} 
                  {` (${ammData.tradingFee/1000}% fee)`}
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
                      value={sendAmount ?? ""}
                      onChange={handleSendAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none ${
                        convertInputType === "exact_output" || calculatingAmounts || loadingAMMData ? "cursor-not-allowed opacity-60" : ""
                      }`}
                      placeholder="0.00"
                      disabled={convertInputType === "exact_output" || calculatingAmounts || loadingAMMData}
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
                      value={receiveAmount ?? ""}
                      onChange={handleReceiveAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 hover:border-gray-500 focus:border-primary focus:outline-none ${
                        convertInputType === "exact_input" || calculatingAmounts || loadingAMMData ? "cursor-not-allowed opacity-60" : ""
                      }`}
                      placeholder="0.00"
                      disabled={convertInputType === "exact_input" || calculatingAmounts || loadingAMMData}
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
                    value={amount ?? ""}
                    onChange={(e) => setAmount(e.target.value === "" ? null : Number(e.target.value))}
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
                  loadingAMMData ||
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
                ) : loadingAMMData ? (
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
};
