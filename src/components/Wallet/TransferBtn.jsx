"use client";

import { use, useEffect, useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import SlippagePanel from "../SlippagePanel";
import { send } from "process";

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
  const [slippage, setSlippage] = useState("1.01"); // Default 1% slippage
  const [showSlippagePanel, setShowSlippagePanel] = useState(false);

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
      const endpoint =
        currency === "XRP"
          ? "/api/transactions/sendXRP"
          : "/api/transactions/sendIOU";

      const requestBody = {
        senderWallet,
        amount,
        destinationTag: tag,
        useUsername,
        ...(currency !== "XRP" && { currency, issuerWallets }),
      };

      // Add recipient information based on the mode
      if (useUsername) {
        requestBody.recipient= recipientUsername;
      } else {
        requestBody.recipient = recipientAddress;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      if (!presetRecipientUsername) {
        setRecipientUsername("");
      }
      setRecipientAddress("");
      setAmount("");
      setCurrency("");
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
            <div className="relative mb-4 flex justify-between">
              <div className="flex space-x-1 rounded-full bg-color5 p-1">
                {[true, false].map((type) => (
                  <button
                    key={String(type)}
                    className={`rounded-full px-4 py-1 text-sm ${
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
                  className="bg-color5 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
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
                  className="bg-color5 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
                  placeholder="Enter recipient address..."
                />
              </div>
            )}

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

            <div>
              <label className="block text-sm font-medium text-mutedText">
                Amount
              </label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-color5 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
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
                className="bg-color5 mt-1 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
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
                  !currency
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
