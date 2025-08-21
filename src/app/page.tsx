"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Button from "@/components/Button";
import usePageTitle from "@/utils/usePageTitle";

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Set page title
  usePageTitle("YONA - Your DeFi Platform");

  useEffect(() => {
    if (session) {
      // Check if user needs to complete registration
      if (
        session.user?.needsRegistration ||
        session.user?.username === session.user?.email
      ) {
        router.push("/register");
      } else if (session.user?.username) {
        // User is fully registered, redirect to dashboard
        router.push("/home");
      }
    }
  }, [session, router]);

  return (
    <>
      <div
        className="flex min-h-screen flex-row items-center justify-between bg-cover bg-center"
        style={{
          backgroundImage: "url('/login.jpg')",
        }}
      >
        <div></div>
        <div className="mr-20 mt-20 flex flex-col content-end items-center">
          <h1 className="mb-7 ml-2 text-6xl font-extrabold">YONA</h1>
          <h3 className="mb-7 text-6xl font-semibold">Control the Ledger</h3>
          <h3 className="mb-7 text-6xl font-semibold">Shape the Future.</h3>
          <Button
            variant="login"
            onClick={async () => {
              await signIn("google", { callbackUrl: "/home" });
            }}
            disabled={status === "loading"}
            className="mt-6 px-6 py-3 text-lg font-semibold"
          >
            {status === "loading" ? "Loading..." : "Log in with Google"}
          </Button>
        </div>
      </div>
    </>
  );
}
