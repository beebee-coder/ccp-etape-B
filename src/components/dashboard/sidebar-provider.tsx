"use client";

import { createContext, useContext, useEffect, useState } from "react";

const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
    else if (stored === "false") setCollapsed(false);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", collapsed.toString());
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
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
