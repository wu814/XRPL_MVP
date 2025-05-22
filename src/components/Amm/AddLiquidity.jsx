// components/AddLiquidity.jsx
import CurrencyIcon from "../CurrencyIcon";

export default function AddLiquidity({ ammInfo }) {
  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  return (
    <div className="space-y-4">
      {/* Token A input */}
      <div className="flex items-centr justify-between rounded-lg bg-color3 p-4">
        <div className="flex items-center gap-2">
          <CurrencyIcon symbol={token1?.currency} />
        </div>
        <div className="text-right">
          <input
            type="number"
            placeholder="0"
            className="w-20 bg-transparent text-right focus:outline-none"
          />
        </div>
      </div>

      {/* Token B input */}
      <div className="flex items-center justify-between rounded-lg bg-color3 p-4">
        <div className="flex items-center gap-2">
          <CurrencyIcon symbol={token2?.currency} />
        </div>
        <div className="text-right">
          <input
            type="number"
            placeholder="0"
            className="w-20 bg-transparent text-right focus:outline-none"
          />
        </div>
      </div>

      {/* Receive preview */}
      <div className="rounded-lg bg-color3 p-4 text-white">
        <p className="text-sm font-medium">Receive</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Total value</span>
          <span className="text-sm font-semibold">$0</span>
        </div>
        <p className="mt-1 text-right text-xs">
          0 50{token1?.currency}-50{token2?.currency}
        </p>
      </div>
    </div>
  );
}
