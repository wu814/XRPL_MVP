"use client";

import TransactionHistory from '@/components/Transaction/TransactionHistory';

import usePageTitle from '@/utils/usePageTitle';

export default function TransactionsPage() {
  // Set page title
  usePageTitle("Transactions - YONA");
  
  return (
    <div className="  min-h-screen bg-color1">
      <div className="p-2">
        <TransactionHistory />
      </div>
    </div>
  );
}
