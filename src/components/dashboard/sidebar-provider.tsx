"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;
}>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  isMobile: false,
  setIsMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
    else if (stored === "false") setCollapsed(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed.toString());
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);
  const openMobile = () => setMobileOpen(true);
  const closeMobile = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        setCollapsed,
        mobileOpen,
        openMobile,
        closeMobile,
        isMobile,
        setIsMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
