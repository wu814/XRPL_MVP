import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function createWallet(walletType, walletName) {
    try {
        await connectXrplClient();

        const fund_result = await client.fundWallet();
        const wallet = fund_result.wallet;

        const accountInfo = await client.request({
            command: "account_info",
            account: wallet.address,
            ledger_index: "validated",
        });

        return {
            classic_address: wallet.address,
            wallet_type: walletType,
            wallet_name: walletName,
            seed: wallet.seed,
            xrp_balance: xrpl.dropsToXrp(accountInfo.result.account_data.Balance),
            last_sequence: accountInfo.result.account_data.Sequence,
            created_at: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(error.message || "Failed to create XRPL wallet");
    }
}
