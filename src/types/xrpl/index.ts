export * from "./ammXRPLTypes";
export * from "./dexXRPLTypes";
export * from "./nftXRPLTypes";
export * from "./oracleXRPLTypes";
export * from "./transactionXRPLTypes";
export * from "./trustlineXRPLTypes";
export * from "./walletXRPLTypes";

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
}