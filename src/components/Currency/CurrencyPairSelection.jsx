"use client";

import { useState, useEffect } from "react";
import CurrencyDropDown from "./CurrencyDropDown";
import Button from "../Button";

export default function CurrencyPairSelection({ onPairUpdate }) {
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [quoteCurrency, setQuoteCurrency] = useState("XRP");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Temporary state for modal
  const [modalBase, setModalBase] = useState(baseCurrency);
  const [modalQuote, setModalQuote] = useState(quoteCurrency);

  useEffect(() => {
    if (onPairUpdate) {
      onPairUpdate(baseCurrency, quoteCurrency);
    }
  }, [baseCurrency, quoteCurrency, onPairUpdate]);

  const openModal = () => {
    setModalBase(baseCurrency);
    setModalQuote(quoteCurrency);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSwap = () => {
    const tempBase = modalBase;
    setModalBase(modalQuote);
    setModalQuote(tempBase);
  };

  const handleConfirm = () => {
    setBaseCurrency(modalBase);
    setQuoteCurrency(modalQuote);
    closeModal();
  };

  const baseLogoSrc = `/icons/${baseCurrency}.svg`;
  const quoteLogoSrc = `/icons/${quoteCurrency}.svg`;

  return (
    <>
      <button
        onClick={openModal}
        className="flex w-48 items-center justify-center space-x-2 rounded-lg bg-color2 p-2 transition-colors duration-200 hover:bg-color3"
      >
        <div className="flex -space-x-2">
          <img
            src={baseLogoSrc}
            alt={baseCurrency}
            className="h-8 w-8 rounded-full"
          />
          <img
            src={quoteLogoSrc}
            alt={quoteCurrency}
            className="h-8 w-8 rounded-full"
          />
        </div>
        <span className="text-xl font-semibold">
          {baseCurrency}/{quoteCurrency}
        </span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-auto max-w-lg rounded-lg bg-color2 p-6">
            <h2 className="mb-4 text-2xl font-bold text-primary">
              Select Currency Pair
            </h2>
            <div className="flex flex-row items-center justify-between space-x-4 p-4">
              <div>
                <label className="text-sm font-medium text-mutedText">
                  Base
                </label>
                <CurrencyDropDown
                  value={modalBase}
                  onChange={setModalBase}
                  disabledOptions={[modalQuote]}
                  className="w-40"
                />
              </div>

              <button
                onClick={handleSwap}
                className="mt-6 rounded-full p-2 transition-colors duration-200 hover:text-primary"
              >
                <svg
                  className="h-7 w-7"
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
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m16 10 3-3m0 0-3-3m3 3H5v3m3 4-3 3m0 0 3 3m-3-3h14v-3"
                  />
                </svg>
              </button>

              <div>
                <label className="text-sm font-medium text-mutedText">
                  Quote
                </label>
                <CurrencyDropDown
                  value={modalQuote}
                  onChange={setModalQuote}
                  disabledOptions={[modalBase]}
                  className="w-40"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-4">
              <Button onClick={closeModal} variant="cancel">
                Cancel
              </Button>
              <Button onClick={handleConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
