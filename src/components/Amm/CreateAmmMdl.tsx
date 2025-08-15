"use client";

import { FormEvent } from "react";
import Button from "../Button";
import CurrencyDropDown from "../currency/CurrencyDropDown";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface CreateAMMMdlProps {
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  currency1: string;
  setCurrency1: (value: string) => void;
  currency2: string;
  setCurrency2: (value: string) => void;
  value1: number;
  setValue1: (value: number) => void;
  value2: number;
  setValue2: (value: number) => void;
  tradingFee: number;
  setTradingFee: (value: number) => void;
}

export default function CreateAMMMdl({
  onClose,
  onSubmit,
  loading,
  currency1,
  setCurrency1,
  currency2,
  setCurrency2,
  value1,
  setValue1,
  value2,
  setValue2,
  tradingFee,
  setTradingFee,
}: CreateAMMMdlProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-lg bg-color3 p-6">
        <h2 className="mb-4 text-2xl font-bold">Create AMM</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-mutedText text-sm">Asset A</label>
            <CurrencyDropDown
              value={currency1}
              onChange={setCurrency1}
              disabledOptions={[currency2]}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Amount A</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color4 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              value={value1 ?? ""}
              placeholder="0.00"
              onChange={(e) => setValue1(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Asset B</label>
            <CurrencyDropDown
              value={currency2}
              onChange={setCurrency2}
              disabledOptions={[currency1]}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Amount B</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color4 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              value={value2 ?? ""}
              placeholder="0.00"
              onChange={(e) => setValue2(e.target.value === "" ? null : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-mutedText text-sm">Fee (0-1000, 1000 = 1%)</label>
            <input
              type="number"
              step="0.000001"
              className="bg-color4 w-full rounded-lg border border-transparent p-2 hover:border-gray-500 focus:border-primary focus:outline-none"
              value={tradingFee ?? ""}
              placeholder="0"
              onChange={(e) => setTradingFee(e.target.value === "" ? null : Number(e.target.value))}
            />  
          </div>

          <div className="flex space-x-2 pt-2">
            <Button variant="cancel" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading} className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Creating...</span>
                </div>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
