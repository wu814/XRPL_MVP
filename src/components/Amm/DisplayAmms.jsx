"use client";

// Change this file when there are more than 1 issuer wallet
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../CurrencyIcon";
import CreateAmmBtn from "./CreateAmmBtn";

class Amm {
  constructor(ammAddress, pair) {
    this.ammAddress = ammAddress;
    this.pair = pair;
  }
}

export default function DisplayAmms() {
  const router = useRouter(); // Redirect user to the AMM page when they click on an AMM
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
            return new Amm(amm.amm_address, [tokenA, tokenB]);
          })
          .sort((a, b) => {
            const pair1 = a.pair.join("/");
            const pair2 = b.pair.join("/");
            return pair1.localeCompare(pair2);
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
    const newAmm = new Amm(newAmmData.ammAddress, [tokenA, tokenB]);
    console.log("New AMM created:", newAmm);
    setAmms((prevAmms) =>
      [...prevAmms, newAmm].sort((a, b) => {
        const pair1 = a.pair.join("/");
        const pair2 = b.pair.join("/");
        return pair1.localeCompare(pair2);
      }),
    );
  };

  useEffect(() => {
    fetchAmms();
  }, []);

  return (
    <div className="container mx-auto">
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
              onClick={() => router.push(`/pools/${amm.ammAddress}`)}
            >
              <div className="flex gap-1 pl-2">
                <CurrencyIcon symbol={amm.pair[0]} />
                <CurrencyIcon symbol={amm.pair[1]} />
              </div>
              <p className="text-center">{amm.ammAddress}</p>
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
