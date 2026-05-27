import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function HomePage() {
  if (devMode) {
    redirect("/dashboard");
  }

  return (
    <>
      <SignedIn>
        <RedirectToDashboard />
      </SignedIn>
      <SignedOut>
        <main style={styles.page}>
          <div style={styles.card}>
            <h1 style={styles.title}>Studigital</h1>
            <p style={styles.tagline}>
              Capture a mistake or insight. Get a flashcard in seconds.
            </p>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button style={styles.cta}>Get started — it&apos;s free</button>
            </SignInButton>
          </div>
        </main>
      </SignedOut>
    </>
  );
}

function RedirectToDashboard(): never {
  redirect("/dashboard");
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  },
  card: {
    maxWidth: 480,
    width: "100%",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  tagline: {
    fontSize: "1.125rem",
    color: "#555",
    maxWidth: 360,
  },
  cta: {
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.875rem 2rem",
    fontSize: "1rem",
    fontWeight: 600,
  },
};
