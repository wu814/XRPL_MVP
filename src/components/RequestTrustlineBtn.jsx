"use client";

import React, { useState } from "react";
import Button from "./Button";
import { client, connectXrplClient } from "@/utils/xrpl/testnet";
import * as xrpl from "xrpl";

export default function RequestTrustlineBtn({ classic_address, onTrustlineRequested }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRequestTrustline = async () => {
        setLoading(true);
        setError(null);

        try {
            await connectXrplClient();
            const trustlineResult = await client.requestTrustline(classic_address);
            console.log("Trustline Result:", trustlineResult);
            onTrustlineRequested();
        } catch (err) {
            console.error("Error requesting trustline:", err);
            setError("Failed to request trustline. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Button
                variant="submit"
                onClick={handleRequestTrustline}
                disabled={loading}
            >
                {loading ? "Requesting..." : "Request Trustline"}
            </Button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
    );
}