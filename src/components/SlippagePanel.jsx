"use client";

import { useState } from "react";


export default function SlippagePanel({ slippage, setSlippage, onClose }) {
  // Slippage is now stored as a simple percentage value (e.g., 5 for 5%)

  const [tempSlippage, setTempSlippage] = useState(
    parseFloat(slippage).toFixed(1) // slippage is already in percentage
  );

  const handleSave = () => {
    const parsed = parseFloat(tempSlippage);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setSlippage(parsed.toFixed(1)); // Store as simple percentage
      if (onClose) onClose();
    }
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
          value={tempSlippage}
          onChange={(e) => setTempSlippage(e.target.value)}
          className="relative w-full rounded-lg border border-border bg-color6 p-2 focus:border-primary focus:outline-none hover:border-primary"
        />
        <p className="absolute right-2 top-2">%</p>
      </div>
      <div className="mt-3 flex justify-end space-x-3">
        <button
          onClick={onClose}
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
