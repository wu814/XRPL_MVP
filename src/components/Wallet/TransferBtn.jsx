"use client";

import { useEffect, useState } from "react";
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
      if (currency === "XRP") {
        const res = await fetch("/api/transactions/sendXRP", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderWallet,
            recipientUsername,
            amount,
            tag,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setSuccessMessage(result.message);
      } else {
        const res = await fetch("/api/transactions/sendIOU", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderWallet,
            recipientUsername,
            amount,
            currency,
            issuerWallets,
            destinationTag: tag,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowMdl(false);
      setRecipientUsername("");
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
                disabled={Boolean(presetRecipientUsername)} // prevent editing if preset
              />
            </div>

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
                disabled={loading || !recipientUsername || !amount || !currency}
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
