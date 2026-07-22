import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("assistencia-nsm-sidebar-collapsed") === "true"
  );

  useEffect(() => {
    const updateSidebarState = () => {
      setIsSidebarCollapsed(localStorage.getItem("assistencia-nsm-sidebar-collapsed") === "true");
    };

    window.addEventListener("assistencia-nsm-sidebar-change", updateSidebarState);
    return () => window.removeEventListener("assistencia-nsm-sidebar-change", updateSidebarState);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
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
