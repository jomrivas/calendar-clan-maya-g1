import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ALLOW_SIGNUP } from "@/lib/flags";
import { AuthShell } from "@/components/brand/auth-shell";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bienvenido");
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresá con el correo que te asignó la dirigencia.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-11 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-11 bg-white"
          />
        </div>
        <Button
          type="submit"
          className="h-11 w-full font-display text-sm font-semibold"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>
      {ALLOW_SIGNUP ? (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link
            to="/signup"
            className="font-semibold text-purple underline-offset-4 hover:underline"
          >
            Regístrate
          </Link>
        </p>
      ) : (
        <p className="mt-5 rounded-lg border border-border bg-cream-2/60 px-3 py-2.5 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta? Solicitala a la dirigencia del clan.
        </p>
      )}
    </AuthShell>
  );
}
