import { client, connectXrplClient } from "./testnet";
import * as xrpl from "xrpl";

export async function getAccountInfo(address) {
    await connectXrplClient();
    if (!address) {
        throw new Error("⚠️ Address is missing.");
    }

    const accountInfo = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "validated"
    });

    if (!accountInfo.result || !accountInfo.result.account_data) {
        throw new Error(`getAccountInfo: account_data not found for ${address}`);
    }

    const accountData = accountInfo.result.account_data;
    const flags = accountData.Flags;
    const enabledFlags = getEnabledFlagsString(flags);

    return {
        address: address,
        sequence: accountData.Sequence,
        balance: xrpl.dropsToXrp(accountData.Balance),
        ownerCount: accountData.OwnerCount,
        enabledFlags: enabledFlags
    };
}


const getEnabledFlagsString = (flags) => {
    const flagMap = {
        0x00010000: "lsfPasswordSpent",
        0x00020000: "lsfRequireDestTag",
        0x00040000: "lsfRequireAuth",
        0x00080000: "lsfDisallowXRP",
        0x00100000: "lsfDisableMaster",
        0x00200000: "lsfNoFreeze",
        0x00400000: "lsfGlobalFreeze",
        0x00800000: "lsfDefaultRipple",
        0x01000000: "lsfDepositAuth",
        0x04000000: "lsfDisallowIncomingNFTokenOffer",
        0x08000000: "lsfDisallowIncomingCheck",
        0x10000000: "lsfDisallowIncomingPayChan",
        0x20000000: "lsfDisallowIncomingTrustline",
        0x80000000: "lsfAllowTrustLineClawback",
    };

    const enabledFlags = [];
    for (const [flagValue, flagName] of Object.entries(flagMap)) {
        if (flags & parseInt(flagValue)) {
            enabledFlags.push(flagName);
        }
    }

    return enabledFlags.join(", ") || "None";
};

export async function getAccountLines(address) {
    await connectXrplClient();
    if (!address) {
        throw new Error("⚠️ Address is missing.");
    }

    const accountLines = await client.request({
        command: "account_lines",
        account: address,
        ledger_index: "validated"
    });

    const lines = accountLines.result.lines;
    return lines;
}