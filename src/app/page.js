"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Button from "@/components/Button";
import AuthRedirect from "@/components/AuthRedirect";


export default function Login() {
    const { data: session, status } = useSession();
    return (
        <div className="min-h-screen bg-gray-100 items-center justify-center flex flex-col">
            <AuthRedirect />
            <Button
                variant="submit"
                onClick={() => signIn("google")}
                className="mt-6 px-6 py-3 text-lg font-semibold"
            >
                {"Log in with Google"}
            </Button>
        </div>
    );
}
