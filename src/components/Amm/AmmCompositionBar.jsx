import { useEffect, useState } from "react";
import { fetchUsdPrices, getUsdValue } from "@/utils/currencies";

export default function AmmCompositionBar({ amount1, amount2 }) {
  const [livePrices, setLivePrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const prices = await fetchUsdPrices();
        setLivePrices(prices);
      } catch (error) {
        console.error("Error fetching prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, []);

  // When the component is loading, show a skeleton loader
  if (!amount1 || !amount2 || loading) {
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
  const totalUsdValue = usdValue1 + usdValue2;

  // Calculate percentages for the bar
  const totalValue = Number(usdValue1) + Number(usdValue2);
  const amount1Percent = (usdValue1 / totalValue) * 100;
  const amount2Percent = 100 - amount1Percent;

  // Format USD values
  const formatUsd = (value) => {
    if (value === 0) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format currency amounts with min 2, max 6 decimal places
  const formatCurrencyAmount = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  };

  return (
    <div className="p-4">
      {/* Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary" style={{ width: `${amount1Percent}%` }} />
        <div className="bg-cancel" style={{ width: `${amount2Percent}%` }} />
      </div>

      {/* Currency amounts */}
      <div className="mt-2 flex text-lg font-semibold justify-between">
        <span>
          {formatCurrencyAmount(amount1.value)} {amount1.currency}
        </span>
        <span>
          {formatCurrencyAmount(amount2.value)} {amount2.currency}
        </span>
      </div>

      {/* USD values */}
      <div className="mt-1 flex justify-between">
        <span className="text-sm text-gray-400">
          {formatUsd(usdValue1)}
        </span>
        <span className="text-sm text-gray-400">
          {formatUsd(usdValue2)}
        </span>
      </div>

      {/* Total USD value */}
      {totalUsdValue > 0 && (
        <div className="mt-2 text-center">
          <span className="text-sm text-mutedText">
            Pool Value: {formatUsd(totalUsdValue)}
          </span>
        </div>
      )}
    </div>
  );
}
