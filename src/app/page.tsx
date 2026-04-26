"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Button from "@/components/app/Button";
import usePageTitle from "@/utils/usePageTitle";

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Set page title
  usePageTitle("XRPL - Your DeFi Platform");

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
      {/* Hero Section */}
      <div
        className="relative flex min-h-screen flex-row items-center justify-between overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: "url('/login.jpg')",
        }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 via-transparent to-blue-900/30 animate-pulse"></div>
        
        {/* Floating gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>

        <div></div>
        
        {/* Content - Right side */}
        <div className="relative z-10 mr-20 mt-20 flex flex-col content-end items-center space-y-6">
          {/* XRPL title with glow effect */}
          <h1 
            className={`mb-7 ml-2 text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-cancel
              drop-shadow-[0_0_25px_rgba(142,223,226,0.5)]
              transition-all duration-1000`}
          >
            XRPL
          </h1>
          
          {/* First heading line */}
          <h3 
            className={`mb-7 text-6xl font-semibold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]
              transition-all duration-1000 delay-200`}
          >
            Control the Ledger
          </h3>
          
          {/* Second heading line */}
          <h3 
            className={`mb-7 text-6xl font-semibold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]
              transition-all duration-1000 delay-400`}
          >
            Shape the Future.
          </h3>
          
          {/* Login Button with glow animation */}
          <Button
            variant="login"
            onClick={async () => {
              await signIn("google", { callbackUrl: "/home" });
            }}
            disabled={status === "loading"}
            className={"mt-6 px-8 py-4 text-xl font-semibold"}
          >
            {status === "loading" ? "Loading..." : "Log in with Google"}
          </Button>
        </div>
      </div>
    </>
  );
}
