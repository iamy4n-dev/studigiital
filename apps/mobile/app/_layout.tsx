import { Slot } from "expo-router";
import { ClerkProvider } from "@clerk/clerk-expo";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <Slot />
    </ClerkProvider>
  );
}
