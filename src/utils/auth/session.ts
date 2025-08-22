import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth/authOptions";


// Simple interface for the session user
export interface SessionUser {
  email?: string | null;
  image?: string | null;
  user_id?: string;
  role?: "USER" | "BUSINESS" | "ADMIN";
  username?: string;
  needsRegistration?: boolean;
}

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user_id?: string;
    role?: "USER" | "BUSINESS" | "ADMIN";
    username?: string;
    needsRegistration?: boolean;
    email?: string;
  }
}

export const session = async ({ session, token }: { session: any; token: any }) => {
  session.user.user_id = token.user_id;
  session.user.role = token.role;
  session.user.username = token.username;
  session.user.needsRegistration = token.needsRegistration;
  return session;
};

export const getUserSession = async () => {
  const authUserSession = await getServerSession(authOptions);
  return authUserSession?.user;
}; 