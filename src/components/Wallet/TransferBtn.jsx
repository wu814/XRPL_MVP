"use client";

import { use, useEffect, useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import SlippagePanel from "../SlippagePanel";
import { useSession } from "next-auth/react";

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

  useEffect(() => {
    if (presetRecipientUsername) {
      setRecipientUsername(presetRecipientUsername);
    }
  }, [presetRecipientUsername]);

  // When toggling paymentType, reset convertable fields
  const handlePaymentTypeChange = (type) => {
    setPaymentType(type);
    setConvertInputType(null);
    setSendAmount("");
    setReceiveAmount("");
    setAmount("");
    setCurrency("");
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
        Transfer/Pay
      </Button>

      {showMdl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="h-[77vh] w-[28vw] space-y-4 rounded-lg bg-color4 p-6">
            <div className="relative mb-6 flex justify-between">
              <h2 className="text-start text-2xl font-semibold text-primary">
                Transfer
              </h2>
              {paymentType === "convertable" && (
                <button onClick={() => setShowSlippagePanel((prev) => !prev)}>
                  <svg
                    className="h-6 w-6 text-mutedText hover:text-primary"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2"
                      d="M20 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6h-2m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4m16 6H10m0 0a2 2 0 1 0-4 0m4 0a2 2 0 1 1-4 0m0 0H4"
                    />
                  </svg>
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
                className={`flex space-x-1 rounded-lg bg-color5 p-1 ${!session?.user?.role === "ADMIN" ? "w-full" : ""}`}
              >
                <button
                  className={`flex-1 rounded-lg px-2 py-1 transition-colors ${paymentType === "direct" ? "bg-primary text-black" : "bg-color5 text-white"}`}
                  onClick={() => handlePaymentTypeChange("direct")}
                >
                  Direct
                </button>
                <button
                  className={`flex-1 rounded-lg px-2 py-1 transition-colors ${paymentType === "convertable" ? "bg-primary text-black" : "bg-color5 text-white"}`}
                  onClick={() => handlePaymentTypeChange("convertable")}
                >
                  Convertable
                </button>
              </div>

              {/* Only show option to send with address for Admin */}
              {session?.user?.role === "ADMIN" && (
                <div className="flex space-x-1 rounded-lg bg-color5 p-1">
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

            {useUsername ? (
              <div>
                <label className="block text-sm text-mutedText">
                  Recipient Username
                </label>
                <input
                  type="text"
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none"
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
                  className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none"
                  placeholder="Enter recipient address..."
                />
              </div>
            )}

            {paymentType === "convertable" ? (
              <>
                <div>
                  <label className="block text-sm text-mutedText">
                    Send Currency
                  </label>
                  <CurrencyDropDown
                    value={sendCurrency}
                    onChange={setSendCurrency}
                    disabledOptions={[]}
                    dropdownBg="bg-color5"
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
                    dropdownBg="bg-color5"
                  />
                </div>
                <div className="flex flex-row space-x-2">
                  <div>
                    <label className="block text-sm text-mutedText">
                      Send Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sendAmount}
                      onChange={handleSendAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none ${convertInputType === "exact_output" ? "cursor-not-allowed opacity-60" : ""}`}
                      placeholder="Enter amount"
                      disabled={convertInputType === "exact_output"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-mutedText">
                      Receive Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={receiveAmount}
                      onChange={handleReceiveAmountChange}
                      className={`mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none ${convertInputType === "exact_input" ? "cursor-not-allowed opacity-60" : ""}`}
                      placeholder="Enter amount"
                      disabled={convertInputType === "exact_input"}
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
                    dropdownBg="bg-color5"
                  />
                </div>
                <div>
                  <label className="block text-sm text-mutedText">Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none"
                    placeholder="Enter amount..."
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
                className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none"
                placeholder="Enter destination tag..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="cancel"
                onClick={() => setShowMdl(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  loading ||
                  !(useUsername ? recipientUsername : recipientAddress) ||
                  (paymentType === "convertable"
                    ? !sendCurrency ||
                      !receiveCurrency ||
                      (!sendAmount && !receiveAmount)
                    : !amount || (paymentType === "direct" && !currency))
                }
              >
                {loading ? "Sending..." : "Send"}
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
