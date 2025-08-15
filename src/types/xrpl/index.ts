export * from "./amm/ammXRPLTypes";
export * from "./dex/dexXRPLTypes";
export * from "./nft/nftXRPLTypes";
export * from "./oracle/oracleXRPLTypes";
export * from "./transaction/transactionXRPLTypes";
export * from "./trustline/trustlineXRPLTypes";
export * from "./wallet/walletXRPLTypes";

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
}