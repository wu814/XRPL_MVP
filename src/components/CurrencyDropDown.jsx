"use client";

import React from "react";

/**
 * A simple controlled dropdown.
 * 
 * Props:
 * - value: the currently selected value
 * - onChange: fn(newValue: string) → void
 * - options: optional array of strings to show
 */
export default function CurrencyDropDown({
  value,
  onChange,
  options = ["BTC", "ETH", "USD", "XRP"],
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded p-2"
    >
      <option value="" disabled>
        Select currency
      </option>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
