import { useState } from "react";
import AddLiquidity from "./AddLiquidity";
import WithdrawLiquidity from "./WithdrawLiquidity";
import SwapLiquidity from "./SwapLiquidity";
import { AmmInfo } from "./DisplayAmms";

interface ManageAmmBalanceProps {
  ammInfo: AmmInfo;
  onChange?: () => void;
}

export default function ManageAmmBalance({
  ammInfo,
  onChange,
}: ManageAmmBalanceProps) {
  const [activeTab, setActiveTab] = useState<"swap" | "add" | "withdraw">(
    "swap",
  );

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex gap-8">
        <button
          onClick={() => setActiveTab("swap")}
          className={activeTab === "swap" ? "font-bold" : "opacity-50"}
        >
          Swap
        </button>
        <button
          onClick={() => setActiveTab("add")}
          className={activeTab === "add" ? "font-bold" : "opacity-50"}
        >
          Add
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={activeTab === "withdraw" ? "font-bold" : "opacity-50"}
        >
          Withdraw
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "swap" && (
        <SwapLiquidity ammInfo={ammInfo} onSwapped={onChange} />
      )}
      {activeTab === "add" && (
        <AddLiquidity ammInfo={ammInfo} onAdded={onChange} />
      )}
      {activeTab === "withdraw" && (
        <WithdrawLiquidity ammInfo={ammInfo} onWithdrawn={onChange} />
      )}
    </div>
  );
}
