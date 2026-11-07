import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, FileText, Percent, UserCheck } from "lucide-react";
import { formatDateEs, formatShortEs, type CellStatus, type Report } from "@/lib/reports";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLORS = {
  Asistió: "var(--success)",
  Permiso: "var(--warning)",
  "No Asistió": "var(--destructive)",
  "Sin marcar": "var(--muted-foreground)",
} as const;

const CELL_CLASS: Record<CellStatus, string> = {
  Asistió: "bg-success/15 text-success-strong",
  Permiso: "bg-warning/25 text-warning-strong",
  "No Asistió": "bg-destructive/10 text-destructive-strong",
  "Sin marcar": "bg-muted text-muted-foreground",
  "N/A": "text-muted-foreground/40",
};
const CELL_SHORT: Record<CellStatus, string> = {
  Asistió: "A",
  Permiso: "P",
  "No Asistió": "X",
  "Sin marcar": "—",
  "N/A": "·",
};

const RECORDS_PREVIEW = 20;
const PIE_KEYS = ["Asistió", "Permiso", "No Asistió", "Sin marcar"] as const;

/** Cuerpo visual del reporte: KPIs, gráficos, matriz y registros. */
export function ReportBody({ report }: { report: Report }) {
  const [showAll, setShowAll] = useState(false);
  // Datos de gráficos memoizados: si cambian de identidad en cada render,
  // Recharts reinicia la animación (p. ej. al redimensionar la ventana).
  const { totalsByKey, pieData, totalMarks, trendData, ranking } = useMemo(() => {
    const totalsByKey = {
      Asistió: report.totals.attended,
      Permiso: report.totals.excused,
      "No Asistió": report.totals.missed,
      "Sin marcar": report.totals.unmarked,
    };
    const pieData = PIE_KEYS.map((k) => ({ name: k, value: totalsByKey[k] })).filter(
      (d) => d.value > 0,
    );
    return {
      totalsByKey,
      pieData,
      totalMarks: pieData.reduce((n, d) => n + d.value, 0),
      trendData: report.bySaturday.map((s) => ({ ...s, label: formatShortEs(s.date) })),
      ranking: [...report.rows].sort((a, b) => b.percentage - a.percentage),
    };
  }, [report]);
  const visibleRecords = showAll ? report.records : report.records.slice(0, RECORDS_PREVIEW);
  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          icon={Percent}
          label="% promedio del clan"
          value={`${report.kpis.avgPercentage.toFixed(1)}%`}
        />
        <Kpi icon={CalendarCheck} label="Sábados realizados" value={report.kpis.saturdaysHeld} />
        <Kpi
          icon={UserCheck}
          label="Asistentes promedio"
          value={report.kpis.avgAttendeesPerSaturday.toFixed(1)}
          hint={`de ${report.kpis.members} rovers`}
        />
        <Kpi icon={FileText} label="Permisos" value={report.kpis.totalExcused} />
        <Kpi
          icon={AlertTriangle}
          label={`En riesgo (< ${report.riskThreshold}%)`}
          value={report.kpis.atRiskCount}
          tone={report.kpis.atRiskCount ? "danger" : undefined}
        />
      </div>

      {report.saturdays.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay sábados realizados en este período todavía.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tendencia */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencia por sábado</CardTitle>
              <CardDescription>Estado de los rovers elegibles en cada sábado.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
                  <Tooltip
                    labelFormatter={(_, p) =>
                      p?.[0] ? `${formatDateEs(p[0].payload.date)} · ${p[0].payload.rate}%` : ""
                    }
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
                  />
                  <Bar dataKey="attended" name="Asistió" stackId="s" fill={COLORS["Asistió"]} />
                  <Bar dataKey="excused" name="Permiso" stackId="s" fill={COLORS["Permiso"]} />
                  <Bar dataKey="missed" name="No asistió" stackId="s" fill={COLORS["No Asistió"]} />
                  <Bar
                    dataKey="unmarked"
                    name="Sin marcar"
                    stackId="s"
                    fill={COLORS["Sin marcar"]}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ranking */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ranking por rover</CardTitle>
                <CardDescription>
                  % de asistencia (Asistió + Permiso). Línea: umbral de riesgo.
                </CardDescription>
              </CardHeader>
              <CardContent style={{ height: Math.max(220, report.rows.length * 30 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={ranking} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, "Asistencia"]}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <ReferenceLine
                      x={report.riskThreshold}
                      stroke="var(--destructive)"
                      strokeDasharray="4 4"
                    />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                      {ranking.map((r) => (
                        <Cell
                          key={r.userId}
                          fill={r.atRisk ? COLORS["No Asistió"] : "var(--primary)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Distribución</CardTitle>
                <CardDescription>Total de marcas del período.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center">
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="92%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((d) => (
                          <Cell key={d.name} fill={COLORS[d.name]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{totalMarks}</span>
                    <span className="text-xs text-muted-foreground">marcas</span>
                  </div>
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {PIE_KEYS.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: COLORS[k] }}
                      />
                      <span className="text-muted-foreground">{k}</span>
                      <span className="ml-auto font-semibold tabular-nums">
                        {totalMarks ? Math.round((100 * totalsByKey[k]) / totalMarks) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Matriz */}
          <Card>
            <CardHeader>
              <CardTitle>Matriz rover × sábado</CardTitle>
              <CardDescription>
                A = Asistió · P = Permiso · X = No asistió · — = Sin marcar · · = antes del alta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium">
                        Rover
                      </th>
                      {report.saturdays.map((d) => (
                        <th
                          key={d}
                          className="px-1 py-1.5 text-center font-medium text-muted-foreground"
                          title={formatDateEs(d)}
                        >
                          {formatShortEs(d)}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-right font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.userId} className="border-t">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 font-medium">
                          {r.name}
                          {!r.isActive && (
                            <span className="ml-1 text-muted-foreground">(inactivo)</span>
                          )}
                        </td>
                        {report.saturdays.map((d) => {
                          const s = report.matrix[r.userId][d];
                          return (
                            <td key={d} className="p-0.5 text-center">
                              <span
                                title={`${formatDateEs(d)}: ${s === "N/A" ? "antes del alta" : s}`}
                                className={cn(
                                  "inline-flex h-6 w-7 items-center justify-center rounded font-semibold",
                                  CELL_CLASS[s],
                                )}
                              >
                                {CELL_SHORT[s]}
                              </span>
                            </td>
                          );
                        })}
                        <td
                          className={cn(
                            "px-2 py-1 text-right font-semibold",
                            r.atRisk && "text-destructive",
                          )}
                        >
                          {r.percentage.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Registros */}
      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>
            {report.records.length} registros
            {" · más recientes primero · el Excel incluye todos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.records.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin registros para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Sábado</th>
                    <th className="py-2 pr-4 font-medium">Rover</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((r) => (
                    <tr key={`${r.user_id}-${r.saturday_date}`} className="border-t">
                      <td className="whitespace-nowrap py-2 pr-4">
                        {formatDateEs(r.saturday_date)}
                      </td>
                      <td className="py-2 pr-4">{r.name}</td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant="outline"
                          className={cn("border-transparent", CELL_CLASS[r.status])}
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{r.justification ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.records.length > RECORDS_PREVIEW && (
                <div className="mt-3 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                    {showAll
                      ? "Mostrar menos"
                      : `Mostrar todos (${report.records.length - RECORDS_PREVIEW} más)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg",
            tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-navy text-gold",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="mt-2 text-sm text-muted-foreground">{label}</div>
        <div
          className={cn(
            "font-display text-3xl font-bold text-navy",
            tone === "danger" && "text-destructive",
          )}
        >
          {value}
        </div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
