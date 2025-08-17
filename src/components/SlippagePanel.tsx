"use client";

import { useState, useEffect } from "react";

interface SlippagePanelProps {
  slippage: number;
  setSlippage: (value: number) => void;
  onClose?: () => void;
}

export default function SlippagePanel({ slippage, setSlippage, onClose }: SlippagePanelProps) {
  // Local state for input value that can be empty
  const [inputValue, setInputValue] = useState(slippage.toString());

  // Update local input when slippage prop changes
  useEffect(() => {
    setInputValue(slippage.toString());
  }, [slippage]);

  const handleSave = () => {
    const numValue = Number(inputValue);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setSlippage(numValue);
      if (onClose) onClose();
    }
  };

  const handleClose = () => {
    // If input is empty, set slippage to 0 before closing
    if (inputValue === "") {
      setSlippage(0);
    }
    if (onClose) onClose();
  };

  return (
    <div
      className={`flex flex-col absolute right-2 top-10 z-10 w-3/5 rounded-lg bg-color6 p-4 border border-border`}
    >
      <label className="mb-2 font-medium">
        Slippage Tolerance
      </label>
      <div className="relative flex flex-row">
        <input
          type="number"
          min="0"
          max="100"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="relative w-full rounded-lg border border-border bg-color6 p-2 focus:border-primary focus:outline-none hover:border-primary"
        />
        <p className="absolute right-2 top-2">%</p>
      </div>
      <div className="mt-3 flex justify-end space-x-3">
        <button
          onClick={handleClose}
          className="text-mutedText hover:underline"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="font-medium text-primary hover:underline"
        >
          Save
        </button>
      </div>
    </div>
  );
}
