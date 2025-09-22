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

export type Favorite = {
  id: string | number;
  friend_username: string;
}

export type Friend = {
  id: string | number;
  username: string;
  responded_at: string;
}

export type FriendRequest = {
  id: string | number;
  sender: string;
  receiver: string;
  responded_at: string;
}

export type PendingFriendRequest = {
  id: number;
  sender: string;
  sent_at: string;
}
