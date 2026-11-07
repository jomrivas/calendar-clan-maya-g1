import { PageHeader } from "@/components/brand/page-header";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  getAdminOverview,
  finalizePastSaturdays,
  setAttendance,
  deleteAttendance,
  updateCutoffSettings,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { DAY_LABELS } from "@/lib/sv-time";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Users,
  Percent,
  XCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminPage });

function AdminPage() {
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const finalizeFn = useServerFn(finalizePastSaturdays);

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuper = role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn({}),
    enabled: isAdmin,
  });

  const finalize = useMutation({
    mutationFn: () => finalizeFn({}),
    onSuccess: (res: any) => {
      toast.success(`Procesado: ${res.inserted} registros de "No Asistió"`);
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const totalUsers = data?.users?.length ?? 0;
  const sem = data?.semester ?? [];
  const avg =
    sem.length > 0
      ? sem.reduce((acc: number, r: any) => acc + Number(r.percentage), 0) / sem.length
      : 0;
  const totalMissed = sem.reduce((acc: number, r: any) => acc + Number(r.missed), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Dashboard administrativo"
        description="Resumen del semestre vigente (zona horaria El Salvador)."
        actions={
          isSuper && (
            <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              {finalize.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Cerrar sábados pasados
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <KpiIcon>
              <Users className="h-5 w-5" />
            </KpiIcon>
            <div className="mt-2 text-sm text-muted-foreground">Usuarios</div>
            <div className="font-display text-3xl font-bold text-navy">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <KpiIcon>
              <Percent className="h-5 w-5" />
            </KpiIcon>
            <div className="mt-2 text-sm text-muted-foreground">% promedio</div>
            <div className="font-display text-3xl font-bold text-navy">{avg.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <KpiIcon tone="danger">
              <XCircle className="h-5 w-5" />
            </KpiIcon>
            <div className="mt-2 text-sm text-muted-foreground">Inasistencias totales</div>
            <div className="font-display text-3xl font-bold text-navy">{totalMissed}</div>
          </CardContent>
        </Card>
      </div>

      {isSuper && <CutoffSettingsCard />}
      {isSuper && <AttendanceEditor users={data?.users ?? []} />}

      <Card>
        <CardHeader>
          <CardTitle>Asistencia por usuario (semestre vigente)</CardTitle>
          <CardDescription>Ordenado por menor porcentaje</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 w-8"></th>
                    <th className="py-2 pr-3">Usuario</th>
                    <th className="py-2 pr-3">Asistió</th>
                    <th className="py-2 pr-3">Permiso</th>
                    <th className="py-2 pr-3">No asistió</th>
                    <th className="py-2 pr-3">Elegibles</th>
                    <th className="py-2 pr-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sem]
                    .sort((a: any, b: any) => Number(a.percentage) - Number(b.percentage))
                    .map((r: any) => (
                      <UserAttendanceRow
                        key={r.user_id}
                        row={r}
                        canEdit={isSuper}
                        attendances={(data?.attendances ?? []).filter(
                          (a: any) => a.user_id === r.user_id,
                        )}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.recent ?? []).map((r: any) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{r.profiles?.full_name || r.profiles?.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.saturday_date}
                    {r.justification ? ` — ${r.justification}` : ""}
                  </div>
                </div>
                <Badge
                  className={
                    r.status === "Asistió"
                      ? "bg-success text-success-foreground"
                      : r.status === "Permiso"
                        ? "bg-warning text-warning-foreground"
                        : "bg-destructive text-destructive-foreground"
                  }
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserAttendanceRow({
  row,
  attendances,
  canEdit,
}: {
  row: any;
  attendances: any[];
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const g: { Asistió: any[]; Permiso: any[]; "No Asistió": any[] } = {
      Asistió: [],
      Permiso: [],
      "No Asistió": [],
    };
    for (const a of attendances) {
      if (g[a.status as keyof typeof g]) g[a.status as keyof typeof g].push(a);
    }
    return g;
  }, [attendances]);

  const pct = Number(row.percentage);

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="py-2 pr-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded p-1 hover:bg-muted"
            aria-label={open ? "Ocultar detalle" : "Ver detalle"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="py-2 pr-3">
          <div className="font-medium">{row.full_name || row.email}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </td>
        <td className="py-2 pr-3">{row.attended}</td>
        <td className="py-2 pr-3">{row.excused}</td>
        <td className="py-2 pr-3">{row.missed}</td>
        <td className="py-2 pr-3">{row.eligible_saturdays}</td>
        <td className="py-2 pr-3">
          <Badge
            className={
              pct >= 80
                ? "bg-success text-success-foreground"
                : pct >= 50
                  ? "bg-warning text-warning-foreground"
                  : "bg-destructive text-destructive-foreground"
            }
          >
            {pct.toFixed(1)}%
          </Badge>
        </td>
      </tr>
      {open && (
        <tr className="border-b last:border-0 bg-muted/30">
          <td></td>
          <td colSpan={6} className="py-3 pr-3">
            <div className="grid gap-4 md:grid-cols-3">
              <DateGroup
                title="Asistió"
                badgeClass="bg-success text-success-foreground"
                items={grouped["Asistió"]}
                canEdit={canEdit}
              />
              <DateGroup
                title="Permiso"
                badgeClass="bg-warning text-warning-foreground"
                items={grouped["Permiso"]}
                showJustification
                canEdit={canEdit}
              />
              <DateGroup
                title="No Asistió"
                badgeClass="bg-destructive text-destructive-foreground"
                items={grouped["No Asistió"]}
                canEdit={canEdit}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DateGroup({
  title,
  badgeClass,
  items,
  showJustification,
  canEdit,
}: {
  title: string;
  badgeClass: string;
  items: any[];
  showJustification?: boolean;
  canEdit?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={badgeClass}>{title}</Badge>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin registros</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((a) => (
            <li
              key={`${a.user_id}-${a.saturday_date}`}
              className="rounded border border-border bg-background p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{a.saturday_date}</span>
                {canEdit && <AttendanceItemActions item={a} />}
              </div>
              {showJustification && a.justification ? (
                <div className="mt-1 text-muted-foreground">{a.justification}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttendanceItemActions({ item }: { item: any }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setAttendance);
  const delFn = useServerFn(deleteAttendance);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string>(item.status);
  const [just, setJust] = useState<string>(item.justification ?? "");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  const save = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          userId: item.user_id,
          saturdayDate: item.saturday_date,
          status: status as any,
          justification: status === "Permiso" ? just : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Asistencia actualizada");
      setEditing(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { userId: item.user_id, saturdayDate: item.saturday_date } }),
    onSuccess: () => {
      toast.success("Registro eliminado");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (editing) {
    return (
      <div className="mt-2 w-full space-y-2">
        <select
          aria-label="Estado de asistencia"
          className="w-full rounded border border-input bg-background p-1 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>Asistió</option>
          <option>Permiso</option>
          <option>No Asistió</option>
        </select>
        {status === "Permiso" && (
          <Textarea
            value={just}
            onChange={(e) => setJust(e.target.value)}
            placeholder="Justificación"
            className="text-xs"
          />
        )}
        <div className="flex gap-1">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label="Editar"
        className="rounded p-1 hover:bg-muted"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Eliminar"
        className="rounded p-1 text-destructive hover:bg-muted"
        disabled={del.isPending}
        onClick={() => {
          if (confirm(`¿Eliminar el registro del ${item.saturday_date}?`)) del.mutate();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AttendanceEditor({ users }: { users: any[] }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setAttendance);
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("Asistió");
  const [just, setJust] = useState("");

  const save = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          userId,
          saturdayDate: date,
          status: status as any,
          justification: status === "Permiso" ? just : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Asistencia guardada");
      setJust("");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isSat = date ? new Date(date + "T12:00:00Z").getUTCDay() === 6 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-4 w-4" /> Registrar o editar asistencia
        </CardTitle>
        <CardDescription>
          Aplica a cualquier usuario, incluido tú, sin importar la hora de cierre.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <select
          aria-label="Usuario"
          className="rounded-md border border-input bg-background p-2 text-sm"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">Selecciona usuario</option>
          {[...users]
            .sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
        </select>
        <Input
          type="date"
          aria-label="Sábado"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          aria-label="Estado de asistencia"
          className="rounded-md border border-input bg-background p-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>Asistió</option>
          <option>Permiso</option>
          <option>No Asistió</option>
        </select>
        <Button
          disabled={!userId || !isSat || save.isPending || (status === "Permiso" && !just.trim())}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
        </Button>
        {status === "Permiso" && (
          <Textarea
            className="md:col-span-4"
            value={just}
            onChange={(e) => setJust(e.target.value)}
            placeholder="Justificación del permiso"
          />
        )}
        {date && !isSat && (
          <p className="text-xs text-destructive md:col-span-4">La fecha debe ser un sábado.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CutoffSettingsCard() {
  const qc = useQueryClient();
  const updFn = useServerFn(updateCutoffSettings);
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings" as any)
        .select("cutoff_day_offset,cutoff_time")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const curDay = day ?? data?.cutoff_day_offset ?? 0;
  const curTime = time ?? String(data?.cutoff_time ?? "15:00").slice(0, 5);

  const save = useMutation({
    mutationFn: () => updFn({ data: { dayOffset: curDay, time: curTime } }),
    onSuccess: () => {
      toast.success("Cierre de confirmación actualizado");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" /> Cierre de confirmación
        </CardTitle>
        <CardDescription>
          Día y hora (El Salvador) hasta la cual los usuarios pueden confirmar o justificar cada
          sábado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Día de cierre"
          className="rounded-md border border-input bg-background p-2 text-sm"
          value={curDay}
          onChange={(e) => setDay(Number(e.target.value))}
        >
          {DAY_LABELS.map((l, i) => (
            <option key={l} value={i}>
              {i === 0 ? "El mismo sábado" : `${l} siguiente`}
            </option>
          ))}
        </select>
        <Input
          type="time"
          aria-label="Hora de cierre"
          className="w-36"
          value={curTime}
          onChange={(e) => setTime(e.target.value)}
        />
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
        </Button>
      </CardContent>
    </Card>
  );
}

function KpiIcon({ children, tone }: { children: React.ReactNode; tone?: "danger" }) {
  return (
    <span
      className={
        tone === "danger"
          ? "inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
          : "inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-gold"
      }
    >
      {children}
    </span>
  );
}
