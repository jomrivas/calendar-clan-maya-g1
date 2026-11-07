import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getReportData } from "@/lib/reports.functions";
import {
  buildReport,
  DEFAULT_RISK_THRESHOLD,
  formatDateEs,
  periodPresets,
  type AttendanceStatus,
} from "@/lib/reports";
import { formatYmd, todayInSV } from "@/lib/sv-time";
import { Card, CardContent } from "@/components/ui/card";
import { ReportBody } from "@/components/reports/report-body";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/reportes")({ component: ReportsPage });

const ALL = "__all__";
const CUSTOM = "custom";

function ReportsPage() {
  const { role, loading, user } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const today = formatYmd(todayInSV());
  const presets = useMemo(() => periodPresets(today), [today]);

  const [periodKey, setPeriodKey] = useState(presets[0].key);
  const [custom, setCustom] = useState({ from: presets[0].from, to: presets[0].to });
  const [userId, setUserId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const preset = presets.find((p) => p.key === periodKey);
  const range = preset ? { from: preset.from, to: preset.to } : custom;
  const periodLabel = preset?.label ?? `${formatDateEs(custom.from)} – ${formatDateEs(custom.to)}`;
  const validRange = range.from <= range.to;

  const reportFn = useServerFn(getReportData);
  const { data, isLoading, error } = useQuery({
    queryKey: ["report-data", range.from, range.to],
    queryFn: () => reportFn({ data: range }),
    enabled: isAdmin && validRange,
  });

  const report = useMemo(
    () =>
      data
        ? buildReport({
            ...data,
            from: range.from,
            to: range.to,
            today,
            riskThreshold: DEFAULT_RISK_THRESHOLD,
            includeInactive,
            userId: userId === ALL ? null : userId,
            status: status === ALL ? null : (status as AttendanceStatus),
          })
        : null,
    [data, range.from, range.to, today, includeInactive, userId, status],
  );

  const roverOptions = useMemo(
    () =>
      (data?.profiles ?? [])
        .filter((p) => includeInactive || p.is_active)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es")),
    [data, includeInactive],
  );

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const onExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { exportClanReport } = await import("@/lib/excel");
      const filters = [
        userId !== ALL &&
          `Rover: ${roverOptions.find((p) => p.id === userId)?.full_name ?? userId}`,
        status !== ALL && `Estado (Registros): ${status}`,
        includeInactive && "Incluye inactivos",
      ].filter(Boolean) as string[];
      await exportClanReport(report, {
        periodLabel,
        generatedAt: new Date(),
        generatedBy: user?.email ?? "",
        filters,
      });
      toast.success("Reporte descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Métricas de asistencia sabatina · {periodLabel}
          </p>
        </div>
        <Button onClick={onExport} disabled={!report || exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportar a Excel
        </Button>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>Rango personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodKey === CUSTOM ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="from">Desde</Label>
                <Input
                  id="from"
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) =>
                    e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">Hasta</Label>
                <Input
                  id="to"
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) =>
                    e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Rover</Label>
              <RoverSelect value={userId} onChange={setUserId} options={roverOptions} />
            </div>
          )}
          {periodKey === CUSTOM && (
            <div className="space-y-1.5">
              <Label>Rover</Label>
              <RoverSelect value={userId} onChange={setUserId} options={roverOptions} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Estado (registros)</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="Asistió">Asistió</SelectItem>
                <SelectItem value="Permiso">Permiso</SelectItem>
                <SelectItem value="No Asistió">No asistió</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--primary)]"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Incluir rovers inactivos
          </label>
        </CardContent>
      </Card>

      {!validRange && (
        <p className="text-sm text-destructive">La fecha inicial debe ser anterior a la final.</p>
      )}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…
        </div>
      )}

      {report && <ReportBody report={report} />}
    </div>
  );
}

function RoverSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; full_name: string; email: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos los rovers</SelectItem>
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.full_name || p.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
