"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const navItems = [
  { href: "/ai", label: "AI", icon: "ai" },
  { href: "/workout", label: "WORKOUT", icon: "workout" },
  { href: "/week", label: "WEEK", icon: "week" },
  { href: "/progress", label: "PROGRESS", icon: "progress" },
  { href: "/settings", label: "SETTINGS", icon: "settings" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "var(--acc)" : "var(--tx3)";
  const sw = "1.8";
  const size = "22";

  switch (name) {
    case "ai":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      );
    case "workout":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11L12 2" /><path d="M15 11L12 2" /><path d="M4 22L12 13" /><path d="M20 22L12 13" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "week":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "progress":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "settings":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unlocked = ["/ai", "/login", "/register"];
    if (unlocked.includes(pathname) || pathname.startsWith("/api/")) return;

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user && data.user.onboardingStep < 7) {
          router.push("/ai");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return (
    <div className="flex flex-col h-[100dvh] max-w-[480px] mx-auto relative">
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </main>
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] flex justify-around items-center bg-[var(--s1)] border-t border-[var(--brd)] z-50"
        style={{ height: "64px", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3 transition-colors duration-150"
              style={{ color: active ? "var(--acc)" : "var(--tx3)" }}
            >
              <NavIcon name={item.icon} active={active} />
              <span className="text-[10px] font-medium uppercase tracking-[0.5px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
