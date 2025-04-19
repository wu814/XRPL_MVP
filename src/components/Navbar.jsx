"use client"

import Link from "next/link";
import Button from "@/components/Button";
import Searchbar from "@/components/Searchbar";

import { signOut } from "next-auth/react";

const Navbar = () => {
    return (
        <nav className="flex w-full items-center justify-between p-4 bg-white space-x-5 shadow-md">
            <Link href="/" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Home</Link>
            <Link href="/swap" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Swap</Link>
            <Link href="/earn-yield" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Earn Yield</Link>
            <Link href="/profile" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Profile</Link>
            <Link href="/settings" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Settings</Link>
            <Searchbar />
            <Button
                variant="cancel"
                onClick={() => signOut({ callbackUrl: "/" })}
            >
                Log Out
            </Button>
        </nav>
    );
};

export default Navbar;