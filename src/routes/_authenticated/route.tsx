import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  CalendarOff,
  Loader2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { Greca } from "@/components/brand/greca";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { user, loading, role, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-purple" aria-label="Cargando" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = role === "admin" || role === "super_admin";

  const links = [
    { to: "/dashboard", label: "Mi asistencia", icon: LayoutDashboard },
    ...(isAdmin
      ? [
          { to: "/admin", label: "Dashboard admin", icon: ShieldCheck },
          { to: "/admin/reportes", label: "Reportes", icon: BarChart3 },
          { to: "/admin/users", label: "Usuarios", icon: Users },
          { to: "/admin/holidays", label: "Feriados", icon: CalendarOff },
        ]
      : []),
  ];

  const ROLE_LABEL: Record<string, string> = {
    super_admin: "Super admin",
    admin: "Admin",
    user: "Rover",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="relative flex flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="px-5 py-5">
          <BrandMark inverse />
        </div>
        <Greca />
        <nav
          aria-label="Principal"
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-5"
        >
          {links.map(({ to, label, icon: Icon }) => {
            // "/dashboard" y "/admin" solo con coincidencia exacta (tienen subrutas hermanas en el menú).
            const exact = to === "/dashboard" || to === "/admin";
            const active =
              pathname === to || pathname === `${to}/` || (!exact && pathname.startsWith(`${to}/`));
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-cream/75 hover:bg-sidebar-accent/60 hover:text-cream",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute rounded-full bg-gold transition-opacity",
                    "bottom-0 left-3 right-3 h-[3px] lg:bottom-auto lg:left-0 lg:right-auto lg:top-2 lg:h-[calc(100%-1rem)] lg:w-[3px]",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-gold" : "text-cream/60 group-hover:text-gold-2",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-sidebar-border p-4 lg:block">
          <div className="truncate text-xs text-cream/70" title={user.email ?? ""}>
            {user.email}
          </div>
          <span className="mt-1.5 inline-block rounded-full bg-purple px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">
            {ROLE_LABEL[role ?? "user"]}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-cream/80 transition-colors hover:bg-sidebar-accent hover:text-gold-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
        {/* Móvil: usuario y salir en una fila compacta */}
        <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-2 lg:hidden">
          <span className="truncate text-xs text-cream/70">
            {user.email} · <span className="text-gold-2">{ROLE_LABEL[role ?? "user"]}</span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-cream/80 hover:text-gold-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
