"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AdminSidebarContextValue = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
};

const AdminSidebarContext = createContext<AdminSidebarContextValue | undefined>(undefined);

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return <AdminSidebarContext.Provider value={{
    isCollapsed,
    isMobileOpen,
    toggleCollapsed: () => setIsCollapsed((current) => !current),
    openMobile: () => setIsMobileOpen(true),
    closeMobile: () => setIsMobileOpen(false),
    toggleMobile: () => setIsMobileOpen((current) => !current),
  }}>{children}</AdminSidebarContext.Provider>;
}

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);
  if (!context) throw new Error("useAdminSidebar must be used inside AdminSidebarProvider");
  return context;
}
