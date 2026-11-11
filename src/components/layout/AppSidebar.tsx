import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Droplets,
  Calendar,
  History,
  BarChart3,
  Menu,
  X,
  Leaf,
  LogOut,
  Shield,
  Eye,
  Moon,
  Sun,
  Users,
  ShieldAlert,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { canAccessRoute, LOGIN_ROUTE, type AppRole, type ProtectedRoutePath } from "@/lib/permissions";

interface NavItem {
  title: string;
  path: ProtectedRoutePath;
  icon: LucideIcon;
}

// A visibilidade de cada item vem de ROUTE_ROLES, a mesma regra do ProtectedRoute.
const NAV_ITEMS: readonly NavItem[] = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Sala do Vegetal", path: "/estoque", icon: Droplets },
  { title: "Nova Sessão", path: "/sessao/nova", icon: Calendar },
  { title: "Histórico", path: "/historico", icon: History },
  { title: "Relatórios", path: "/relatorios", icon: BarChart3 },
  { title: "Membros", path: "/membros", icon: Users },
  { title: "Atividades", path: "/atividades", icon: ClipboardList },
  { title: "Erros", path: "/erros", icon: ShieldAlert },
];

const ROLE_BADGES: Record<AppRole, { label: string; icon: LucideIcon; variant: BadgeProps["variant"] }> = {
  editor: { label: "Editor", icon: Shield, variant: "default" },
  assistant: { label: "Assistente", icon: Calendar, variant: "outline" },
  viewer: { label: "Visualizador", icon: Eye, variant: "secondary" },
};

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppSidebar({ isCollapsed, onToggleCollapsed }: AppSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signOut, user, userRole } = useAuthContext();
  const isLightTheme = theme === "light";
  const roleBadge = userRole ? ROLE_BADGES[userRole] : null;
  const visibleNavItems = NAV_ITEMS.filter((item) => canAccessRoute(userRole, item.path));

  const handleLogout = async () => {
    await signOut();
    navigate(LOGIN_ROUTE);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <div className="fixed top-0 left-0 z-50 md:hidden flex items-center h-16 px-4 border-b border-sidebar-border bg-sidebar w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen((isOpen) => !isOpen)}
          aria-label={isMobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          aria-hidden="true"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] bg-sidebar border-r border-sidebar-border transition-all duration-300",
          "md:top-0 md:h-screen",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="min-h-16 px-4 py-3 border-b border-sidebar-border">
            <div className="flex h-10 translate-y-1 items-center justify-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                <Leaf className="h-5 w-5" />
              </div>
              {!isCollapsed && <h1 className="text-lg font-extrabold leading-tight text-foreground">Assistência NSM</h1>}
            </div>
            {!isCollapsed && user && (
              <div className="translate-x-7 text-center animate-fade-in">
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                {roleBadge && (
                  <Badge variant={roleBadge.variant} className="mt-2 text-xs">
                    <roleBadge.icon className="h-3 w-3 mr-1" />
                    {roleBadge.label}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="min-h-0 flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-label={item.title}
                  title={isCollapsed ? item.title : undefined}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
                  {!isCollapsed && (
                    <span className="animate-fade-in truncate">{item.title}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className={cn("border-t border-sidebar-border space-y-3", isCollapsed ? "p-2" : "p-4")}>
            {/* Collapse Toggle - Desktop only */}
            <div className="hidden md:block">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground",
                  isCollapsed ? "mx-auto w-10 justify-center" : "w-full justify-start"
                )}
                onClick={onToggleCollapsed}
                aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
                aria-expanded={!isCollapsed}
              >
                <Menu className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Recolher</span>}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "text-muted-foreground",
                isCollapsed ? "mx-auto w-10 justify-center" : "w-full justify-start"
              )}
              onClick={() => setTheme(isLightTheme ? "dark" : "light")}
              aria-label={isLightTheme ? "Ativar modo noite" : "Ativar modo dia"}
            >
              {isLightTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {!isCollapsed && <span className="ml-2">{isLightTheme ? "Modo noite" : "Modo dia"}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "text-muted-foreground hover:text-destructive",
                isCollapsed ? "mx-auto w-10 justify-center" : "w-full justify-start"
              )}
              onClick={handleLogout}
              aria-label="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
