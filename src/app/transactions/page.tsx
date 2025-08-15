"use client";

import TransactionHistory from '@/components/transaction/TransactionHistory';
import usePageTitle from '@/utils/usePageTitle';

export default function TransactionsPage() {
  usePageTitle("Transactions - YONA");
  
  return (
    <div className="min-h-screen bg-color1">
      <div className="p-2">
        <TransactionHistory />
      </div>
    </div>
  );
}
