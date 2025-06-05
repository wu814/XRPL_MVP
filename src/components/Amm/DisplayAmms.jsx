"use client";

// Change this file when there are more than 1 issuer wallet
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ErrorMdl from "../ErrorMdl";
import CurrencyIcon from "../Currency/CurrencyIcon";
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
            const [token1, token2] = amm.pair.split("/");
            return new Amm(amm.amm_address, [token1, token2]);
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
    const [token1, token2] = newAmmData.pair.split("/");
    const newAmm = new Amm(newAmmData.ammAddress, [token1, token2]);
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
      <div className="mb-5 flex items-center justify-between">
        <h1 className="py-6 text-3xl font-bold text-primary">
          Liquidity Pools
        </h1>
        {/* Only show the button if the user is an admin and there are issuer wallet and treasury wallet */}
        {session?.user?.is_admin && (
          <CreateAmmBtn onAmmCreated={handleAmmCreated} />
        )}
      </div>

      {loading ? (
        <div className="flex flex-col rounded-lg bg-color2">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border px-4 py-4 text-lg font-semibold text-white">
            <h3 className="pl-7 text-left">Pair</h3>
            <h3 className="text-center">Address</h3>
            <h3 className="text-center">Volume (24hr)</h3>
            <h3 className="text-center">Fee</h3>
          </div>

          {/* Skeleton Rows */}
          <div className="animate-pulse">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6"
              >
                {/* Pair */}
                <div className="flex gap-2 pl-2">
                  <div className="flex items-center gap-2 rounded-lg bg-color4 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-pulse" />
                    <div className="h-4 w-8 rounded-lg bg-pulse" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-color4 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-pulse" />
                    <div className="h-4 w-8 rounded-lg bg-pulse" />
                  </div>
                </div>
                {/* Address */}
                <div className="mx-auto h-4 w-48 rounded-lg bg-pulse" />
                {/* Volume */}
                <div className="mx-auto h-4 w-24 rounded-lg bg-pulse" />
                {/* Fee */}
                <div className="mx-auto h-4 w-12 rounded-lg bg-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : amms.length === 0 ? (
        <p className="text-center">No AMMs found.</p>
      ) : (
        <div className="flex flex-col rounded-lg bg-color2">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border px-4 py-4 text-lg font-semibold">
            <h3 className="pl-7 text-left">Pair</h3>
            <h3 className="text-center">Address</h3>
            <h3 className="text-center">Volume (24hr)</h3>
            <h3 className="text-center">Fee</h3>
          </div>

          {/* Data rows */}
          {amms.map((amm, index) => (
            <div
              key={index}
              className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-6 hover:bg-color3"
              onClick={() => {
                localStorage.setItem("selectedAMM", JSON.stringify(amm));
                router.push(`/trade/amm/${amm.ammAddress}`);
              }}
            >
              <div className="flex gap-1 pl-2">
                <CurrencyIcon symbol={amm.pair[0]} iconBg="bg-color4" />
                <CurrencyIcon symbol={amm.pair[1]} iconBg="bg-color4" />
              </div>
              <p className="text-center">{amm.ammAddress}</p>
              <p className="text-center">Not Available</p>
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
