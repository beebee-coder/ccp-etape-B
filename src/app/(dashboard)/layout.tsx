"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

type Role = "admin" | "chef-de-quart" | "chef-de-bloc" | "rondier";

function getStoredRole(): Role {
  if (typeof window === "undefined") return "rondier";
  const stored = window.sessionStorage.getItem("dashboardRole");
  if (
    stored === "admin" ||
    stored === "chef-de-quart" ||
    stored === "chef-de-bloc" ||
    stored === "rondier"
  )
    return stored;
  return "rondier";
}

function deriveRoleFromPath(pathname: string): Role {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/chef-de-quart")) return "chef-de-quart";
  if (pathname.startsWith("/chef-de-bloc")) return "chef-de-bloc";
  if (pathname.startsWith("/rondier")) return "rondier";
  return "rondier";
}

const ROLE_PREFIXES = ["/admin", "/chef-de-quart", "/chef-de-bloc", "/rondier"];

function hasRolePrefix(pathname: string): boolean {
  return ROLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const stored = getStoredRole();
  const hideSidebar = pathname.startsWith("/actions-ia");

  const role: Role = hasRolePrefix(pathname)
    ? deriveRoleFromPath(pathname)
    : stored;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (hasRolePrefix(pathname)) {
      try {
        window.sessionStorage.setItem(
          "dashboardRole",
          deriveRoleFromPath(pathname),
        );
      } catch {}
    }
  }, [pathname]);

  return (
    <ThemeProvider>
      <SidebarProvider>
        <ErrorBoundary>
          <div className="flex h-screen overflow-hidden">
            {!hideSidebar && mounted && <DashboardSidebar role={role} />}
            <main
              className={`flex flex-1 flex-col overflow-hidden ${hideSidebar ? "w-full" : ""}`}
            >
              <DashboardTopNav showBackButton={hideSidebar} />
              <div className="flex-1 overflow-y-auto">{children}</div>
            </main>
          </div>
          <Toaster position="bottom-right" richColors />
        </ErrorBoundary>
      </SidebarProvider>
    </ThemeProvider>
  );
}
