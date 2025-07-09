"use client";

import React, { useState } from "react";
import { useSession, update } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import RegistrationForm from "@/components/Register/RegistrationForm";

export default function RegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (!session) {
      // No session, redirect to login
      router.push("/");
      return;
    }
    
    // If user already has a complete profile, redirect to dashboard
    if (session.user?.username) {
      router.push("/home");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-mutedText">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-color1 to-color2 p-4">
      <RegistrationForm />
    </div>
  );
} 