import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function requestTrustline(requester_wallet, issuer_wallets, currency) {
    try {
        await connectXrplClient();
        const MAX_TRUST_LIMIT = "1000000000"; // 1 billion of the currency

        // Build the TrustSet transaction with the determined currency.
        const trustSetTx = {
            TransactionType: "TrustSet",
            Account: requester_wallet.classic_address,
            LimitAmount: {
                currency: currency,
                issuer: issuer_wallets[0].classic_address,
                value: MAX_TRUST_LIMIT,
            },
            Flags: 131072, // tfSetNoRipple
        };
        const wallet = xrpl.Wallet.fromSeed(requester_wallet.seed);
        const preparedTx = await client.autofill(trustSetTx);
        const signedTx = wallet.sign(preparedTx);
        const response = await client.submitAndWait(signedTx.tx_blob);
        if (response.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ Trustline request submitted from ${wallet.classicAddress} to ${issuer_wallets[0].classic_address} for ${currency}.`);
            return {
                requester_classic_address: wallet.classicAddress,
                issuer_classic_address: issuer_wallets[0].classic_address,
                currency: currency,
                limit_amount: MAX_TRUST_LIMIT,
                is_authorized: false,
                is_activated: false,
                created_at: new Date().toISOString(),
            };
        } else {
            throw new Error(`Trustline request failed: ${response.result.meta.TransactionResult}`);
        }
    }
    catch (error) {
        console.error("Error requesting trustline:", error);
        throw new Error(error.message || "Failed to request trustline");
    }
}