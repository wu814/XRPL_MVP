"use client";

import { useState } from "react";

export default function SlippagePanel({ slippage, setSlippage, onClose }) {
  // Show percent value in input, even though slippage is stored as multiplier

  const [tempSlippage, setTempSlippage] = useState(
    ((parseFloat(slippage) - 1) * 100).toFixed(1), // convert back to % for display
  );

  const handleSave = () => {
    const parsed = parseFloat(tempSlippage);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      const slippageMultiplier = 1 + parsed / 100;
      setSlippage(slippageMultiplier.toFixed(6));
      if (onClose) onClose();
    }
  };

  return (
    <div
      className={`absolute right-2 top-10 z-10 w-3/5 rounded-lg bg-color6 p-4 border border-border`}
    >
      <label className="mb-1 block text-sm font-medium text-mutedText">
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
      <div className="mt-3 flex justify-end space-x-2">
        <button
          onClick={onClose}
          className="text-sm text-mutedText hover:underline"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-sm font-medium text-primary hover:underline"
        >
          Save
        </button>
      </div>
    </div>
  );
}
