"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";

export default function CreateUserWalletMdl({ onClose, onSubmit, loading }) {
  const [walletType, setWalletType] = useState("USER");
  const [method, setMethod] = useState("custodial"); // custodial, nonCustodial, or import

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(walletType);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="w-96 rounded-lg bg-[#3F4359] p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold">Create / Import Wallet</h2>

        <form onSubmit={handleSubmit}>
          {/* Wallet Method */}
          <div className="mb-4">
            <label className="mb-1 block">Wallet Type</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded border border-[#8E909D] p-2"
            >
              <option value="custodial">Custodial Wallet</option>
              <option value="import">Import Non-Custodial Wallet</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="cancel" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || method !== "custodial"}
            >
              {loading ? "Creating..." : "Add Wallet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
