"use client";

import { createHmac } from "crypto";
import React, { useState, useEffect, use } from "react";
import ErrorModal from "../ErrorMdl";

class Amm {
  constructor(accountAddress, pair) {
    this.accountAddress = accountAddress;
    this.pair = pair;
  }
}

export default function DisplayAmms() {
  const [amms, setAmms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchAmms = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/amms/getAllAmms");
      const data = await response.json();
      const ammsData = data.data.map(
        (amm) => new Amm(amm.account_address, amm.pair),
      );
      setAmms(ammsData);
    } catch (error) {
      setErrorMessage("Error fetching AMMs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmms();
  }, []);

  return (
    <div className="container mx-auto p-4">
      {loading ? (
        <p className="text-center">Loading AMMs...</p>
      ) : (
        <h1 className="mb-4 text-2xl font-bold">AMM List</h1>
      )}
      {amms.length === 0 && !loading && (
        <p className="text-center">No AMMs found.</p>
      )}
      <div className="flex flex-col rounded-xl bg-[#242639]">
        <div className="flex justify-around border-b border-[#8E909D] px-4 py-2 text-lg font-semibold">
            <h3>Pair</h3>
            <h3></h3>
            <h3></h3>
            <h3>Address</h3>
            <h3>Volume(24hr)</h3>
            <h3>Fee</h3>          
        </div>
        {amms.map((amm, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4"
            onClick={() => onClick(amm)}
          >
            <div className="flex flex-row">
              <p>Pair: {amm.pair}</p>
              <p>Address: {amm.accountAddress}</p>
            </div>
          </div>
        ))}
      </div>

      {errorMessage && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
