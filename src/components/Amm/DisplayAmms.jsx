"use client";

// Change this file when there are more than 1 issuer wallet
import React, { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../CurrencyIcon";
import CreateAmmBtn from "./CreateAmmBtn";

class Amm {
  constructor(accountAddress, pair) {
    this.accountAddress = accountAddress;
    this.pair = pair;
  }
}

export default function DisplayAmms() {
  const { data: session, status } = useSession();
  const [amms, setAmms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchAmms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amms/getAllAmms");
      const result = await res.json();
      if (Array.isArray(result.data) && result.data.length > 0) {
        const ammsData = result.data
          .map((amm) => {
            const [tokenA, tokenB] = amm.pair.split("/");
            return new Amm(amm.account_address, [tokenA, tokenB]);
          })
          .sort((a, b) => {
            const tokenA = a.pair.join("/");
            const tokenB = b.pair.join("/");
            return tokenA.localeCompare(tokenB);
          });
        setAmms(ammsData);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAmmCreated = (newAmmData) => {
    const [tokenA, tokenB] = newAmmData.pair.split("/");
    const newAmm = new Amm(newAmmData.accountAddress, [tokenA, tokenB]);
    setAmms((prevAmms) =>
      [...prevAmms, newAmm].sort((a, b) => {
        const tokenA = a.pair.join("/");
        const tokenB = b.pair.join("/");
        return tokenA.localeCompare(tokenB);
      }),
    );
  };

  useEffect(() => {
    fetchAmms();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <div className="mx-6 mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#D8B6FF]">AMM List</h1>
        {/* Only show the button if the user is an admin and there are issuer wallet and treasury wallet */}
        {session?.user?.is_admin && (
          <CreateAmmBtn onAmmCreated={handleAmmCreated} />
        )}
      </div>
      {loading ? (
        <p className="text-center">Loading AMMs...</p>
      ) : amms.length === 0 ? (
        <p className="text-center">No AMMs found.</p>
      ) : (
        <div className="flex flex-col rounded-xl bg-[#242639]">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-[#8E909D] px-4 py-4 text-lg font-semibold">
            <h3 className="pl-7 text-left">Pair</h3>
            <h3 className="text-center">Address</h3>
            <h3 className="text-center">Volume (24hr)</h3>
            <h3 className="text-center">Fee</h3>
          </div>

          {/* Data rows */}
          {amms.map((amm, index) => (
            <div
              key={index}
              className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6 hover:bg-[#2C2E44]"
              onClick={() => onClick(amm)}
            >
              {/* <p className="pl-4 text-left">{amm.pair}</p> */}
              <div className="flex gap-2 pl-2">
                <CurrencyIcon symbol={amm.pair[0]} />
                <CurrencyIcon symbol={amm.pair[1]} />
              </div>
              <p className="text-center">{amm.accountAddress}</p>
              <p className="text-center">$99999.99</p>
              <p className="text-center">0.1%</p>
            </div>
          ))}
        </div>
      )}

      {errorMessage && (
        <ErrorMdl
          errorMessage={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
