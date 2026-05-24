import { useOAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function SignInScreen() {
  const router = useRouter();
  const { startOAuthFlow: googleOAuth } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: appleOAuth } = useOAuth({ strategy: "oauth_apple" });

  async function handleGoogle() {
    const { createdSessionId, setActive } = await googleOAuth();
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
      router.replace("/onboarding");
    }
  }

  async function handleApple() {
    const { createdSessionId, setActive } = await appleOAuth();
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
      router.replace("/onboarding");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Studigital</Text>
      <Text style={styles.subtitle}>Capture. Transform. Master.</Text>

      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={handleGoogle}>
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleApple}>
          <Text style={styles.buttonText}>Continue with Apple</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#fff",
  },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 48 },
  buttons: { width: "100%", gap: 12 },
  button: {
    backgroundColor: "#000",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
