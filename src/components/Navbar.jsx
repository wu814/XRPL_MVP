"use client"

import Link from "next/link";

const Navbar = () => {
    return (
        <nav className="flex items-center justify-between p-4 bg-white ">
            <div className="flex space-x-4">
                <Link href="/" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Home</Link>
                <Link href="/swap" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Swap</Link>
                <Link href="/earn-yield" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Earn Yield</Link>
                <Link href="/profile" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Profile</Link>
                <Link href="/settings" className="font-semibold text-gray-700 transition duration-200 ease-in-out hover:scale-105 hover:text-blue-900">Settings</Link>
            </div>
        </nav>
    );
};

export default Navbar;