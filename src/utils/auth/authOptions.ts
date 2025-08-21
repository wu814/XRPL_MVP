import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { session } from "@/utils/auth/session";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) {
        throw new Error("No profile email provided");
      }
      const supabase = await createSupabaseAnonClient();

      // 1) Look up by email
      const { data: existing, error: selectErr } = await supabase
        .from("users")
        .select("user_id, username")
        .eq("email_address", profile.email)
        .maybeSingle();
      if (selectErr) {
        console.error("Error checking for user:", selectErr);
        throw selectErr;
      }

      // 2) If user exists and has a proper username (not email), allow sign in
      if (existing && existing.username !== profile.email) {
        return true;
      }

      // 3) If user doesn't exist or has email as username, they need to register
      // We'll handle the redirect in the redirect callback
      return true;
    },
    session,
    async jwt({ token, profile }): Promise<JWT> {
      if (profile) {
        const supabase = await createSupabaseAnonClient();
        const { data: userData, error } = await supabase
          .from("users")
          .select("user_id, username, role")
          .eq("email_address", profile.email)
          .maybeSingle();
        
        if (error) {
          console.error("Error finding user:", error);
        }

        if (userData) {
          token.user_id = userData.user_id;
          token.role = userData.role;
          token.username = userData.username;
          token.needsRegistration = userData.username === profile.email;
        } else {
          // New user, mark as needing registration
          token.needsRegistration = true;
          token.email = profile.email;
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Get the token to check registration status
      // Note: We can't easily access the token here, so we'll handle this client-side
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
  pages: {
    signIn: "/",
  },
};
