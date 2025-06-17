// components/ManageAmmBalance.jsx
import { useState } from "react";
import AddLiquidity from "./AddLiquidity";
import WithdrawLiquidity from "./WithdrawLiquidity";
import SwapLiquidity from "./SwapLiquidity";
import SlippagePanel from "../SlippagePanel";

export default function ManageAmmBalance({ ammInfo, onChange }) {
  const [activeTab, setActiveTab] = useState("swap");

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

      {/* Panels */}
      {activeTab === "add" && (
        <AddLiquidity ammInfo={ammInfo} onAdded={onChange} />
      )}
      {activeTab === "withdraw" && (
        <WithdrawLiquidity ammInfo={ammInfo} onWithdrawn={onChange} />
      )}
      {activeTab === "swap" && (
        <SwapLiquidity ammInfo={ammInfo} onSwapped={onChange} />
      )}
    </div>
  );
}
