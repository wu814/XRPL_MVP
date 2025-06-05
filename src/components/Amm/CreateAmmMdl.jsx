"use client";

import React from "react";
import Button from "../Button";
import CurrencyDropDown from "../Currency/CurrencyDropDown";

export default function CreateAmmMdl({
  onClose,
  onSubmit,
  loading,
  assetA,
  setAssetA,
  assetB,
  setAssetB,
  amountA,
  setAmountA,
  amountB,
  setAmountB,
  fee,
  setFee,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/10">
      <div className="w-96 rounded-lg bg-color4 p-6">
        <h2 className="mb-4 text-xl font-bold">Create AMM</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block">Asset A</label>
            <CurrencyDropDown
              value={assetA}
              onChange={setAssetA}
              disabledOptions={[assetB]}
              dropdownBg="bg-color5"
            />
          </div>

          <div>
            <label className="mb-1 block">Amount A</label>
            <input
              type="number"
              className="bg-color6 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={amountA}
              placeholder="Enter amount..."
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block">Asset B</label>
            <CurrencyDropDown
              value={assetB}
              onChange={setAssetB}
              disabledOptions={[assetA]}
              dropdownBg="bg-color6"
            />
          </div>

          <div>
            <label className="mb-1 block">Amount B</label>
            <input
              type="number"
              className="bg-color6 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={amountB}
              placeholder="Enter amount..."
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block">Fee (0-1000)</label>
            <input
              type="number"
              className="bg-color6 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={fee}
              placeholder="1000 = 1%"
              onChange={(e) => setFee(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="cancel" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
