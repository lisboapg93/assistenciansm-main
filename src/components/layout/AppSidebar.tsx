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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, hideForAssistant: true },
  { title: "Sala do Vegetal", path: "/estoque", icon: Droplets },
  { title: "Nova Sessão", path: "/sessao/nova", icon: Calendar, requiresEditor: true, showForAssistant: true },
  { title: "Histórico", path: "/historico", icon: History, hideForAssistant: true },
  { title: "Relatórios", path: "/relatorios", icon: BarChart3, hideForAssistant: true },
  { title: "Membros", path: "/membros", icon: Users, editorOnly: true },
];

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signOut, user, userRole, isEditor, isAssistant } = useAuthContext();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) => {
    // Editor-only items (like Membros) - only show for editors
    if (item.editorOnly) {
      return isEditor;
    }
    // For assistant role, only show items marked for assistant or not hidden
    if (isAssistant) {
      return item.showForAssistant || (!item.hideForAssistant && !item.requiresEditor);
    }
    // For other roles, hide items that require editor unless user is editor
    return !item.requiresEditor || isEditor;
  });

  return (
    <>
      {/* Mobile Toggle */}
      <div className="fixed top-0 left-0 z-50 md:hidden flex items-center h-16 px-4 border-b border-sidebar-border bg-sidebar w-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
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
                <Badge
                  variant={isEditor ? "default" : isAssistant ? "outline" : "secondary"}
                  className="mt-2 text-xs"
                >
                  {isEditor ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Editor
                    </>
                  ) : isAssistant ? (
                    <>
                      <Calendar className="h-3 w-3 mr-1" />
                      Assistente
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Visualizador
                    </>
                  )}
                </Badge>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
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
          <div className="p-4 border-t border-sidebar-border space-y-3">
            {/* Collapse Toggle - Desktop only */}
            <div className="hidden md:block">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label="Recolher ou expandir menu"
              >
                <Menu className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Recolher</span>}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={theme === "light" ? "Ativar modo noite" : "Ativar modo dia"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {!isCollapsed && <span className="ml-2">{theme === "light" ? "Modo noite" : "Modo dia"}</span>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Offset */}
      <div
        className={cn(
          "transition-all duration-300",
          isCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      />
    </>
  );
}
