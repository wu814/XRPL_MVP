"use client";

import { useState, useEffect } from "react";
import CurrencyDropDown from "../Currency/CurrencyDropDown";
import Button from "../Button";
import ErrorMdl from "../ErrorMdl";
import SuccessMdl from "../SuccessMdl";
import { get } from "http";

const OFFER_TYPES = [
  "Regular",
  "FillOrKill",
  "ImmediateOrCancel",
  "Passive",
  "Sell",
];

export default function CreateOffer({ issuerWallets, offerCreatorWallet }) {
  const [offerType, setOfferType] = useState("Regular");
  const [payCurrency, setPayCurrency] = useState(null);
  const [getCurrency, setGetCurrency] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [getAmount, setGetAmount] = useState("");
  const [destinationTag, setDestinationTag] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      console.log(
        offerType,
        payCurrency,
        getCurrency,
        payAmount,
        getAmount,
        destinationTag,
        issuerWallets,
        offerCreatorWallet,
      );
      const payload = {
        offerType,
        payCurrency,
        getCurrency,
        payAmount,
        getAmount,
        destinationTag,
        issuerAddress: issuerWallets[0].classicAddress,
        offerCreatorWallet,
      };

      const res = await fetch("/api/offers/createOffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Offer creation failed");

      setSuccessMessage("Offer created successfully!");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Offer type dropdown */}
      <div className="rounded-lg bg-color3 p-4">
        <label className="mb-2 block text-sm text-mutedText">Offer Type</label>
        <select
          className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-primary"
          value={offerType}
          onChange={(e) => setOfferType(e.target.value)}
        >
          {OFFER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Taker Pays Section */}
      <div className="flex flex-col rounded-lg bg-color3 p-4">
        <label className="block text-sm mb-2 text-mutedText">Currency You Pay</label>
        <div className="flex flex-row justify-between space-x-2">
          <CurrencyDropDown
            value={payCurrency}
            onChange={setPayCurrency}
            disabledOptions={[getCurrency]}
            dropdownBg={"bg-color4"}
          />
          <input
            type="number"
            placeholder="Amount"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            className="mt-1 text-right w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-primary"
          />
        </div>
      </div>

      {/* Taker Gets Section */}
      <div className="flex flex-col rounded-lg bg-color3 p-4">
        <label className="block text-sm mb-2 text-mutedText">Currency You Want</label>
        <div className="flex flex-row justify-between space-x-2">
          <CurrencyDropDown
            value={getCurrency}
            onChange={setGetCurrency}
            disabledOptions={[payCurrency]}
            dropdownBg={"bg-color4"}
          />
          <input
            type="number"
            placeholder="Amount"
            value={getAmount}
            onChange={(e) => setGetAmount(e.target.value)}
            className="mt-1 text-right w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-primary"
          />
        </div>
      </div>

      {/* Optional Destination Tag */}
      <div className="rounded-lg bg-color3 p-4">
        <label className="mb-2 block text-sm text-mutedText">Destination Tag (Optional)</label>
        <input
          type="number"
          placeholder="Destination Tag"
          value={destinationTag}
          onChange={(e) => setDestinationTag(e.target.value)}
          className="mt-1 w-full rounded-lg border border-transparent bg-color4 p-2 focus:border-primary focus:outline-none hover:border-primary"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : "Submit Offer"}
        </Button>
      </div>

      {/* Feedback Modals */}
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
    </div>
  );
}
