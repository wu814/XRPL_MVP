"use client";

// Change this file when there are more than 1 issuer wallet

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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  
  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      if (currency === "XRP") {
        // senderWallet is an object, we need to access the seed of this object in the xrpl code to generate the actual wallet object to sign the transaction
        const result = await sendXRP(senderWallet, recipientAddress, amount);
        setSuccessMessage(`✅ Sent ${result.amount} XRP to ${recipientAddress}`);
      } else {
        const result = await sendIOU(senderWallet, recipientAddress, amount, currency, issuerWallets);
        if (!result.success) throw new Error(result.error);
        setSuccessMessage(`✅ Sent ${result.amount} ${currency} to ${recipientAddress}`);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
      setShowModal(false);
      setRecipientAddress("");
      setAmount("");
      setCurrency("");
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setShowModal(true)}>
        Transfer
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-96 space-y-4 rounded-lg bg-white p-6 text-black shadow-lg">
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
                className="w-full mt-1 p-2 border rounded"
                placeholder="r..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Amount</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
                placeholder="e.g. 50"
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
