// Centralized wallet types for the entire application

export interface YONAWallet {
  classicAddress: string;
  walletType: string;
}



export interface WalletApiResponse {
  data?: Array<{
    classic_address: string;
    wallet_type: string;
  }>;
  error?: string;
}

export interface AccountInfoResponse {
  data?: {
    Balance: string;
    OwnerCount?: number;
  };
  error?: string;
}

export interface WalletAddressResponse {
  data?: {
    classic_address: string;
  };
  error?: string;
}

// Context types for providers
export interface CurrentUserWalletContextType {
  currentUserWallets: YONAWallet[];
  loading: boolean;
  errorMessage: string | null;
  fetchCurrentUserWallets: () => Promise<void>;
}

export interface IssuerWalletContextType {
  issuerWallets: YONAWallet[];
  errorMessage: string | null;
  fetchIssuerWallets: () => Promise<void>;
}

// Additional wallet-related types
export interface ReserveItem {
  type: string;
  description: string;
  xrpAmount: number;
  count: number;
  items?: string[];
}

export interface AccountObject {
  LedgerEntryType: string;
  Balance?: {
    currency?: string;
  };
  HighLimit?: {
    issuer?: string;
  };
  LowLimit?: {
    issuer?: string;
  };
  TakerGets?: {
    currency?: string;
  };
  TakerPays?: {
    currency?: string;
  };
  Authorize?: string;
  Destination?: string;
  Account?: string;
}

export interface AccountObjectsResponse {
  data?: {
    account_objects?: AccountObject[];
  };
  error?: string;
}



