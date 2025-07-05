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
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg bg-color4 p-6">
        <h2 className="mb-4 text-2xl font-bold">Create AMM</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-mutedText text-sm">Asset A</label>
            <CurrencyDropDown
              value={assetA}
              onChange={setAssetA}
              disabledOptions={[assetB]}
              dropdownBg="bg-color5"
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Amount A</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color5 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={amountA}
              placeholder="0.00"
              onChange={(e) => setAmountA(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Asset B</label>
            <CurrencyDropDown
              value={assetB}
              onChange={setAssetB}
              disabledOptions={[assetA]}
              dropdownBg="bg-color5"
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Amount B</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color5 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={amountB}
              placeholder="0.00"
              onChange={(e) => setAmountB(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Fee (0-1000, integer only)</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color5 w-full rounded-lg border border-transparent p-2 hover:border-primary focus:border-primary focus:outline-none"
              value={fee}
              placeholder="1000 = 1%"
              onChange={(e) => setFee(e.target.value)}
            />
          </div>

          <div className="flex space-x-2 pt-2">
            <Button variant="cancel" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
