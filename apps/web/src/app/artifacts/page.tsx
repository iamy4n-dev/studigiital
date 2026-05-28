"use client";

import { useAuth } from "@clerk/nextjs";
import { ArtifactList } from "@/components/ArtifactList";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function ArtifactsPage() {
  return DEV_MODE ? <ArtifactList getToken={async () => null} /> : <AuthArtifactList />;
}

function AuthArtifactList() {
  const { getToken } = useAuth();
  return <ArtifactList getToken={getToken} />;
}
