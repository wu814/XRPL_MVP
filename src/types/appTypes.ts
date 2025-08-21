export interface YONAWallet {
  classicAddress: string;
  walletType: string;
}

export interface WalletBalance {
  balance: number;
  ownerCount: number;
  totalReserve: number;
  availableBalance: number;
}