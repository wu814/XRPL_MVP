import { getServerSession } from "next-auth";

export const session = async ({ session, token }) => {
  session.user.user_id = token.user_id;
  session.user.role = token.role;
  session.user.username = token.username;
  return session;
};

export const getUserSession = async () => {
  const authUserSession = await getServerSession({
    callbacks: {
      session,
    },
  });
  return authUserSession?.user;
};
