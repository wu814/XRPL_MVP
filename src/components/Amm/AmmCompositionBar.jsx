import { formatCurrencyValue, getUsdValue } from "@/utils/xrpl/assets";

export default function AmmCompositionBar({ amount1, amount2, livePrices, pricesLoading }) {
  // When the component is loading, show a skeleton loader
  if (!amount1 || !amount2 || pricesLoading) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-2 w-full rounded-full bg-pulse" />
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
  const usdValue1 = getUsdValue(amount1.currency, amount1.value, livePrices);
  const usdValue2 = getUsdValue(amount2.currency, amount2.value, livePrices);

  // Calculate percentages for the bar
  const totalValue = Number(usdValue1) + Number(usdValue2);
  const amount1Percent = (usdValue1 / totalValue) * 100;
  const amount2Percent = 100 - amount1Percent;

  return (
    <div className="p-2">
      {/* Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary" style={{ width: `${amount1Percent}%` }} />
        <div className="bg-cancel" style={{ width: `${amount2Percent}%` }} />
      </div>

      {/* Currency amounts */}
      <div className="mt-2 flex text-lg font-semibold justify-between">
        <span>
          {formatCurrencyValue(amount1.value)} {amount1.currency}
        </span>
        <span>
          {formatCurrencyValue(amount2.value)} {amount2.currency}
        </span>
      </div>

      {/* USD values */}
      <div className="mt-1 flex justify-between">
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
}
