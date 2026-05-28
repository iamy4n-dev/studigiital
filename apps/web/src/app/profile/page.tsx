"use client";

import { useAuth } from "@clerk/nextjs";
import { ProfilePage } from "@/components/ProfilePage";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export default function ProfileRoute() {
  return DEV_MODE ? <ProfilePage getToken={async () => null} /> : <AuthProfile />;
}

function AuthProfile() {
  const { getToken } = useAuth();
  return <ProfilePage getToken={getToken} />;
}
