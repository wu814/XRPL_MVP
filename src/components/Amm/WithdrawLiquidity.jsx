// components/WithdrawLiquidity.jsx
import CurrencyIcon from "../CurrencyIcon";

export default function WithdrawLiquidity({ ammInfo }) {
  const token1 = ammInfo?.amount;
  const token2 = ammInfo?.amount2;

  return (
    <div className="space-y-4">
      {/* LP Token withdrawal input */}
      <div className="flex items-center justify-between rounded-lg bg-color3 p-4">
        <div className="text-md font-medium text-white">Withdraw LP Tokens</div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Balance 0</p>
          <input
            type="number"
            placeholder="0"
            className="w-20 bg-transparent text-right text-white focus:outline-none"
          />
        </div>
      </div>

      {/* Token preview after withdrawal */}
      <div className="rounded-lg bg-color3 p-4 text-white">
        <p className="text-sm font-medium">You will receive</p>
        <div className="mt-1 flex justify-between text-sm">
          <div className="flex items-center gap-1">
            <CurrencyIcon
              symbol={token1?.currency}
              heightClass="h-4"
              widthClass="w-4"
            />
            <span>0 {token1?.currency}</span>
          </div>
          <div className="flex items-center gap-1">
            <CurrencyIcon
              symbol={token2?.currency}
              heightClass="h-4"
              widthClass="w-4"
            />
            <span>0 {token2?.currency}</span>
          </div>
        </div>
      </div>

      <button className="w-full rounded-lg bg-[#1D90F5] p-2 font-medium text-white">
        Connect Wallet
      </button>
    </div>
  );
}
