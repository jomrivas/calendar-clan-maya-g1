// Núcleo de reportes de asistencia (funciones puras, sin I/O).
// Mismas reglas que la vista `semester_attendance`:
//   - Solo sábados, sin feriados, hasta hoy (hora SV).
//   - Cada rover cuenta desde su fecha de alta (created_at en hora SV).
//   - % = (Asistió + Permiso) / sábados elegibles.

export type AttendanceStatus = "Asistió" | "No Asistió" | "Permiso";

export type ReportProfile = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type ReportAttendance = {
  user_id: string;
  saturday_date: string;
  status: AttendanceStatus;
  justification: string | null;
};

/** Estado de una celda de la matriz: registrado, sin marcar o no aplica (antes del alta). */
export type CellStatus = AttendanceStatus | "Sin marcar" | "N/A";

export type RoverRow = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  joined: string;
  eligible: number;
  attended: number;
  excused: number;
  missed: number;
  unmarked: number;
  percentage: number;
  atRisk: boolean;
};

export type SaturdayRow = {
  date: string;
  members: number;
  attended: number;
  excused: number;
  missed: number;
  unmarked: number;
  /** (Asistió + Permiso) / miembros elegibles ese sábado */
  rate: number;
};

export type ReportRecord = ReportAttendance & { name: string; email: string };

export type Report = {
  from: string;
  to: string;
  saturdays: string[];
  rows: RoverRow[];
  bySaturday: SaturdayRow[];
  totals: { attended: number; excused: number; missed: number; unmarked: number };
  kpis: {
    members: number;
    saturdaysHeld: number;
    avgPercentage: number;
    avgAttendeesPerSaturday: number;
    totalExcused: number;
    atRiskCount: number;
  };
  matrix: Record<string, Record<string, CellStatus>>;
  records: ReportRecord[];
  riskThreshold: number;
};

export type BuildReportInput = {
  profiles: ReportProfile[];
  attendances: ReportAttendance[];
  holidays: string[];
  from: string;
  to: string;
  /** Fecha de hoy en SV (YYYY-MM-DD). Los sábados posteriores no cuentan. */
  today: string;
  riskThreshold?: number;
  includeInactive?: boolean;
  userId?: string | null;
  status?: AttendanceStatus | null;
};

export const DEFAULT_RISK_THRESHOLD = 75;
const SV_OFFSET_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Fecha (YYYY-MM-DD) en hora SV de un timestamp ISO. */
export function svDateOf(iso: string): string {
  return toYmd(new Date(new Date(iso).getTime() - SV_OFFSET_MS));
}

/** Sábados en [from, to] (inclusive). */
export function saturdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = parseYmd(from);
  const end = parseYmd(to);
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
  while (d <= end) {
    out.push(toYmd(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** Sábados elegibles: en rango, hasta hoy, sin feriados. */
export function eligibleSaturdays(
  from: string,
  to: string,
  today: string,
  holidays: Iterable<string>,
): string[] {
  const end = to < today ? to : today;
  if (end < from) return [];
  const h = new Set(holidays);
  return saturdaysBetween(from, end).filter((s) => !h.has(s));
}

export type PeriodPreset = { key: string; label: string; from: string; to: string };

/** Períodos predefinidos relativos a `today` (YYYY-MM-DD, hora SV). */
export function periodPresets(today: string): PeriodPreset[] {
  const y = Number(today.slice(0, 4));
  const s1 = Number(today.slice(5, 7)) <= 6;
  const sem = (year: number, first: boolean) => ({
    from: `${year}-${first ? "01-01" : "07-01"}`,
    to: `${year}-${first ? "06-30" : "12-31"}`,
    label: `${first ? "Ene–Jun" : "Jul–Dic"} ${year}`,
  });
  const cur = sem(y, s1);
  const prev = s1 ? sem(y - 1, false) : sem(y, true);
  return [
    { key: "semestre-actual", ...cur, label: `Semestre actual (${cur.label})` },
    { key: "semestre-anterior", ...prev, label: `Semestre anterior (${prev.label})` },
    { key: "anio-actual", label: `Año ${y}`, from: `${y}-01-01`, to: `${y}-12-31` },
    { key: "anio-anterior", label: `Año ${y - 1}`, from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------
export function buildReport(input: BuildReportInput): Report {
  const riskThreshold = input.riskThreshold ?? DEFAULT_RISK_THRESHOLD;
  const saturdays = eligibleSaturdays(input.from, input.to, input.today, input.holidays);
  const satSet = new Set(saturdays);

  const profiles = input.profiles
    .filter((p) => input.includeInactive || p.is_active)
    .filter((p) => !input.userId || p.id === input.userId)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // user -> date -> attendance (solo sábados elegibles del período)
  const byUser = new Map<string, Map<string, ReportAttendance>>();
  for (const a of input.attendances) {
    if (!profileById.has(a.user_id) || !satSet.has(a.saturday_date)) continue;
    let m = byUser.get(a.user_id);
    if (!m) byUser.set(a.user_id, (m = new Map()));
    m.set(a.saturday_date, a);
  }

  const matrix: Report["matrix"] = {};
  const satAgg = new Map<string, SaturdayRow>(
    saturdays.map((d) => [
      d,
      { date: d, members: 0, attended: 0, excused: 0, missed: 0, unmarked: 0, rate: 0 },
    ]),
  );

  const rows: RoverRow[] = profiles.map((p) => {
    const joined = svDateOf(p.created_at);
    const marks = byUser.get(p.id) ?? new Map<string, ReportAttendance>();
    const row: RoverRow = {
      userId: p.id,
      name: p.full_name || p.email,
      email: p.email,
      isActive: p.is_active,
      joined,
      eligible: 0,
      attended: 0,
      excused: 0,
      missed: 0,
      unmarked: 0,
      percentage: 0,
      atRisk: false,
    };
    const cells: Record<string, CellStatus> = {};
    for (const d of saturdays) {
      if (d < joined) {
        cells[d] = "N/A";
        continue;
      }
      const agg = satAgg.get(d)!;
      row.eligible++;
      agg.members++;
      const st = marks.get(d)?.status;
      const key =
        st === "Asistió"
          ? "attended"
          : st === "Permiso"
            ? "excused"
            : st === "No Asistió"
              ? "missed"
              : "unmarked";
      row[key]++;
      agg[key]++;
      cells[d] = st ?? "Sin marcar";
    }
    matrix[p.id] = cells;
    row.percentage = row.eligible ? round2((100 * (row.attended + row.excused)) / row.eligible) : 0;
    row.atRisk = row.eligible > 0 && row.percentage < riskThreshold;
    return row;
  });

  const bySaturday = saturdays.map((d) => {
    const r = satAgg.get(d)!;
    r.rate = r.members ? round2((100 * (r.attended + r.excused)) / r.members) : 0;
    return r;
  });

  const totals = rows.reduce(
    (t, r) => ({
      attended: t.attended + r.attended,
      excused: t.excused + r.excused,
      missed: t.missed + r.missed,
      unmarked: t.unmarked + r.unmarked,
    }),
    { attended: 0, excused: 0, missed: 0, unmarked: 0 },
  );

  const counted = rows.filter((r) => r.eligible > 0);
  const kpis: Report["kpis"] = {
    members: rows.length,
    saturdaysHeld: saturdays.length,
    avgPercentage: counted.length
      ? round2(counted.reduce((s, r) => s + r.percentage, 0) / counted.length)
      : 0,
    avgAttendeesPerSaturday: saturdays.length ? round2(totals.attended / saturdays.length) : 0,
    totalExcused: totals.excused,
    atRiskCount: rows.filter((r) => r.atRisk).length,
  };

  const records: ReportRecord[] = input.attendances
    .filter(
      (a) =>
        profileById.has(a.user_id) && a.saturday_date >= input.from && a.saturday_date <= input.to,
    )
    .filter((a) => !input.status || a.status === input.status)
    .map((a) => {
      const p = profileById.get(a.user_id)!;
      return { ...a, name: p.full_name || p.email, email: p.email };
    })
    .sort(
      (a, b) =>
        b.saturday_date.localeCompare(a.saturday_date) || a.name.localeCompare(b.name, "es"),
    );

  return {
    from: input.from,
    to: input.to,
    saturdays,
    rows,
    bySaturday,
    totals,
    kpis,
    matrix,
    records,
    riskThreshold,
  };
}

/** "2027-01-09" → "09/01/2027" */
export function formatDateEs(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** "2027-01-09" → "09 ene" (eje de gráficos) */
export function formatShortEs(ymd: string): string {
  const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${ymd.slice(8, 10)} ${MON[Number(ymd.slice(5, 7)) - 1]}`;
}
