import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Lightweight sign-in: identity only, via a signed JWT cookie — no database.
// Requires AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET in the environment.
// trustHost lets it work behind Vercel's proxy / a custom domain.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
