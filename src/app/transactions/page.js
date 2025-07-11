"use client";

import TransactionHistory from '@/components/Transaction/TransactionHistory';
import TradePanel from '@/components/Smart/TradePanel';
import { CurrentUserWalletProvider } from '@/components/Wallet/CurrentUserWalletProvider';
import { IssuerWalletProvider } from '@/components/Wallet/IssuerWalletProvider';
import usePageTitle from '@/utils/usePageTitle';

export default function TransactionsPage() {
  // Set page title
  usePageTitle("Transactions - YONA");
  
  return (
    <div className="  min-h-screen bg-color1">
      <CurrentUserWalletProvider>
        <IssuerWalletProvider> 
          <div className="p-2">
            <TransactionHistory />
          </div>
          <TradePanel />
        </IssuerWalletProvider>
      </CurrentUserWalletProvider>
    </div>
  );
}
