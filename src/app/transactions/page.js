"use client";

import TransactionHistory from '@/components/TransactionHistory';
import TradePanel from '@/components/Smart/TradePanel';
import { CurrentUserWalletProvider } from '@/components/Wallet/CurrentUserWalletProvider';
import { IssuerWalletProvider } from '@/components/Wallet/IssuerWalletProvider';

export default function TransactionsPage() {
  return (
    <div className="  min-h-screen bg-color1">
      <CurrentUserWalletProvider>
        <IssuerWalletProvider>    
          <TransactionHistory />
          <TradePanel />
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
