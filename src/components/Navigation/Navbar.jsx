"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/components/Button";
import Searchbar from "@/components/Navigation/Searchbar";
import { signOut } from "next-auth/react";

const Navbar = ({ username }) => {
  const pathname = usePathname();

  const linkClass = (paths) =>
    `font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-primary ${
      paths.some((p) => pathname.startsWith(p)) ? "text-primary" : ""
    }`;

  return (
    <nav className="mb-4 flex w-full items-center justify-between space-x-8 bg-color1 p-8 px-10 text-lg">
      <Link href={"/wallet"} className={linkClass(["/wallet"])}>
        Wallet
      </Link>
      <Link href="/trade" className={linkClass(["/trade"])}>
        Trade
      </Link>
      <Link
        href={username ? `/profile/${username}` : "#"}
        className={`${linkClass(["/profile"])} ${!username ? "pointer-events-none" : ""}`}
      >
        Profile
      </Link>

      <Link href="/settings" className={linkClass(["/settings"])}>
        Settings
      </Link>

      <Searchbar />
      <Button variant="cancel" onClick={() => signOut({ callbackUrl: "/" })}>
        Log Out
      </Button>
    </nav>
  );
};

export default Navbar;
