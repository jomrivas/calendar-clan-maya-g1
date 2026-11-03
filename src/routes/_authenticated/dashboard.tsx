import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markAttendance, submitJustification } from "@/lib/attendance.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatYmd,
  getSaturdaysOfMonth,
  cutoffUtc,
  describeCutoff,
  currentSemester,
  nowInSV,
} from "@/lib/sv-time";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function DashboardPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();
  const today = nowInSV();
  const [view, setView] = useState({ year: today.getUTCFullYear(), month: today.getUTCMonth() });
  const [justifyFor, setJustifyFor] = useState<string | null>(null);
  const [justifyText, setJustifyText] = useState("");

  const sem = currentSemester();

  const { data: holidays = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays_sv").select("holiday_date,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance", userId, view.year],
    queryFn: async () => {
      const start = `${view.year}-01-01`;
      const end = `${view.year}-12-31`;
      const { data, error } = await supabase
        .from("attendances")
        .select("saturday_date,status,justification,marked_at")
        .eq("user_id", userId)
        .gte("saturday_date", start)
        .lte("saturday_date", end);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: semesterData } = useQuery({
    queryKey: ["my-semester", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("semester_attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("year", sem.year)
        .eq("semester", sem.semester)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
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

  const markFn = useServerFn(markAttendance);
  const justifyFn = useServerFn(submitJustification);

  const markMut = useMutation({
    mutationFn: (saturdayDate: string) => markFn({ data: { saturdayDate } }),
    onSuccess: () => {
      toast.success("Asistencia registrada");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["my-semester"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al registrar"),
  });

  const justifyMut = useMutation({
    mutationFn: (vars: { saturdayDate: string; justification: string }) =>
      justifyFn({ data: vars }),
    onSuccess: () => {
      toast.success("Justificación enviada");
      setJustifyFor(null);
      setJustifyText("");
      qc.invalidateQueries({ queryKey: ["my-attendance"] });
      qc.invalidateQueries({ queryKey: ["my-semester"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al enviar"),
  });

  const holidaySet = useMemo(
    () => new Set(holidays.map((h: any) => h.holiday_date)),
    [holidays],
  );

  const attendanceMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attendance) m.set(a.saturday_date as string, a);
    return m;
  }, [attendance]);

  const saturdays = getSaturdaysOfMonth(view.year, view.month);

  const prevMonth = () =>
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }));
  const nextMonth = () =>
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Mi asistencia</h1>
        <p className="text-sm text-muted-foreground">
          Confirma tu asistencia {describeCutoff(settings)} (hora de El Salvador).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Asistidos"
          value={semesterData?.attended ?? 0}
          color="success"
        />
        <SummaryCard
          label="Permisos"
          value={semesterData?.excused ?? 0}
          color="warning"
        />
        <SummaryCard
          label="No asistidos"
          value={semesterData?.missed ?? 0}
          color="destructive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Porcentaje semestre {sem.semester === 1 ? "Ene-Jun" : "Jul-Dic"} {sem.year}</CardTitle>
          <CardDescription>
            {semesterData?.counted ?? 0} de {semesterData?.eligible_saturdays ?? 0} sábados elegibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold text-primary">
              {Number(semesterData?.percentage ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Number(semesterData?.percentage ?? 0))}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>
              {MONTHS[view.month]} {view.year}
            </CardTitle>
            <CardDescription>Sábados del mes</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {saturdays.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay sábados este mes.</p>
          )}
          {saturdays.map((sat) => {
            const isHoliday = holidaySet.has(sat);
            const rec = attendanceMap.get(sat);
            const canMark = Date.now() < cutoffUtc(sat, settings).getTime() && !isHoliday;
            const isJustifying = justifyFor === sat;
            return (
              <div
                key={sat}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{sat}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {isHoliday && (
                      <Badge variant="secondary">
                        Feriado: {(holidays.find((h: any) => h.holiday_date === sat) as any)?.name}
                      </Badge>
                    )}
                    {rec && <StatusBadge status={rec.status} />}
                    {!rec && !isHoliday && canMark && (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                    {!rec && !isHoliday && !canMark && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        Cierre pasado
                      </Badge>
                    )}
                  </div>
                  {rec?.justification && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Justificación: {rec.justification}
                    </p>
                  )}
                </div>

                {!isHoliday && canMark && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => markMut.mutate(sat)}
                      disabled={markMut.isPending}
                    >
                      {markMut.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                      )}
                      {rec?.status === "Asistió" ? "Confirmado" : "Confirmar asistencia"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setJustifyFor(isJustifying ? null : sat);
                        setJustifyText(rec?.justification ?? "");
                      }}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      Justificar
                    </Button>
                  </div>
                )}

                {isJustifying && (
                  <div className="w-full sm:w-full">
                    <Textarea
                      placeholder="Motivo de la inasistencia (mínimo 5 caracteres)"
                      value={justifyText}
                      onChange={(e) => setJustifyText(e.target.value)}
                      rows={3}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          justifyMut.mutate({ saturdayDate: sat, justification: justifyText })
                        }
                        disabled={justifyMut.isPending || justifyText.trim().length < 5}
                      >
                        {justifyMut.isPending && (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        )}
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setJustifyFor(null);
                          setJustifyText("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Asistió")
    return (
      <Badge className="bg-success text-success-foreground hover:bg-success/90">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Asistió
      </Badge>
    );
  if (status === "Permiso")
    return (
      <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
        <FileText className="mr-1 h-3 w-3" /> Permiso
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 h-3 w-3" /> No asistió
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "success" | "warning" | "destructive";
}) {
  const colorClass = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[color];
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-3xl font-bold", colorClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}
