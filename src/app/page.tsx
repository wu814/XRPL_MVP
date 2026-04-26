"use client";

import { useEffect, useState } from "react";
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

  const scrollToLearnMore = () => {
    const element = document.getElementById("learn-more-section");
    element?.scrollIntoView({ behavior: "smooth" });
  };

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
          
          {/* Learn More Button */}
          <Button
            variant="primary"
            onClick={scrollToLearnMore}
            className={`mt-4 px-6 py-3 text-lg font-semibold
              transition-all duration-1000 delay-700  
              hover:scale-110 hover:shadow-[0_0_30px_rgba(142,223,226,0.6)]
              active:scale-95 animate-float
              `}
          >
            Learn More
          </Button>
        </div>
      </div>

      {/* Learn More Section */}
      <div
        id="learn-more-section"
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-800 px-8 py-16"
      >
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 max-w-6xl text-center">
          {/* Main heading */}
          <h2 className="mb-8 text-5xl font-bold text-white animate-fade-in-down
            bg-gradient-to-r from-primary via-white to-cancel bg-clip-text text-transparent">
            Welcome to the Future of DeFi
          </h2>
          
          {/* Subheading */}
          <p className="mb-12 text-xl text-gray-300 animate-fade-in-up animation-delay-200">
            Empowers you with cutting-edge decentralized finance tools on the XRP Ledger
          </p>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-lg bg-gray-800/50 p-8 backdrop-blur-sm border border-gray-700/50
              transition-all duration-500 ease-out
              hover:bg-gray-800/70 hover:border-primary/50 hover:scale-105 hover:shadow-[0_0_30px_rgba(142,223,226,0.3)]
              animate-scale-in animation-delay-300">
              <div className="mb-4 text-4xl transform transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12">
                💱
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-white group-hover:text-primary transition-colors">
                Full-Reserve Custody
              </h3>
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                Custodial deposits are always maintained 1:1 with YONA-issued tokens, and can be unlocked at any time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-lg bg-gray-800/50 p-8 backdrop-blur-sm border border-gray-700/50
              transition-all duration-500 ease-out
              hover:bg-gray-800/70 hover:border-primary/50 hover:scale-105 hover:shadow-[0_0_30px_rgba(142,223,226,0.3)]
              animate-scale-in animation-delay-500">
              <div className="mb-4 text-4xl transform transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12">
                🔐
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-white group-hover:text-primary transition-colors">
                Secure Wallets
              </h3>
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                Manage multiple wallets with advanced security features including trustlines and authorization
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-lg bg-gray-800/50 p-8 backdrop-blur-sm border border-gray-700/50
              transition-all duration-500 ease-out
              hover:bg-gray-800/70 hover:border-primary/50 hover:scale-105 hover:shadow-[0_0_30px_rgba(142,223,226,0.3)]
              animate-scale-in animation-delay-700">
              <div className="mb-4 text-4xl transform transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12">
                🎨
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-white group-hover:text-primary transition-colors">
                NFT Marketplace
              </h3>
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                Mint, buy, and sell NFTs on the XRP Ledger with ease and security
              </p>
            </div>
          </div>

          <div className="mt-12">
            <Button
              variant="login"
              onClick={async () => {
                await signIn("google", { callbackUrl: "/home" });
              }}
              disabled={status === "loading"}
              className="px-8 py-4 text-xl font-semibold"
            >
              Get Started Now
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
