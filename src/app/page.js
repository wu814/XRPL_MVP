"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Button from "@/components/Button";
import AuthRedirect from "@/components/AuthRedirect";

export default function Login() {
  const { data: session, status } = useSession();
  return (
    <div
      className="flex min-h-screen flex-row items-center justify-between bg-center bg-cover"
      style={{
        backgroundImage: "url('/icons/login.png')",
      }}
    >
      <AuthRedirect />
      <div className="ml-20 mb-15 flex flex-col items-center content-start">
        <h1 className="mb-17 text-4xl font-bold text-[#F8FFA7]">XRPL MVP</h1>
        <h3 className="mb-7 text-7xl font-semibold">Control the Ledger</h3>
        <h3 className="mb-7 text-7xl font-semibold">Shape the Future.</h3>
        <Button
          variant="login"
          onClick={() => signIn("google")}
          disabled={status === "loading"}
          className="mt-6 px-6 py-3 text-lg font-semibold"
        >
          {status === "loading" || status === "authenticated"
            ? "Loading..."
            : "Log in with Google"}
        </Button>
      </div>
      <div>
      </div>
    </div>
  );
}
