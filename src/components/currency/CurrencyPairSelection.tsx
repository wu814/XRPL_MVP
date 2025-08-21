"use client";

import { useState, useEffect } from "react";
import CurrencyDropDown from "./CurrencyDropDown";
import Button from "../Button";
import { ArrowLeftRight } from "lucide-react";

interface CurrencyPairSelectionProps {
  onPairUpdate?: (baseCurrency: string, quoteCurrency: string) => void;
}

export default function CurrencyPairSelection({ onPairUpdate }: CurrencyPairSelectionProps) {
  const [baseCurrency, setBaseCurrency] = useState<string>("XRP");
  const [quoteCurrency, setQuoteCurrency] = useState<string>("USD");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Temporary state for modal
  const [modalBase, setModalBase] = useState<string>(baseCurrency);
  const [modalQuote, setModalQuote] = useState<string>(quoteCurrency);

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

  const baseLogoSrc = `/icons/${baseCurrency}.png`;
  const quoteLogoSrc = `/icons/${quoteCurrency}.png`;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-auto max-w-lg rounded-lg bg-color2 p-6">
            <h2 className="mb-4 text-2xl font-bold">
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
                className="mt-6 rounded-full bg-color3 p-2 transition-colors duration-200 hover:bg-color4"
              >
                <ArrowLeftRight className="h-5 w-5 text-gray-400" />
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

            <div className="mt-6 flex space-x-4">
              <Button onClick={closeModal} variant="cancel" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};