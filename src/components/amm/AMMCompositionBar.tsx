import React from "react";
import { formatCurrencyValue, getUSDValue, PriceInfo } from "@/utils/currencyUtils";

interface CurrencyAmount {
  currency: string;
  value: string | number;
}

interface AMMCompositionBarProps {
  amount1: CurrencyAmount;
  amount2: CurrencyAmount;
  livePrices: PriceInfo[];
  pricesLoading: boolean;
}

export default function AMMCompositionBar({ 
  amount1, 
  amount2, 
  livePrices, 
  pricesLoading 
}: AMMCompositionBarProps) {
  // When the component is loading, show a skeleton loader
  if (!amount1 || !amount2 || pricesLoading) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-3 w-full rounded-full bg-pulse" />
        <div className="mt-2 flex justify-between">
          <div className="h-3 w-20 rounded-lg bg-pulse" />
          <div className="h-3 w-20 rounded-lg bg-pulse" />
        </div>
        <div className="mt-1 flex justify-between">
          <div className="h-3 w-16 rounded-lg bg-pulse" />
          <div className="h-3 w-16 rounded-lg bg-pulse" />
        </div>
      </div>
    );
  }

  // Calculate USD values
  const usdValue1 = getUSDValue(amount1.currency, amount1.value, livePrices);
  const usdValue2 = getUSDValue(amount2.currency, amount2.value, livePrices);

  // Calculate percentages for the bar
  const totalValue = Number(usdValue1) + Number(usdValue2);
  const amount1Percent = totalValue > 0 ? (usdValue1 / totalValue) * 100 : 50;
  const amount2Percent = 100 - amount1Percent;

  return (
    <div>
      {/* Bar */}
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary/85" style={{ width: `${amount1Percent}%` }} />
        <div className="bg-cancel/85" style={{ width: `${amount2Percent}%` }} />
      </div>

      {/* Currency amounts */}
      <div className="mt-2 flex text-xl font-medium justify-between px-2">
        <span>
          {formatCurrencyValue(amount1.value)} {amount1.currency}
        </span>
        <span>
          {formatCurrencyValue(amount2.value)} {amount2.currency}
        </span>
      </div>

      {/* USD values */}
      <div className="mt-1 flex justify-between px-2">
        <span className="text-sm text-gray-400">
          ${formatCurrencyValue(usdValue1)}
        </span>
        <span className="text-sm text-gray-400">
          ${formatCurrencyValue(usdValue2)}
        </span>
      </div>

      {/* Removed the total USD value display from here */}
    </div>
  );
};
