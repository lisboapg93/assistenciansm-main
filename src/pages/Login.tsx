import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, LoaderCircle, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/hooks/useAuthContext";
import { logApplicationError } from "@/lib/errorLogging";
import { AccessError } from "@/components/AccessError";
import { getHomeRoute } from "@/lib/permissions";

type LoginErrorCategory =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "offline"
  | "supabase_connection"
  | "supabase_server"
  | "rate_limited"
  | "unknown";

interface LoginErrorFeedback {
  category: LoginErrorCategory;
  message: string;
}

const SERVICE_UNAVAILABLE_MESSAGE = "Não foi possível acessar o serviço no momento. Tente novamente em alguns minutos.";
const NETWORK_ERROR_PATTERNS = ["failed to fetch", "network request failed", "load failed", "name not resolved", "dns"];

function getLoginErrorFeedback(error: Error): LoginErrorFeedback {
  const message = error.message.toLowerCase();
  const { status: rawStatus, code: rawCode } = error as Error & { status?: unknown; code?: unknown };
  const status = typeof rawStatus === "number" ? rawStatus : undefined;
  const code = typeof rawCode === "string" ? rawCode : undefined;

  // A API de autenticação deliberadamente não informa se o e-mail existe.
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return { category: "invalid_credentials", message: "Email ou senha inválidos." };
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return {
      category: "email_not_confirmed",
      message: "Seu e-mail ainda não foi confirmado. Contate o responsável pelo sistema.",
    };
  }

  if (!navigator.onLine) {
    return {
      category: "offline",
      message: "Você está sem conexão com a internet. Reconecte-se e tente novamente.",
    };
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return { category: "supabase_connection", message: SERVICE_UNAVAILABLE_MESSAGE };
  }

  if (status === 429 || code === "over_request_rate_limit" || message.includes("rate limit")) {
    return {
      category: "rate_limited",
      message: "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.",
    };
  }

  if (status !== undefined && status >= 500) {
    return { category: "supabase_server", message: SERVICE_UNAVAILABLE_MESSAGE };
  }

  return {
    category: "unknown",
    message: "Não foi possível entrar. Verifique os dados informados e tente novamente.",
  };
}

// Credenciais inválidas/e-mail não confirmado são tentativas comuns, não falhas
// operacionais; os demais casos ficam registrados para diagnóstico.
const UNLOGGED_CATEGORIES: ReadonlySet<LoginErrorCategory> = new Set(["invalid_credentials", "email_not_confirmed"]);

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, userRole, authError, isLoading: isAuthLoading } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && userRole && !isAuthLoading) {
      navigate(getHomeRoute(userRole), { replace: true });
    }
  }, [isAuthenticated, userRole, isAuthLoading, navigate]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    let error: Error | null;
    try {
      ({ error } = await signIn(email.trim(), password));
    } catch (cause) {
      error = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      setIsSubmitting(false);
    }
    if (!error) return;

    const feedback = getLoginErrorFeedback(error);
    toast.error(feedback.message);
    if (!UNLOGGED_CATEGORIES.has(feedback.category)) {
      void logApplicationError(error, {
        location: "Login.handleLogin",
        operation: "auth",
        entity: "authentication",
        metadata: { category: feedback.category },
      });
    }
  };

  if (isAuthenticated && authError && !isAuthLoading) return <AccessError />;

  // Aguarda a sessão e o perfil, inclusive ao restaurar uma sessão existente.
  if (isSubmitting || isAuthLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium">Carregando</p>
          <p className="text-sm text-muted-foreground">Preparando seu acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20">
              <Droplets className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Assistência NSM</CardTitle>
          <CardDescription>
            Sistema de Gestão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="pt-6">
              <Button type="submit" className="h-12 w-full text-lg font-bold" disabled={isSubmitting}>
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
