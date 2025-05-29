"use client";

import { use, useEffect, useState } from "react";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import CurrencyDropDown from "../CurrencyDropDown";

export default function TransferBtn({
  senderWallet,
  issuerWallets,
  presetRecipientUsername,
}) {
  const [showMdl, setShowMdl] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState(
    presetRecipientUsername || "",
  );
  const [recipientAddress, setRecipientAddress] = useState("");
  const [useUsername, setUseUsername] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const tag = destinationTag.trim() !== "" ? Number(destinationTag) : null;
      const recipient = useUsername ? recipientUsername : recipientAddress;
      const endpoint =
        currency === "XRP"
          ? "/api/transactions/sendXRP"
          : "/api/transactions/sendIOU";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderWallet,
          recipient,
          amount,
          ...(currency !== "XRP" && { currency, issuerWallets }),
          destinationTag: tag,
          useUsername,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setSuccessMessage(result.message);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      setRecipientUsername("");
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
          <div className="w-96 space-y-4 rounded-lg bg-modal p-6 shadow-lg">
            <h2 className="text-center text-xl font-semibold">Transfer</h2>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-mutedText">
                Use Username
              </label>
              <input
                type="checkbox"
                checked={useUsername}
                onChange={() => setUseUsername(!useUsername)}
                disabled={Boolean(presetRecipientUsername)}
              />
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
                  className="mt-1 w-full rounded border border-border bg-modal p-2 focus:border-primary focus:outline-none"
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
                  className="mt-1 w-full rounded border border-border bg-modal p-2 focus:border-primary focus:outline-none"
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
                className="mt-1 w-full rounded border border-border bg-modal p-2 focus:border-primary focus:outline-none"
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
                className="mt-1 w-full rounded border border-border bg-modal p-2 focus:border-primary focus:outline-none"
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
