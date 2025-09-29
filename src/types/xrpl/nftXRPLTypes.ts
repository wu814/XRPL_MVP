
export interface NFTMintResult {
  success: boolean;
  message?: string;
  nftTokenID?: string;
  transactionHash?: string;
  uri?: string;
  minterWallet?: string;
  errorCode?: string;
}

export interface NFTSellOfferResult {
  success: boolean;
  offerID?: string;
  message?: string;
  errorCode?: string;
}

export interface NFTMintAndListResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface NFTPurchaseResult {
  success: boolean;
  message: string;
  errorCode?: string;
}