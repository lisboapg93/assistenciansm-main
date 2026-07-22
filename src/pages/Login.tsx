import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, LoaderCircle, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isAssistant, userRole } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && userRole) {
      const redirectPath = isAssistant ? "/sessao/nova" : "/dashboard";
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, isAssistant, userRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error("Email ou senha inválidos");
      setIsLoading(false);
    } else {
      toast.success("Login realizado com sucesso!");
      // A troca de página acontece após o AuthContext confirmar o papel do usuário.
      // Assim, não exibimos uma tela sem as permissões já carregadas.
    }
  };

  // Exibido somente após o envio do formulário de login.
  if (isLoading) {
    return (
      <div className="h-dvh overflow-hidden flex flex-col items-center justify-center gap-4 bg-background text-center">
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
    <div className="h-dvh overflow-hidden flex items-center justify-center bg-background p-4">
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
              <Button type="submit" className="h-12 w-full text-lg font-bold" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
