"use client";

import Link from "next/link";
import Button from "@/components/Button";
import Searchbar from "@/components/Searchbar";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";

const Navbar = () => {
  const { data: session } = useSession();
  const identity = session?.user?.is_admin ? "admin" : "user";

  return (
    <nav className="flex w-full items-center justify-between space-x-5 bg-[#1C2033] p-6">
      <Link
        href={`/${identity}`}
        className="font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-[#F8FFA7]"
      >
        Home
      </Link>
      <Link
        href="/stake"
        className="font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-[#F8FFA7]"
      >
        Stake
      </Link>
      <Link
        href="/earn-yield"
        className="font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-[#F8FFA7]"
      >
        Earn Yield
      </Link>
      <Link
        href="/profile"
        className="font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-[#F8FFA7]"
      >
        Profile
      </Link>
      <Link
        href="/settings"
        className="font-semibold transition duration-200 ease-in-out hover:scale-105 hover:text-[#F8FFA7]"
      >
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
