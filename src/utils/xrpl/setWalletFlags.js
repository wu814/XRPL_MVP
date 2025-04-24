import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function setWalletFlags(wallet) {
    try {
        await connectXrplClient();
        if (!wallet || !wallet.classicAddress) {
            throw new Error("⚠️ Wallet is missing or has no classicAddress.");
        }
        console.log(`🔹 Setting RequireAuth flag for ${wallet.classicAddress}...`);
        const accountInfo = await client.request({
            command: "account_info",
            account: wallet.classicAddress,
            ledger_index: "validated"
        });
        const sequence = accountInfo.result.account_data.Sequence;
        const latestLedgerSequence = accountInfo.result.ledger_index;
        // Set RequireAuth flag
        const requireAuthTx = {
            TransactionType: "AccountSet",
            Account: wallet.classicAddress,
            SetFlag: 2,
            LastLedgerSequence: latestLedgerSequence + 20,
            Sequence: sequence 
        };
        const preparedAuth = await client.autofill(requireAuthTx);
        const signedAuth = wallet.sign(preparedAuth);
        const resultAuth = await client.submitAndWait(signedAuth.tx_blob)
        if (resultAuth.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ RequireAuth flag set for ${wallet.classicAddress}`);
        } else {
            console.error("❌ Failed to set RequireAuth:", resultAuth.result.meta.TransactionResult);
            return;
        }
        // Set DefaultRipple flag
        console.log(`🔹 Setting DefaultRipple flag for ${wallet.classicAddress}...`);
        const defaultRippleTx = {
            TransactionType: "AccountSet",
            Account: wallet.classicAddress,
            SetFlag: 8,
            LastLedgerSequence: latestLedgerSequence + 40,
            Sequence: sequence + 1
        };
        const preparedRipple = await client.autofill(defaultRippleTx);
        const signedRipple = wallet.sign(preparedRipple);
        const resultRipple = await client.submitAndWait(signedRipple.tx_blob);
        if (resultRipple.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ DefaultRipple flag set for ${wallet.classicAddress}`);
        } else {
            console.error("❌ Failed to set DefaultRipple:", resultRipple.result.meta.TransactionResult);
            return;
        }

        // Set DepositAuth flag (flag 9)
        console.log(`🔹 Setting DepositAuth flag for ${wallet.classicAddress}...`);
        const depositAuthTx = {
            TransactionType: "AccountSet",
            Account: wallet.classicAddress,
            SetFlag: 9,
            LastLedgerSequence: latestLedgerSequence + 60,
            Sequence: sequence + 2
        };
        const preparedDepositAuth = await client.autofill(depositAuthTx);
        const signedDepositAuth = wallet.sign(preparedDepositAuth);
        const resultDepositAuth = await client.submitAndWait(signedDepositAuth.tx_blob);
        if (resultDepositAuth.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ DepositAuth flag set for ${wallet.classicAddress}`);
        } else {
            console.error("❌ Failed to set DepositAuth:", resultDepositAuth.result.meta.TransactionResult);
            return;
        }

        // Set AllowTrustLineClawback flag (flag 16)
        console.log(`🔹 Setting AllowTrustLineClawback flag for ${wallet.classicAddress}...`);
        const clawbackTx = {
            TransactionType: "AccountSet",
            Account: wallet.classicAddress,
            SetFlag: 16,
            LastLedgerSequence: latestLedgerSequence + 80,
            Sequence: sequence + 3
        };
        const preparedClawback = await client.autofill(clawbackTx);
        const signedClawback = wallet.sign(preparedClawback);
        const resultClawback = await client.submitAndWait(signedClawback.tx_blob);
        if (resultClawback.result.meta.TransactionResult === "tesSUCCESS") {
            console.log(`✅ AllowTrustLineClawback flag set for ${wallet.classicAddress}`);
        } else {
            console.error("❌ Failed to set AllowTrustLineClawback:", resultClawback.result.meta.TransactionResult);
        }
      
    } catch (error) {
        console.error("❌ Error setting flags:", error);
    }
}