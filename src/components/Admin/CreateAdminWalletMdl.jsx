"use client";

import React, { useState, useEffect } from "react";
import Button from "../Button";

export default function CreateAdminWalletModal({ onClose, onSubmit, loading }) {
  const [walletType, setWalletType] = useState("ISSUER");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(walletType);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="w-96 rounded-lg bg-[#3F4359] p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">Create Wallet</h2>

        <form onSubmit={handleSubmit}>
          {/* Wallet Type */}
          <div className="mb-4">
            <label className="mb-1 block">Wallet Type</label>
            <select
              value={walletType}
              onChange={(e) => setWalletType(e.target.value)}
              className="w-full rounded border border-[#D4D7E9] p-2"
            >
              <option value="ISSUER">Issuer</option>
              <option value="STANDBY TREASURY">Standby Treasury</option>
              <option value="STANDBY PATHFIND">Standby Pathfind</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="cancel" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Creating..." : "Add Wallet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
