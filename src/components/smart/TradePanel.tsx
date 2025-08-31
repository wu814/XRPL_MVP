"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { ArrowUpRight, ArrowDownLeft, ArrowUpDown, Building2, Search, Settings, Loader2 } from "lucide-react";
import ConvertCurrencyDropDown from "@/components/currency/ConvertCurrencyDropDown";
import SendCurrencyDropDown from "@/components/currency/SendCurrencyDropDown";
import FavoritesList from "@/components/smart/FavoritesList";
import SlippagePanel from "@/components/SlippagePanel";
import ErrorMdl from "@/components/ErrorMdl";
import SuccessMdl from "@/components/SuccessMdl";
import Button from "../Button";
import { useCurrentUserWallet } from "@/components/wallet/CurrentUserWalletProvider";
import { useIssuerWallet } from "@/components/wallet/IssuerWalletProvider";
import { availableCurrencies, formatCurrencyValue, YONACurrency } from "@/utils/currencyUtils";
import { useSession } from "next-auth/react";
import { calculateExactAMMInput, calculateEstimateOutput } from "@/utils/xrpl/amm/calculations";
import { YONAWallet } from "@/types/appTypes";
import { GetAccountInfoAPIResponse } from "@/types/api/walletAPITypes";
import { GetAccountLinesAPIResponse } from "@/types/api/walletAPITypes";
import { GetFormattedAMMInfoByCurrenciesAPIResponse } from "@/types/api/ammAPITypes";
import { FormattedAMMInfo } from "@/types/xrpl/ammXRPLTypes";
import { SmartTradeAPIResponse } from "@/types/api/smartAPITypes";
import { APIErrorResponse } from "@/types/api/errorAPITypes";


interface WalletBalance {
  [currency: string]: number;
}

interface SmartTradeResponse {
  message?: string;
  error?: string;
}

interface RecentRecipient {
  address: string;
  lastSent: string;
}

type ActiveTab = "Convert" | "Send";
type ActiveInput = "sell" | "buy";
type TradeInputType = "exact_input" | "exact_output";
type PaymentType = "direct" | "convertable";
type ConvertInputType = "exact_input" | "exact_output" | null;

export default function TradePanel() {
  const { data: sessionData, status } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>("Convert");

  // Convert states (integrated from SmartTradeMenu)
  const [sellCurrency, setSellCurrency] = useState<string>("USD");
  const [buyCurrency, setBuyCurrency] = useState<string>("XRP");
  const [sellAmount, setSellAmount] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState<number | null>(null);
  const [activeInput, setActiveInput] = useState<ActiveInput>("sell");
  const [tradeInputType, setTradeInputType] = useState<TradeInputType>("exact_input");

  // Add calculation states
  const [calculatingAmounts, setCalculatingAmounts] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // AMM data states - fetch once when currencies change
  const [ammData, setAMMData] = useState<FormattedAMMInfo>(null);
  const [loadingAMMData, setLoadingAMMData] = useState<boolean>(false);
  const [ammDataError, setAMMDataError] = useState<string | null>(null);

  // Send form states (Enhanced from TransferBtn)
  const [recipientUsername, setRecipientUsername] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [useUsername, setUseUsername] = useState<boolean>(true);
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [destinationTag, setDestinationTag] = useState<string>("");
  const [paymentType, setPaymentType] = useState<PaymentType>("direct");
  const [convertInputType, setConvertInputType] = useState<ConvertInputType>(null);
  const [sendCurrency, setSendCurrency] = useState<string>("USD");
  const [receiveCurrency, setReceiveCurrency] = useState<string>("XRP");
  const [sendAmount, setSendAmount] = useState<number | null>(null);
  const [receiveAmount, setReceiveAmount] = useState<number | null>(null);

  // Common states
  const [slippage, setSlippage] = useState<number>(0);
  const [showSlippagePanel, setShowSlippagePanel] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const { currentUserWallets } = useCurrentUserWallet();
  const { issuerWallets } = useIssuerWallet();

  // Get the primary wallet
  const senderWallet = currentUserWallets?.find(
    (wallet: YONAWallet) =>
      wallet.walletType === "USER" ||
      wallet.walletType === "BUSINESS" ||
      wallet.walletType === "ISSUER",
  );

  // Add new state for wallet balance
  const [walletBalances, setWalletBalances] = useState<WalletBalance>({});
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);

  // Convert functionality integration
  const handleSellAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setActiveInput("sell");
    const value = e.target.value;
    setSellAmount(value === "" ? null : Number(value));
    setBuyAmount(null);
    setTradeInputType("exact_input");
  };

  const handleBuyAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setActiveInput("buy");
    const value = e.target.value;
    setBuyAmount(value === "" ? null : Number(value));
    setSellAmount(null);
    setTradeInputType("exact_output");
  };

  const handleCurrencySwap = (): void => {
    const temp = sellCurrency;
    setSellCurrency(buyCurrency);
    setBuyCurrency(temp);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setActiveInput("sell");
  };

  // Fetch AMM data when currencies change
  useEffect(() => {
    if (activeTab === "Convert") {
      if (sellCurrency && buyCurrency && sellCurrency !== buyCurrency) {
        fetchAMMInfoByCurrencies(sellCurrency, buyCurrency);
      } else {
        setAMMData(null);
        setAMMDataError(null);
      }
    } else if (activeTab === "Send" && paymentType === "convertable") {
      if (sendCurrency && receiveCurrency && sendCurrency !== receiveCurrency) {
        fetchAMMInfoByCurrencies(sendCurrency, receiveCurrency);
      } else {
        setAMMData(null);
        setAMMDataError(null);
      }
    } else {
      setAMMData(null);
      setAMMDataError(null);
    }
  }, [
    activeTab,
    sellCurrency,
    buyCurrency,
    sendCurrency,
    receiveCurrency,
    paymentType,
  ]);

  const fetchAMMInfoByCurrencies = async (currency1: string, currency2: string): Promise<void> => {
    setLoadingAMMData(true);
    setAMMDataError(null);
    setAMMData(null);

    try {
      const response = await fetch("/api/amm/getFormattedAMMInfoByCurrencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellCurrency: currency1,
          buyCurrency: currency2,
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

  // Generic calculation function for output
  const calculateOutputAmount = async (
    inputAmount: number,
    inputCurrency: string,
    outputCurrency: string,
    setOutputAmount: (amount: number) => void,
  ): Promise<void> => {
    if (!ammData) {
      console.log("⚠️ No AMM data available for output calculation");
      return;
    }

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {
      let poolInput: number, poolOutput: number;
      if (ammData.formattedAmount1.currency === inputCurrency) {
        poolInput = parseFloat(ammData.formattedAmount1.value);
        poolOutput = parseFloat(ammData.formattedAmount2.value);
      } else {
        poolInput = parseFloat(ammData.formattedAmount2.value);
        poolOutput = parseFloat(ammData.formattedAmount1.value);
      }

      const calculation = calculateEstimateOutput(
        poolInput,
        poolOutput,
        inputAmount,
        ammData.tradingFee / 100000 || 0,
      );

      if (calculation.success) {
        setOutputAmount(Number((calculation.estimatedOutput).toFixed(6)));
      } else {
        throw new Error(calculation.error);
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setOutputAmount(null);
    } finally {
      setCalculatingAmounts(false);
    }
  };

  // Generic calculation function for input
  const calculateInputAmount = async (
    outputAmount: number,
    inputCurrency: string,
    outputCurrency: string,
    setInputAmount: (amount: number) => void,
  ): Promise<void> => {
    if (!ammData) {
      console.log("⚠️ No AMM data available for input calculation");
      return;
    }

    setCalculatingAmounts(true);
    setCalculationError(null);

    try {
      let poolInput: number, poolOutput: number;
      if (ammData.formattedAmount1.currency === inputCurrency) {
        poolInput = parseFloat(ammData.formattedAmount1.value);
        poolOutput = parseFloat(ammData.formattedAmount2.value);
      } else {
        poolInput = parseFloat(ammData.formattedAmount2.value);
        poolOutput = parseFloat(ammData.formattedAmount1.value);
      }

      const calculation = calculateExactAMMInput(
        poolInput,
        poolOutput,
        outputAmount,
        slippage / 100,
        ammData.tradingFee / 100000 || 0,
      );

      if (calculation.success) {
        setInputAmount(Number((calculation.inputWithSlippage).toFixed(6)));
      } else {
        throw new Error(calculation.error);
      }
    } catch (error: any) {
      setCalculationError(error.message);
      setInputAmount(null);
    } finally {
      setCalculatingAmounts(false);
    }
  };

  // All the useEffect hooks for calculations
  useEffect(() => {
    if (
      sellAmount &&
      (sellAmount > 0 &&
      sellCurrency &&
      buyCurrency &&
      sellCurrency !== buyCurrency &&
      activeInput === "sell" &&
      ammData
    )) {
      calculateOutputAmount(
        sellAmount,
        sellCurrency,
        buyCurrency,
        setBuyAmount,
      );
    } else if (
      activeInput === "sell" &&
      (!sellAmount || sellAmount <= 0)
    ) {
      setBuyAmount(null);
    }
  }, [sellAmount, sellCurrency, buyCurrency, activeInput, ammData]);

  useEffect(() => {
    if (
      buyAmount &&
      buyAmount > 0 &&
      sellCurrency &&
      buyCurrency &&
      sellCurrency !== buyCurrency &&
      activeInput === "buy" &&
      ammData
    ) {
      calculateInputAmount(buyAmount, sellCurrency, buyCurrency, setSellAmount);
    } else if (
      activeInput === "buy" &&
      (!buyAmount || buyAmount <= 0)
    ) {
      setSellAmount(null);
    }
  }, [buyAmount, sellCurrency, buyCurrency, activeInput, slippage, ammData]);

  useEffect(() => {
    if (
      sendAmount &&
      sendAmount > 0 &&
      sendCurrency &&
      receiveCurrency &&
      sendCurrency !== receiveCurrency &&
      convertInputType === "exact_input" &&
      ammData
    ) {
      calculateOutputAmount(
        sendAmount,
        sendCurrency,
        receiveCurrency,
        setReceiveAmount,
      );
    } else if (
      convertInputType === "exact_input" &&
      (!sendAmount || sendAmount <= 0)
    ) {
      setReceiveAmount(null);
    }
  }, [sendAmount, sendCurrency, receiveCurrency, convertInputType, ammData]);

  useEffect(() => {
    if (
      receiveAmount &&
      receiveAmount > 0 &&
      sendCurrency &&
      receiveCurrency &&
      sendCurrency !== receiveCurrency &&
      convertInputType === "exact_output" &&
      ammData
    ) {
      calculateInputAmount(
        receiveAmount,
        sendCurrency,
        receiveCurrency,
        setSendAmount,
      );
    } else if (
      convertInputType === "exact_output" &&
      (!receiveAmount || receiveAmount <= 0)
    ) {
      setSendAmount(null);
    }
  }, [
    receiveAmount,
    sendCurrency,
    receiveCurrency,
    convertInputType,
    slippage,
    ammData,
  ]);

  const handleSmartTrade = async (): Promise<void> => {
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
          slippagePercent: slippage,
          paymentType: tradeInputType,
          exactOutputAmount:
            tradeInputType === "exact_output" ? buyAmount : undefined,
        }),
      });

      if (!response.ok) {
        const errorData: APIErrorResponse = await response.json();
        setErrorMessage(errorData.message);
        return;
      }

      const result: SmartTradeAPIResponse | APIErrorResponse = await response.json();
      setSuccessMessage(
        result.message || "Smart trade completed successfully!",
      );
      fetchWalletBalances();

      // Reset form
      setSellAmount(null);
      setBuyAmount(null);
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentTypeChange = (type: PaymentType): void => {
    setPaymentType(type);
    setConvertInputType(null);
    setSendAmount(null);
    setReceiveAmount(null);
    setAmount(null);
  };

  const handleSendAmountChangeForPayment = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSendAmount(value === "" ? null : Number(value));
    setReceiveAmount(null);
    setConvertInputType(value ? "exact_input" : null);
  };

  const handleReceiveAmountChangeForPayment = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setReceiveAmount(value === "" ? null : Number(value));
    setSendAmount(null);
    setConvertInputType(value ? "exact_output" : null);
  };

  const handleSendSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
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
          issuerAddress: issuerWallets[0].classicAddress,
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
      setAmount(null);
      setDestinationTag("");
      setSendAmount(null);
      setReceiveAmount(null);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const recents: RecentRecipient[] = [
    { address: "rwnYLU...nqf63J", lastSent: "2 months ago" },
    { address: "0xf839...0369e4", lastSent: "11 months ago" },
    { address: "rUy72X...zNDTD2", lastSent: "1 year ago" },
  ];

  const handleMax = (): void => {
    if (activeTab === "Convert" && sellCurrency) {
      const maxBalance = walletBalances[sellCurrency] || 0;
      setSellAmount(Number(maxBalance.toFixed(2)));
      setBuyAmount(null);
      setActiveInput("sell");
      setTradeInputType("exact_input");
    }
  };

  const getCurrencyData = (currencyId: string): YONACurrency => {
    return (
      availableCurrencies.find((c) => c.id === currencyId) ||
      availableCurrencies[0]
    );
  };

  const handleRecipientClick = (recipient: RecentRecipient | string): void => {
    const recipientValue = typeof recipient === 'string' ? recipient : recipient.address;
    if (useUsername) {
      setRecipientUsername(recipientValue);
    } else {
      setRecipientAddress(recipientValue);
    }
  };

  const handleDropdownToggle = (dropdownId: string): void => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  const canTrade =
    sellCurrency &&
    buyCurrency &&
    sellCurrency !== buyCurrency &&
    ((sellAmount && sellAmount > 0) ||
      (buyAmount && buyAmount > 0));

  const fetchWalletBalances = async (): Promise<void> => {
    if (!senderWallet) return;

    setLoadingBalance(true);
    try {
      const [accountInfoResponse, accountLinesResponse] = await Promise.all([
        fetch("/api/wallet/getAccountInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: senderWallet }),
        }),
        fetch("/api/wallet/getAccountLines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: senderWallet }),
        }),
      ]);

      const accountInfo: GetAccountInfoAPIResponse = await accountInfoResponse.json();
      const accountLines: GetAccountLinesAPIResponse = await accountLinesResponse.json();

      const balances: WalletBalance = {};

      if (accountInfo.data?.Balance) {
        const xrpBalance = parseFloat(accountInfo.data.Balance.toString());
        const ownerCount = accountInfo.data.OwnerCount || 0;
        const BASE_RESERVE_XRP = 1;
        const OWNER_RESERVE_XRP = 0.2;
        const totalReserve = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
        const availableBalance = Math.max(0, xrpBalance - totalReserve);

        balances["XRP"] = availableBalance;
      }

      if (accountLines.data) {
        accountLines.data.forEach((line) => {
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

  // Reset amounts when currencies change
  useEffect(() => {
    setSellAmount(null);
    setBuyAmount(null);
    setCalculationError(null);
  }, [sellCurrency]);

  useEffect(() => {
    setSellAmount(null);
    setBuyAmount(null);
    setCalculationError(null);
  }, [buyCurrency]);

  return (
    <>
      <div className="fixed bottom-0 right-0 top-24 mt-2 w-[30rem] overflow-y-auto rounded-lg bg-color2">
        {/* Smart Trade Header */}
        <div className="border-b border-gray-600 p-6">
          <div className="relative flex flex-row items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Smart Trade / Payment
            </h2>
            <button
              onClick={() => setShowSlippagePanel((prev) => !prev)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-color3 hover:text-white"
            >
              <Settings className="h-5 w-5" />
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
        <div className="mb-8 p-6">
          {/* Tab Buttons */}
          <div className="mb-4 flex rounded-full bg-color3 p-1">
            {(["Convert", "Send"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-md flex-1 rounded-full px-3 py-2 font-semibold transition-colors ${
                  activeTab === tab
                    ? "border border-primary bg-primary/20 text-primary"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Convert" ? (
            // Convert Layout
            <>
              {loadingAMMData && (
                <div className="mb-4 rounded-full border border-blue-500 bg-blue-900/20 p-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <p className="text-sm text-blue-400">
                      Loading AMM pool data...
                    </p>
                  </div>
                </div>
              )}

              {ammDataError && (
                <div className="mb-4 rounded-full border border-red-500 bg-red-900/20 p-3">
                  <p className="text-sm text-red-400">{ammDataError}</p>
                </div>
              )}

              {calculationError && (
                <div className="mb-4 rounded-full border border-red-500 bg-red-900/20 p-3">
                  <p className="text-sm text-red-400">
                    Calculation Error: {calculationError}
                  </p>
                </div>
              )}

              {ammData && !loadingAMMData && (
                <div className="mb-4 rounded-full border border-green-500 bg-green-900/20 p-3">
                  <p className="text-sm text-green-400">
                    AMM Pool: {ammData.formattedAmount1.currency}/
                    {ammData.formattedAmount2.currency}
                    {` (${ammData.tradingFee / 1000}% fee)`}
                  </p>
                </div>
              )}

              {/* Sell Section */}
              <div className="mb-4 rounded-lg border border-transparent bg-color3 p-6 focus-within:!border-primary hover:border-gray-500">
                <div className="mb-4 flex items-center justify-between rounded-lg">
                  <div className="flex flex-1 flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">
                      Sell
                    </label>
                    <ConvertCurrencyDropDown
                      asset={getCurrencyData(sellCurrency)}
                      onSelect={setSellCurrency}
                      label=""
                      currencies={availableCurrencies.filter(
                        (c) => c.id !== buyCurrency,
                      )}
                    />
                    {sellCurrency && (
                      <div className="text-sm text-gray-400">
                        Balance:{" "}
                        {loadingBalance
                          ? "Loading..."
                          : `${formatCurrencyValue(walletBalances[sellCurrency] || 0)} ${sellCurrency}`}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.000001"
                        value={sellAmount ?? ""}
                        onChange={handleSellAmountChange}
                        placeholder="0.00"
                        className={`w-48 bg-transparent text-right text-4xl font-light text-white outline-none ${
                          (!!buyAmount && activeInput === "buy") ||
                          calculatingAmounts ||
                          loadingAMMData
                            ? "cursor-not-allowed opacity-60"
                            : ""
                        }`}
                        min="0"
                        disabled={
                          (!!buyAmount && activeInput === "buy") ||
                          calculatingAmounts ||
                          loadingAMMData
                        }
                      />
                    </div>
                    <div className="mt-2 flex items-center space-x-2">
                      <Button
                        onClick={handleMax}
                        disabled={
                          loadingBalance ||
                          !sellCurrency ||
                          (walletBalances[sellCurrency] || 0) <= 0 ||
                          calculatingAmounts ||
                          loadingAMMData
                        }
                        variant="primary"
                      >
                        Max
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Swap Icon */}
              <div className="my-4 flex justify-center">
                <button
                  onClick={handleCurrencySwap}
                  className="rounded-full bg-color3 p-3 transition-colors hover:bg-color4"
                  disabled={
                    !sellCurrency ||
                    !buyCurrency ||
                    calculatingAmounts ||
                    loadingAMMData
                  }
                >
                  <ArrowUpDown className="h-6 w-6 text-gray-400" />
                </button>
              </div>

              {/* Buy Section */}
              <div className="mb-8 rounded-lg border border-transparent bg-color3 p-6 focus-within:!border-primary hover:border-gray-500">
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">
                      Buy
                    </label>
                    <ConvertCurrencyDropDown
                      asset={getCurrencyData(buyCurrency)}
                      onSelect={setBuyCurrency}
                      label=""
                      currencies={availableCurrencies.filter(
                        (c) => c.id !== sellCurrency,
                      )}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={buyAmount ?? ""}
                      onChange={handleBuyAmountChange}
                      placeholder="0.00"
                      className={`w-48 bg-transparent text-right text-4xl font-light text-white outline-none ${
                        (!!sellAmount && activeInput === "sell") ||
                        calculatingAmounts ||
                        loadingAMMData
                          ? "cursor-not-allowed opacity-60"
                          : ""
                      }`}
                      min="0"
                      disabled={
                        (!!sellAmount && activeInput === "sell") ||
                        calculatingAmounts ||
                        loadingAMMData
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Execute Trade Button */}
              <Button
                onClick={handleSmartTrade}
                disabled={
                  !canTrade || loading || calculatingAmounts || loadingAMMData
                }
                className="w-full text-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Trading...</span>
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
                  "Execute Smart Trade"
                )}
              </Button>
            </>
          ) : (
            // Send Layout - Rest of the existing send functionality
            <>
              {/* Payment Type and Username/Address Toggle */}
              <div
                className={`flex ${sessionData?.user?.role === "ADMIN" ? "justify-between space-x-2" : "justify-center"} mb-4`}
              >
                <div
                  className={`flex space-x-1 rounded-full bg-color3 p-1 ${sessionData?.user?.role !== "ADMIN" ? "w-full" : ""}`}
                >
                  <button
                    className={`text-md flex-1 rounded-full px-3 py-2 transition-colors ${paymentType === "direct" ? "border border-primary bg-primary/20 text-primary" : "bg-color3 text-gray-300 hover:text-white"}`}
                    onClick={() => handlePaymentTypeChange("direct")}
                  >
                    Direct
                  </button>
                  <button
                    className={`text-md flex-1 rounded-full px-3 py-2 transition-colors ${paymentType === "convertable" ? "border border-primary bg-primary/20 text-primary" : "bg-color3 text-gray-300 hover:text-white"}`}
                    onClick={() => handlePaymentTypeChange("convertable")}
                  >
                    Convertable
                  </button>
                </div>

                {sessionData?.user?.role === "ADMIN" && (
                  <div className="flex space-x-1 rounded-full bg-color3 p-1">
                    {[true, false].map((type) => (
                      <button
                        key={String(type)}
                        className={`text-md rounded-full px-2 py-2 ${
                          useUsername === type
                            ? "border border-primary bg-primary/20 text-primary"
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

              {loadingAMMData && (
                <div className="mb-4 rounded-full border border-blue-500 bg-blue-900/20 p-3">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <p className="text-sm text-blue-400">
                      Loading AMM pool data...
                    </p>
                  </div>
                </div>
              )}

              {ammDataError && (
                <div className="mb-4 rounded-full border border-red-500 bg-red-900/20 p-3">
                  <p className="text-sm text-red-400">{ammDataError}</p>
                </div>
              )}

              {calculationError && (
                <div className="mb-4 rounded-full border border-red-500 bg-red-900/20 p-3">
                  <p className="text-sm text-red-400">
                    Calculation Error: {calculationError}
                  </p>
                </div>
              )}

              {ammData && !loadingAMMData && (
                <div className="mb-4 rounded-full border border-green-500 bg-green-900/20 p-3">
                  <p className="text-sm text-green-400">
                    AMM Pool: {ammData.formattedAmount1.currency}/
                    {ammData.formattedAmount2.currency}
                    {` (${ammData.tradingFee / 1000}% fee)`}
                  </p>
                </div>
              )}

              <div className="mb-4 text-xs text-gray-400">
                {paymentType === "direct"
                  ? "Trustline-to-trustline payment"
                  : "Cross-currency XRPL send"}
              </div>

              {/* Send Form */}
              <form onSubmit={handleSendSubmit} className="space-y-3">
                {useUsername ? (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                    <input
                      type="text"
                      placeholder="Recipient Username"
                      value={recipientUsername || ""}
                      onChange={(e) =>
                        setRecipientUsername(e.target.value || "")
                      }
                      className="w-full rounded-lg border border-transparent bg-color3 py-4 pl-12 pr-4 text-lg outline-none hover:border-gray-500 focus:border-primary"
                      required
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                    <input
                      type="text"
                      placeholder="Recipient Address"
                      value={recipientAddress || ""}
                      onChange={(e) =>
                        setRecipientAddress(e.target.value || "")
                      }
                      className="w-full rounded-lg border border-transparent bg-color3 py-4 pl-12 pr-4 text-lg outline-none hover:border-gray-500 focus:border-primary"
                      required
                    />
                  </div>
                )}

                {paymentType === "convertable" ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm text-gray-400">
                          Send Currency
                        </label>
                        <SendCurrencyDropDown
                          value={sendCurrency}
                          onChange={setSendCurrency}
                          currencies={availableCurrencies}
                          isOpen={openDropdown === "sendCurrency"}
                          onToggle={handleDropdownToggle}
                          dropdownId="sendCurrency"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-gray-400">
                          Receive Currency
                        </label>
                        <SendCurrencyDropDown
                          value={receiveCurrency}
                          onChange={setReceiveCurrency}
                          currencies={availableCurrencies}
                          isOpen={openDropdown === "receiveCurrency"}
                          onToggle={handleDropdownToggle}
                          dropdownId="receiveCurrency"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm text-gray-400">
                          Send Amount
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={sendAmount ?? ""}
                          onChange={handleSendAmountChangeForPayment}
                          className={`w-full rounded-lg border border-transparent bg-color3 px-4 py-3 outline-none hover:border-gray-500 focus:border-primary ${convertInputType === "exact_output" ? "cursor-not-allowed opacity-60" : ""}`}
                          placeholder="0.00"
                          disabled={convertInputType === "exact_output"}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm text-gray-400">
                          Receive Amount
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          value={receiveAmount ?? ""}
                          onChange={handleReceiveAmountChangeForPayment}
                          className={`w-full rounded-lg border border-transparent bg-color3 px-4 py-3 outline-none hover:border-gray-500 focus:border-primary ${convertInputType === "exact_input" ? "cursor-not-allowed opacity-60" : ""}`}
                          placeholder="0.00"
                          disabled={convertInputType === "exact_input"}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm text-gray-400">
                        Currency
                      </label>
                      <SendCurrencyDropDown
                        value={currency}
                        onChange={setCurrency}
                        currencies={availableCurrencies}
                        isOpen={openDropdown === "currency"}
                        onToggle={handleDropdownToggle}
                        dropdownId="currency"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-gray-400">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        min="0"
                        value={amount ?? ""}
                        onChange={(e) => setAmount(e.target.value === "" ? null : Number(e.target.value))}
                        className="w-full rounded-lg border border-transparent bg-color3 px-4 py-3 outline-none hover:border-gray-500 focus:border-primary"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Destination Tag (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter destination tag..."
                    value={destinationTag}
                    onChange={(e) => setDestinationTag(e.target.value)}
                    className="w-full rounded-lg border border-transparent bg-color3 px-4 py-3 outline-none hover:border-gray-500 focus:border-primary"
                  />
                </div>
                <div className="mt-4"> </div>
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
                  className="w-full py-2 text-lg"
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
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-medium">Recents</h3>
                    <button className="text-sm text-blue-400">See all</button>
                  </div>
                  {recents.map((recent, index) => (
                    <div
                      key={index}
                      className="flex cursor-pointer items-center space-x-4 rounded-lg p-3 hover:bg-color3"
                      onClick={() => handleRecipientClick(recent)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{recent.address}</div>
                        <div className="text-xs text-gray-400">
                          Sent to {recent.lastSent}
                        </div>
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
          <h3 className="mb-6 text-xl font-bold">Quick Actions</h3>

          <div className="grid grid-cols-1 gap-4">
            <button className="flex items-center space-x-4 rounded-lg bg-color3 p-5 transition-colors hover:bg-gray-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-lg font-medium">Receive crypto</div>
                <div className="text-sm text-gray-400">
                  Get your wallet address
                </div>
              </div>
            </button>

            <button className="flex items-center space-x-4 rounded-lg bg-color3 p-5 transition-colors hover:bg-gray-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-lg font-medium">Wrap Assets</div>
                <div className="text-sm text-gray-400">
                  Secured by our custodian
                </div>
              </div>
            </button>

            <button className="flex items-center space-x-4 rounded-lg bg-color3 p-5 transition-colors hover:bg-gray-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-600">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-lg font-medium">Return Wrapped Assets</div>
                <div className="text-sm text-gray-400">
                  Released from our custody
                </div>
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
};
