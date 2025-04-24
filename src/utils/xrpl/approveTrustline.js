// Change this file when there are more than 1 issuer wallet

import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function approveTrustline(requester_wallet, issuer_wallets, currency) {
    try {
        await connectXrplClient();
        const trustSetTx = {
            TransactionType: "TrustSet",
            Account: issuer_wallets[0].classic_address,
            LimitAmount: {
                currency: currency,
                issuer: requester_wallet.classic_address,
                value: "0",
            },
            Flags: 65536 // tfSetfAuth flag
        };
        const wallet = xrpl.Wallet.fromSeed(issuer_wallets[0].seed); // Issuer wallet
        const preparedTx = await client.autofill(trustSetTx);
        const signedTx = wallet.sign(preparedTx);
        const response = await client.submitAndWait(signedTx.tx_blob);
        if (response.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ Trustline approved from ${issuer_wallets[0].classic_address} to ${requester_wallet.classic_address} for ${currency}.`);
            return {
                requester_classic_address: requester_wallet.classic_address,
                issuer_classic_address: issuer_wallets[0].classic_address,
                currency: currency,
            };
        } else {
            throw new Error(`Trustline approval failed: ${response.result.meta.TransactionResult}`);
        }
    }
    catch (error) {
        console.error("Error approving trustline:", error);
        throw error;
    }
}