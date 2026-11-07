import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
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
import clanMayaLogo from "@/assets/clan-maya-logo.png";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

function AuthenticatedLayout() {
  const { user, loading, role, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <aside className="border-b border-border bg-sidebar text-sidebar-foreground lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-4">
          <img src={clanMayaLogo} alt="Clan Maya" className="h-8 w-8 object-contain" />
          <span className="font-semibold">Calendar Check Clan Maya</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
          {links.map(({ to, label, icon: Icon }) => {
            // "/dashboard" y "/admin" solo con coincidencia exacta (tienen subrutas hermanas en el menú).
            const exact = to === "/dashboard" || to === "/admin";
            const active =
              pathname === to || pathname === `${to}/` || (!exact && pathname.startsWith(`${to}/`));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-muted-foreground">
            {user.email}
            <div className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-foreground">
              {role ?? "user"}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
