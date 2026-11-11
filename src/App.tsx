import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuthContext } from "@/hooks/useAuthContext";
import { AccessError } from "@/components/AccessError";
import { FullScreenSpinner } from "@/components/layout/FullScreenSpinner";
import { canAccessRoute, getHomeRoute, LOGIN_ROUTE, type ProtectedRoutePath } from "@/lib/permissions";
import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Estoque = lazy(() => import("./pages/Estoque"));
const NovaEntrada = lazy(() => import("./pages/NovaEntrada"));
const NovaSessao = lazy(() => import("./pages/NovaSessao"));
const EditarSessao = lazy(() => import("./pages/EditarSessao"));
const Historico = lazy(() => import("./pages/Historico"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Membros = lazy(() => import("./pages/Membros"));
const Erros = lazy(() => import("./pages/Erros"));
const Atividades = lazy(() => import("./pages/Atividades"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PROTECTED_PAGES: ReadonlyArray<{ path: ProtectedRoutePath; Page: LazyExoticComponent<ComponentType> }> = [
  { path: "/dashboard", Page: Dashboard },
  { path: "/estoque", Page: Estoque },
  { path: "/estoque/novo", Page: NovaEntrada },
  { path: "/sessao/nova", Page: NovaSessao },
  { path: "/sessao/editar/:id", Page: EditarSessao },
  { path: "/historico", Page: Historico },
  { path: "/relatorios", Page: Relatorios },
  { path: "/membros", Page: Membros },
  { path: "/atividades", Page: Atividades },
  { path: "/erros", Page: Erros },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Libera a rota conforme `ROUTE_ROLES`. Sem sessão vai para o login; papel sem
 * permissão vai para a tela inicial do papel (assistente: /sessao/nova).
 */
function ProtectedRoute({ path, children }: { path: ProtectedRoutePath; children: ReactNode }) {
  const { isAuthenticated, isLoading, userRole } = useAuthContext();

  if (isLoading) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Navigate to={LOGIN_ROUTE} replace />;
  if (!userRole) return <AccessError />;
  if (!canAccessRoute(userRole, path)) return <Navigate to={getHomeRoute(userRole)} replace />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route path={LOGIN_ROUTE} element={<Login />} />
        {PROTECTED_PAGES.map(({ path, Page }) => (
          <Route key={path} path={path} element={<ProtectedRoute path={path}><Page /></ProtectedRoute>} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="assistencia-nsm-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
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
