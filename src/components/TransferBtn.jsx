"use client";

import { useState } from "react";
import Button from "./Button";
import sendXRP from "@/utils/xrpl/sendXRP";
import sendIOU from "@/utils/xrpl/sendIOU";
import ErrorModal from "./ErrorMdl";
import SuccessModal from "./SuccessMdl";
import CurrencyDropDown from "./CurrencyDropDown";

export default function TransferBtn({ senderWallet, issuerWallets }) {
  const [showModal, setShowModal] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
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
        const result = await sendXRP(senderWallet, recipientAddress, amount, tag);
        setSuccessMessage(result.message);
      } else {
        const result = await sendIOU(senderWallet, recipientAddress, amount, currency, issuerWallets, tag);
        setSuccessMessage(result.message);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowModal(false);
      setRecipientAddress("");
      setAmount("");
      setCurrency("");
      setDestinationTag(""); 
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowModal(true)}>
        Transfer
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
          <div className="w-96 space-y-4 rounded-lg bg-[#3F4359] p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-center">Transfer</h2>

            <div>
              <label className="block text-sm font-medium">Currency</label>
              <CurrencyDropDown
                value={currency}
                onChange={setCurrency}
                disabledOptions={[]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Recipient Address</label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full mt-1 p-2 border border-[#D4D7E9] rounded"
                placeholder="Enter recipient address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Amount</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 p-2 border border-[#D4D7E9] rounded"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Destination Tag (optional)</label>
              <input
                type="text"
                value={destinationTag}
                onChange={(e) => setDestinationTag(e.target.value)}
                className="w-full mt-1 p-2 border border-[#D4D7E9] rounded"
                placeholder="Enter destination tag"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="cancel" onClick={() => setShowModal(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading || !recipientAddress || !amount || !currency}
              >
                {loading ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <ErrorModal errorMessage={errorMessage} onClose={() => setErrorMessage(null)} />
      )}

      {successMessage && (
        <SuccessModal successMessage={successMessage} onClose={() => setSuccessMessage(null)} />
      )}
    </>
  );
}
