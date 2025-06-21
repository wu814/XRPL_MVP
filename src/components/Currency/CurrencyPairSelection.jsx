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
        className="flex w-48 items-center justify-center space-x-2 p-2 rounded-lg bg-color2 hover:bg-color3 transition-colors duration-200"
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
        <span className="font-semibold text-xl">
          {baseCurrency}/{quoteCurrency}
        </span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-color2 p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4">Select Currency Pair</h2>
            <div className="flex flex-col items-center space-x-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-mutedText">
                  Base
                </label>
                <CurrencyDropDown
                  value={modalBase}
                  onChange={setModalBase}
                  disabledOptions={[modalQuote]}
                />
              </div>

              <button
                onClick={handleSwap}
                className="p-2 mt-5 rounded-full hover:bg-color3 transition-colors duration-200"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </button>

              <div className="flex-1">
                <label className="text-sm font-medium text-mutedText">
                  Quote
                </label>
                <CurrencyDropDown
                  value={modalQuote}
                  onChange={setModalQuote}
                  disabledOptions={[modalBase]}
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