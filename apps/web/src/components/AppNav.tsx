"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";

type ActivePage = "dashboard" | "capture" | "review" | "history" | "profile";

const NAV_ITEMS: { label: string; href: string; key: ActivePage }[] = [
  { label: "Home", href: "/dashboard", key: "dashboard" },
  { label: "Capture", href: "/capture", key: "capture" },
  { label: "Review", href: "/review", key: "review" },
  { label: "History", href: "/artifacts", key: "history" },
  { label: "Profile", href: "/profile", key: "profile" },
];

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === "true";

export function AppNav({ active }: { active: ActivePage }) {
  return (
    <header style={s.header}>
      <Link href="/dashboard" style={s.logo}>Studigital</Link>
      <nav style={s.nav}>
        {NAV_ITEMS.map(({ label, href, key }) =>
          key === active ? (
            <span key={key} style={{ ...s.navLink, color: "#1a1a1a", fontWeight: 700 }}>{label}</span>
          ) : (
            <Link key={key} href={href} style={s.navLink}>{label}</Link>
          )
        )}
      </nav>
      <div style={s.right}>{!DEV_MODE && <UserButton />}</div>
    </header>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "1rem 1.5rem",
    borderBottom: "1px solid #eee",
    background: "#fff",
  },
  logo: {
    fontWeight: 700,
    fontSize: "1.125rem",
    letterSpacing: "-0.01em",
    textDecoration: "none",
    color: "inherit",
  },
  nav: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "center",
  },
  navLink: {
    fontSize: "0.9375rem",
    color: "#666",
    textDecoration: "none",
    fontWeight: 500,
  },
  right: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
};
