import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ALLOW_SIGNUP } from "@/lib/flags";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/brand/auth-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  if (!ALLOW_SIGNUP) return <Navigate to="/login" replace />;
  return <SignupForm />;
}

function SignupForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cuenta creada. Revisa tu correo si requiere confirmación.");
    navigate({ to: "/login" });
  };

  return (
    <AuthShell title="Crear cuenta" subtitle="Regístrate para registrar tu asistencia.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nombre completo</Label>
          <Input
            id="full_name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 bg-white"
          />
        </div>
        <Button
          type="submit"
          className="h-11 w-full font-display text-sm font-semibold"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrarme
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-semibold text-purple underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
