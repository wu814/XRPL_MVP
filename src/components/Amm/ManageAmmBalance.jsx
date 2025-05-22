// components/ManageAmmBalance.jsx
import { useState } from "react";
import AddLiquidity from "./AddLiquidity";
import WithdrawLiquidity from "./WithdrawLiquidity";

export default function ManageAmmBalance({ ammInfo }) {
  const [activeTab, setActiveTab] = useState("add");

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex gap-4 text-white">
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
      {activeTab === "add" && <AddLiquidity ammInfo={ammInfo} />}
      {activeTab === "withdraw" && <WithdrawLiquidity ammInfo={ammInfo} />}
      {activeTab === "swap" && (
        <div className="text-gray-400">Swap feature coming soon...</div>
      )}
    </div>
  );
}
