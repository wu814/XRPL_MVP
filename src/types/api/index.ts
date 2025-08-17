export * from "./ammAPITypes";
export * from "./dexAPITypes";
export * from "./friendAPITypes";
export * from "./nftAPITypes";
export * from "./oracleAPITypes";
export * from "./registerAPITypes";
export * from "./smartAPITypes";
export * from "./trustlineAPITypes";
export * from "./userAPITypes";
export * from "./walletAPITypes";

export interface APIErrorResponse {
  code?: string;
  message: string;
  details?: any;
};