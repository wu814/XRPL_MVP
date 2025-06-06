import { CurrentUserWalletProvider } from "@/components/Wallet/CurrentUserWalletProvider";
import { IssuerWalletProvider } from "@/components/Wallet/IssuerWalletProvider";

export default function UserLayout({ children }) {
  return (
    <CurrentUserWalletProvider>
      <IssuerWalletProvider>{children}</IssuerWalletProvider>
    </CurrentUserWalletProvider>
  );
}
