export * from "./amm/ammAPITypes";
export * from "./dex/dexAPITypes";
export * from "./friend/friendAPITypes";
export * from "./nft/nftAPITypes";
export * from "./oracle/oracleAPITypes";
export * from "./register/registerAPITypes";
export * from "./smart/smartAPITypes";
export * from "./trustline/trustlineAPITypes";
export * from "./user/userAPITypes";
export * from "./wallet/walletsAPITypes";

export interface APIErrorResponse {
  code?: string;
  message: string;
  details?: any;
};