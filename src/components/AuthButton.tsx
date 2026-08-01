"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Loader2 } from "lucide-react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const [embedded, setEmbedded] = useState(false);

  // Google refuses to load its login inside an embedded iframe, and session
  // cookies are blocked cross-site there. If we're embedded, sign-in opens the
  // app in its own tab where auth works.
  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  const handleSignIn = () => {
    if (embedded) {
      window.open(window.location.href, "_blank", "noopener");
    } else {
      signIn("google");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image && (
          <img
            src={session.user.image}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        )}
        <span className="text-xs text-gray-700 hidden sm:inline">
          {session.user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      title={embedded ? "Opens the app in a new tab to sign in" : "Sign in with Google"}
    >
      <LogIn className="w-3.5 h-3.5" />
      {embedded ? "Sign in (opens app)" : "Sign in with Google"}
    </button>
  );
}
