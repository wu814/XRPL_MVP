import { getServerSession } from 'next-auth';

export const session = async ({ session, token }) => {
  session.user.id = token.id;
  session.user.is_admin = token.is_admin;
  session.user.username = token.username;
  return session;
};

export const getUserSession = async () => {
  const authUserSession = await getServerSession({
    callbacks: {
      session,
    },
  });
  // If you want to throw an error when there's no session, you can uncomment the next line.
  // if (!authUserSession) throw new Error('unauthorized');
  return authUserSession?.user;
};
