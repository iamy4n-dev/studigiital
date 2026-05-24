import { useAuth, useUser } from "@clerk/clerk-expo";
import React, { createContext, useContext } from "react";

// TODO(pre-release): Remove DEV_MODE — see issue #31 for full pre-release checklist
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

type Tier = "free" | "paid";

interface Session {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  tier: Tier;
  isDevMode: boolean;
}

const SessionContext = createContext<Session>({
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  tier: "free",
  isDevMode: false,
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const session: Session = DEV_MODE
    ? { isLoaded: true, isSignedIn: true, userId: "dev-user", tier: "paid", isDevMode: true }
    : {
        isLoaded,
        isSignedIn: !!isSignedIn,
        userId: user?.id ?? null,
        tier: (user?.publicMetadata?.tier as Tier) ?? "free",
        isDevMode: false,
      };

  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  return useContext(SessionContext);
}
