import { ClerkProvider } from "@clerk/clerk-expo";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { SessionProvider, useSession } from "../src/session";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function AuthGate() {
  const { isLoaded, isSignedIn, isDevMode } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    // TODO(pre-release): Remove isDevMode bypass — see issue #31
    if (isDevMode) return;

    const onPublicScreen = segments[0] === "sign-in" || segments[0] === "onboarding";
    if (!isSignedIn && !onPublicScreen) {
      router.replace("/sign-in");
    } else if (isSignedIn && segments[0] === "sign-in") {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, isDevMode, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SessionProvider>
        <AuthGate />
      </SessionProvider>
    </ClerkProvider>
  );
}
