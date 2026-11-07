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
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Download,
} from "lucide-react";
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
import { PageHeader } from "@/components/brand/page-header";
import { Greca } from "@/components/brand/greca";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function DashboardPage() {
  const { user } = useAuth();
  const userId = user!.id;
  const qc = useQueryClient();
  const today = nowInSV();
  const [view, setView] = useState({ year: today.getUTCFullYear(), month: today.getUTCMonth() });
  const [justifyFor, setJustifyFor] = useState<string | null>(null);
  const [justifyText, setJustifyText] = useState("");
  const [exporting, setExporting] = useState(false);

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

  const holidaySet = useMemo(() => new Set(holidays.map((h: any) => h.holiday_date)), [holidays]);

  const attendanceMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of attendance) m.set(a.saturday_date as string, a);
    return m;
  }, [attendance]);

  const saturdays = getSaturdaysOfMonth(view.year, view.month);

  // Descarga el historial del año visible como .xlsx (ExcelJS se carga bajo demanda).
  const exportHistory = async () => {
    setExporting(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active, created_at")
        .eq("id", userId)
        .single();
      if (error) throw error;
      const { exportRoverHistory } = await import("@/lib/excel");
      await exportRoverHistory({
        profile,
        attendances: attendance.map((a: any) => ({
          user_id: userId,
          saturday_date: a.saturday_date,
          status: a.status,
          justification: a.justification,
        })),
        holidays: holidays.map((h: any) => h.holiday_date),
        year: view.year,
        today: formatYmd(nowInSV()),
      });
      toast.success(`Historial ${view.year} descargado`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo generar el Excel");
    } finally {
      setExporting(false);
    }
  };

  const prevMonth = () =>
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 },
    );
  const nextMonth = () =>
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 },
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mi espacio rover"
        title="Mi asistencia"
        description={<>Confirma tu asistencia {describeCutoff(settings)} (hora de El Salvador).</>}
        actions={
          <Button
            variant="outline"
            onClick={exportHistory}
            disabled={exporting}
            className="bg-white"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar mi historial {view.year}
          </Button>
        }
      />

      {/* Semestre: tarjeta destacada de marca */}
      <section className="bg-maya-hero overflow-hidden rounded-2xl text-cream shadow-lg">
        <Greca />
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-2">
              Semestre {sem.semester === 1 ? "Ene–Jun" : "Jul–Dic"} {sem.year}
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="bg-gradient-to-br from-gold-2 to-gold bg-clip-text font-display text-6xl font-extrabold leading-none text-transparent">
                {Number(semesterData?.percentage ?? 0).toFixed(1)}%
              </span>
              <span className="pb-1 text-sm text-cream/75">de asistencia</span>
            </div>
            <div
              className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-navy-3/70"
              role="progressbar"
              aria-label="Porcentaje de asistencia del semestre"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Number(semesterData?.percentage ?? 0))}
            >
              <div
                className="bg-earth-gradient h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Number(semesterData?.percentage ?? 0))}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-cream/75">
              {semesterData?.counted ?? 0} de {semesterData?.eligible_saturdays ?? 0} sábados
              elegibles (asistencias + permisos)
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <SummaryStat label="Asistidos" value={semesterData?.attended ?? 0} dot="bg-success" />
            <SummaryStat label="Permisos" value={semesterData?.excused ?? 0} dot="bg-gold" />
            <SummaryStat label="Ausencias" value={semesterData?.missed ?? 0} dot="bg-destructive" />
          </dl>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display text-lg text-navy">
              {MONTHS[view.month]} {view.year}
            </CardTitle>
            <CardDescription>Sábados del mes</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={prevMonth} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={nextMonth} aria-label="Mes siguiente">
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
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
                  canMark && !rec ? "border-gold/60 shadow-sm" : "border-border",
                )}
              >
                <div className="flex items-start gap-4">
                  <DateTile ymd={sat} muted={isHoliday || (!canMark && !rec)} />
                  <div>
                    <div className="font-display font-semibold text-navy">{longDateEs(sat)}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {isHoliday && (
                        <Badge variant="secondary">
                          Feriado:{" "}
                          {(holidays.find((h: any) => h.holiday_date === sat) as any)?.name}
                        </Badge>
                      )}
                      {rec && <StatusBadge status={rec.status} />}
                      {!rec && !isHoliday && canMark && <Badge variant="outline">Pendiente</Badge>}
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
                        {justifyMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
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

function SummaryStat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-xl bg-navy-3/50 px-3 py-3 ring-1 ring-cream/10">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cream/70">
        <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </dt>
      <dd className="mt-1 font-display text-3xl font-bold text-cream">{value}</dd>
    </div>
  );
}

const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "2026-11-14" → "Sábado 14 de noviembre" */
function longDateEs(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `Sábado ${d} de ${MONTHS[m - 1].toLowerCase()}`;
}

function DateTile({ ymd, muted }: { ymd: string; muted?: boolean }) {
  const [, m, d] = ymd.split("-").map(Number);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-display leading-none",
        muted ? "bg-muted text-muted-foreground" : "bg-navy text-cream",
      )}
    >
      <span className="text-xl font-bold">{d}</span>
      <span
        className={cn(
          "mt-0.5 text-[10px] font-bold uppercase tracking-wider",
          !muted && "text-gold-2",
        )}
      >
        {SHORT_MONTHS[m - 1]}
      </span>
    </div>
  );
}
