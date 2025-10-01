import { IssuedCurrencyAmount, LedgerIndex } from "xrpl";
import { YONAWallet } from "./appTypes";
import { FormattedAMMInfo } from "./xrpl/ammXRPLTypes";

export interface APIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// AMM API Types
export type GetFormattedAMMInfoAPIRequest = {
  account: string;
}

export interface CreateAMMAPIRequest {
  treasuryWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  currency1: string;
  value1: number;
  currency2: string;
  value2: number;
  tradingFee: number;
}

export type GetFormattedAMMInfoByCurrenciesAPIRequest = {
  sellCurrency: string;
  buyCurrency: string;
}

export interface AddLiquidityAPIRequest {
  depositType: "twoAsset" | "twoAssetLPToken" | "oneAsset" | "oneAssetLPToken";
  wallet: YONAWallet;
  ammInfo: FormattedAMMInfo;
  addValue1?: string;
  addValue2?: string;
  lpTokenValue?: string;
  selectedCurrency?: string;
}

export interface WithdrawLiquidityAPIRequest {
  mode: "twoAsset" | "lpToken" | "all" | "singleAsset" | "singleAssetAll" | "singleAssetLp";
  withdrawerWallet: YONAWallet;
  ammInfo: FormattedAMMInfo;
  withdrawValue1?: string;
  withdrawValue2?: string;
  singleWithdrawCurrency?: string;
  singleWithdrawValue?: string;
  lpTokenValue?: string;
}

export interface SwapLiquidityAPIRequest {
  senderWallet: YONAWallet;
  sendCurrency: string;
  sendAmount?: string;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string;
} 

// DEX API Types
export type CancelOfferAPIRequest = {
  userWallet: YONAWallet;
  offerSequence: number;
  enteredPassword: string;
}

export interface CreateOfferAPIRequest {
  offerType: "FillOrKill" | "ImmediateOrCancel" | "Passive" | "Sell" | "Standard";
  orderType: "buy" | "sell";
  baseCurrency: string;
  quoteCurrency: string;
  limitPrice: number;
  quantity: number;
  issuerAddress: string;
  offerCreatorWallet: {
    classicAddress: string;
  };
}

export type GetAllOffersAPIRequest = {
  baseCurrency: string;
  baseIssuerAddress?: string;
  quoteCurrency: string;
  quoteIssuerAddress?: string;
}

export type GetCompletedOffersAPIRequest = {
  sourceWallet: YONAWallet;
}

export type GetUserOffersAPIRequest = {
  sourceWallet: YONAWallet;
}





// NFT API Types
export interface BuyNFTAPIRequest {
  offerID: string;
  paymentCurrency: string;
  issuerWalletAddress: string;
  userWallet: YONAWallet
} 

export interface MintAndListNFTAPIRequest {
  userWallet: YONAWallet;
  issuerWalletAddress: string;
  uri: string;
  priceUSD: string | number;
  destination?: string | null;
  taxon?: number;
}


// Smart Trade API Types
export interface SmartTradeAPIRequest {
  senderWallet: YONAWallet;
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}


// Transaction API Types

export interface ClawbackTokenAPIRequest {
  issuerWallet: YONAWallet;
  targetAccountAddress: string;
  currency: string;
  amount: string;
}

export interface GetAccountTransactionsAPIRequest {
  targetAddress: string;
  limit: number;
  marker: string | null;
}

export interface sendCrossCurrencyAPIRequest {
  senderWallet: YONAWallet;
  recipient: string;
  sendCurrency: string;
  sendAmount?: string | number;
  receiveCurrency: string;
  issuerAddress: string;
  slippagePercent?: number;
  destinationTag?: number | null;
  useUsername?: boolean;
  paymentType?: "exact_input" | "exact_output";
  exactOutputAmount?: string | number;
}

export interface sendIOUAPIRequest {
  senderWallet: YONAWallet;
  recipient: string;
  amount: string | number;
  currency: string;
  issuerWallets: YONAWallet[];
  destinationTag?: number | null;
  useUsername?: boolean;
}

export interface sendXRPAPIRequest {
  senderWallet: YONAWallet;
  recipientUsername?: string;
  recipientAddress?: string;
  recipient?: string;
  amount: string | number;
  destinationTag?: number | null;
  useUsername?: boolean;
}


// Trustline API Types
export type CheckTrustlineAPIRequest = {
  walletAddress: string;
  destination: string;
  currency: string;
}

export type SetWalletTrustlineAPIRequest = {
  setterWallet: YONAWallet;
  issuerWallets: YONAWallet[];
  currency: string;
}

export type SetLPTrustlineAPIRequest = {
  setterWallet: YONAWallet;
  lpToken: IssuedCurrencyAmount;
}


// Wallet API Types
export type CreateWalletAPIRequest = {
  walletType: string;
}

export type SetWalletFlagsAPIRequest = {
  wallet: YONAWallet;
}

export type GetAccountInfoAPIRequest = {
  wallet: YONAWallet;
}

export type GetAccountLinesAPIRequest = {
  wallet: YONAWallet;
}

export type GetAccountObjectsAPIRequest = { 
  wallet: YONAWallet;
}

export type AuthorizeDepositRequest = {
  walletWithDepositAuth: YONAWallet;
  authorizedAddress: string;
}

export type DeleteWalletRequest = {
  classicAddress: string;
  enteredPassword: string;
}

export type GetWalletAddressByUsernameRequest = {
  username: string;
}


// Friend API Types
export type AddToFavoriteAPIRequest = {
  friendUsername: string;
}

export type DeleteFriendAPIRequest = {
  id: string;
}

export type RemoveFromFavoriteAPIRequest = {
  friendUsername: string;
}

export type RespondFriendRequestAPIRequest = {
  requestId: string;
  action: "accept" | "reject";
}

export type SendFriendRequestAPIRequest = {
  receiver: string;
}


// User API Types
export type ChangePasswordAPIRequest = {
  currentPassword: string;
  newPassword: string;
}

export type CheckUsernameAPIRequest = {
  username: string;
}

export type CreateUserAPIRequest = {
  username: string;
  password: string;
  email: string;
  role: "USER" | "BUSINESS";
}

// Oracle API Types

export type OracleDeleteAPIRequest = {
  treasuryWallet: YONAWallet;
  oracleDocumentID: number;
}

export type GetLivePricesRequest = {
  account: string;
  oracleDocumentId: number;
  ledgerIndex?: LedgerIndex;
}

export type OracleSetAPIRequest = {
  treasuryWallet: YONAWallet;
  oracleDocumentID: number;
  coinGeckoIDs: string[];
  vsCurrency: string;
}