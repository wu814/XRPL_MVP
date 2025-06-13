"use client";

import { use, useEffect, useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import SlippagePanel from "../SlippagePanel";

export default function TransferBtn({
  senderWallet,
  issuerWallets,
  presetRecipientUsername,
}) {
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
  const [slippage, setSlippage] = useState("5"); // Default 5% slippage
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);

  const [paymentType, setPaymentType] = useState("regular"); // "regular" or "cross"
  const [sendCurrency, setSendCurrency] = useState(""); // for cross-currency
  const [receiveCurrency, setReceiveCurrency] = useState(""); // for cross-currency

  useEffect(() => {
    if (presetRecipientUsername) {
      setRecipientUsername(presetRecipientUsername);
    }
  }, [presetRecipientUsername]);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const tag = destinationTag.trim() !== "" ? Number(destinationTag) : null;
      let endpoint, requestBody;

      if (paymentType === "cross") {
        endpoint = "/api/transactions/sendCrossCurrency";
        requestBody = {
          senderWallet,
          sendCurrency,
          sendAmount: amount,
          receiveCurrency,
          issuerAddress: issuerWallets[0].classicAddress, // adjust if you have multiple issuers
          slippagePercent: parseFloat(slippage),
          destinationTag: tag,
          useUsername,
          recipient: useUsername ? recipientUsername : recipientAddress,
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
          <div className="w-96 space-y-4 rounded-lg bg-color4 p-6">
            <h2 className="text-center text-xl font-semibold">Transfer</h2>
            <div className="mb-4 flex justify-center">
              <div className="flex space-x-2 rounded-full bg-color5 p-1">
                <button
                  className={`rounded-full px-2 py-1 ${paymentType === "regular" ? "bg-primary text-black" : "bg-color5 text-white"}`}
                  onClick={() => setPaymentType("regular")}
                >
                  Regular
                </button>
                <button
                  className={`rounded-full px-2 py-1 ${paymentType === "cross" ? "bg-primary text-black" : "bg-color5 text-white"}`}
                  onClick={() => setPaymentType("cross")}
                >
                  Cross-Currency
                </button>
              </div>
            </div>
            <div className="relative mb-4 flex justify-between">
              <div className="flex space-x-1 rounded-full bg-color5 p-1">
                {[true, false].map((type) => (
                  <button
                    key={String(type)}
                    className={`rounded-full px-2 py-1 text-sm ${
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
              {paymentType === "cross" && (
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

            {useUsername ? (
              <div>
                <label className="block text-sm font-medium text-mutedText">
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
                <label className="block text-sm font-medium text-mutedText">
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

            {paymentType === "cross" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-mutedText">
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
                  <label className="block text-sm font-medium text-mutedText">
                    Receive Currency
                  </label>
                  <CurrencyDropDown
                    value={receiveCurrency}
                    onChange={setReceiveCurrency}
                    disabledOptions={[]}
                    dropdownBg="bg-color5"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-mutedText">
                  Currency
                </label>
                <CurrencyDropDown
                  value={currency}
                  onChange={setCurrency}
                  disabledOptions={[]}
                  dropdownBg="bg-color5"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Amount
              </label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-transparent bg-color5 p-2 hover:border-primary focus:border-primary focus:outline-none"
                placeholder="Enter amount..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mutedText">
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
                  !amount ||
                  (paymentType === "regular"
                    ? !currency
                    : !sendCurrency || !receiveCurrency)
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
