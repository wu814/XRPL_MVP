"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Button from "@/components/Button";
import AuthRedirect from "@/components/AuthRedirect";

export default function Login() {
  const { data: session, status } = useSession();
  console.log("Session data:", session);
  console.log("Session status:", status);
  return (
    <div
      className="flex min-h-screen flex-row items-center justify-between bg-cover bg-center"
      style={{
        backgroundImage: "url('/login.jpg')",
      }}
    >
      {status === "authenticated" && <AuthRedirect />}
      <div></div>
      <div className="mr-16 mt-24 flex flex-col content-end items-center">
        <h1 className="mb-14 text-4xl font-bold text-primary">XRPL MVP</h1>
        <h3 className="mb-7 text-6xl font-semibold">Control the Ledger</h3>
        <h3 className="mb-7 text-6xl font-semibold">Shape the Future.</h3>
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
    </div>
  );
}
