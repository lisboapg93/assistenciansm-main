import { ReactNode, useCallback, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "assistencia-nsm-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(isCollapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  } catch {
    // Preferência visual: sem armazenamento, vale só nesta página.
  }
}

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((previousValue) => {
      const nextValue = !previousValue;
      persistSidebarCollapsed(nextValue);
      return nextValue;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <main
        className={cn(
          "min-h-screen pt-16 md:pt-0 transition-all duration-300",
          isSidebarCollapsed ? "md:ml-16" : "md:ml-64",
          className
        )}
      >
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
