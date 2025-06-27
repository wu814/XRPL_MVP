import { createSupabaseAnonClient } from "@/utils/supabase/server";
import { session } from "@/utils/auth/session";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
        .select("user_id")
        .eq("email_address", profile.email)
        .maybeSingle();
      if (selectErr) {
        console.error("Error checking for user:", selectErr);
        throw selectErr;
      }

      // 2) If not found, insert with username = email
      if (!existing) {
        const { error: insertErr } = await supabase.from("users").insert({
          email_address: profile.email,
          username: profile.email,
        });
        if (insertErr) {
          console.error("Error creating new user:", insertErr);
          throw insertErr;
        }
      }

      return true;
    },
    session,
    async jwt({ token, profile }) {
      if (profile) {
        const supabase = await createSupabaseAnonClient();
        const { data: userData, error } = await supabase
          .from("users")
          .select("user_id, username, role")
          .eq("email_address", profile.email)
          .single();
        if (error || !userData) {
          console.error("Error finding user:", error);
          throw new Error("No user found");
        }
        token.user_id = userData.user_id;
        token.role = userData.role;
        token.username = userData.username;
      }
      return token;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
