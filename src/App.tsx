import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import NovaEntrada from "./pages/NovaEntrada";
import NovaSessao from "./pages/NovaSessao";
import EditarSessao from "./pages/EditarSessao";
import Historico from "./pages/Historico";
import Relatorios from "./pages/Relatorios";
import Membros from "./pages/Membros";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  children, 
  requiresEditor = false, 
  allowAssistant = false,
  denyAssistant = false 
}: { 
  children: React.ReactNode; 
  requiresEditor?: boolean; 
  allowAssistant?: boolean;
  denyAssistant?: boolean;
}) {
  const { isAuthenticated, isLoading, isEditor, isAssistant } = useAuthContext();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If assistant tries to access denied routes, redirect to their home
  if (isAssistant && denyAssistant) {
    return <Navigate to="/sessao/nova" replace />;
  }

  // If route requires editor and user is not editor (but allow assistant for specific routes)
  if (requiresEditor && !isEditor && !(allowAssistant && isAssistant)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute denyAssistant><Dashboard /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
      <Route path="/estoque/novo" element={<ProtectedRoute requiresEditor><NovaEntrada /></ProtectedRoute>} />
      <Route path="/sessao/nova" element={<ProtectedRoute requiresEditor allowAssistant><NovaSessao /></ProtectedRoute>} />
      <Route path="/sessao/editar/:id" element={<ProtectedRoute requiresEditor><EditarSessao /></ProtectedRoute>} />
      <Route path="/historico" element={<ProtectedRoute denyAssistant><Historico /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute denyAssistant><Relatorios /></ProtectedRoute>} />
      <Route path="/membros" element={<ProtectedRoute requiresEditor><Membros /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="assistencia-nsm-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
