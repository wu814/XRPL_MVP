"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Wait until NextAuth finishes loading the session data
    if (status === "loading") return;

    if (session) {
      // Check if the user is an admin
      if (session.user?.is_admin) {
        router.push("/admin"); // Redirect to home/page.js or your designated admin page
      } else {
        router.push("/user"); // Redirect to user/page.js or your designated user page
      }
    }
  }, [session, status, router]);

  // Optionally, you can return a loading indicator or null
  return null;
}
