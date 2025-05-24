export default function AmmCompositionBar({ amount1, amount2 }) {
  // When the component is loading, show a skeleton loader
  if (!amount1 || !amount2) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-2 w-full rounded-full bg-pulse" />
        <div className="mt-2 flex justify-between">
          <div className="h-3 w-20 rounded bg-pulse" />
          <div className="h-3 w-20 rounded bg-pulse" />
        </div>
      </div>
    );
  }
  const totalValue = Number(amount1.value) + Number(amount2.value);
  const amount1Percent = (amount1.value / totalValue) * 100;
  const amount2Percent = 100 - amount1Percent;

  return (
    <div className="p-4">
      {/* Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div className="bg-primary" style={{ width: `${amount1Percent}%` }} />
        <div className="bg-cancel" style={{ width: `${amount2Percent}%` }} />
      </div>
      {/* Labels */}
      <div className="mt-2 flex justify-between">
        <span className="text-xs text-primary">
          {Number(amount1.value).toFixed(6)} {amount1.currency}
        </span>
        <span className="text-xs text-cancel">
          {Number(amount2.value).toFixed(6)} {amount2.currency}
        </span>
      </div>
    </div>
  );
}
