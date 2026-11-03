// Helpers to reason about time in America/El_Salvador (UTC-6, no DST)

const TZ = "America/El_Salvador";

export function nowInSV(): Date {
  // Return a Date whose UTC-equivalent matches SV wall-clock components.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  );
}

export function todayInSV(): Date {
  const n = nowInSV();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

export function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Compute the cutoff (Saturday 15:00 SV) as a real UTC instant.
// SV is UTC-6 year-round, so 15:00 SV = 21:00 UTC.
export function saturdayCutoffUtc(saturdayYmd: string): Date {
  const [y, m, d] = saturdayYmd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 21, 0, 0));
}

export function isBeforeCutoff(saturdayYmd: string): boolean {
  return Date.now() < saturdayCutoffUtc(saturdayYmd).getTime();
}

export function getSaturdaysOfMonth(year: number, monthIdx0: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();
  for (let day = 1; day <= last; day++) {
    const d = new Date(Date.UTC(year, monthIdx0, day));
    if (d.getUTCDay() === 6) out.push(formatYmd(d));
  }
  return out;
}

export function currentSemester(): { year: number; semester: 1 | 2 } {
  const n = nowInSV();
  return {
    year: n.getUTCFullYear(),
    semester: n.getUTCMonth() < 6 ? 1 : 2,
  };
}

export type CutoffSettings = { cutoff_day_offset: number; cutoff_time: string };
export const DAY_LABELS = ["Sábado", "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

// Configurable cutoff: Saturday + offset days at HH:MM SV (UTC-6).
export function cutoffUtc(saturdayYmd: string, s?: CutoffSettings | null): Date {
  const [y, m, d] = saturdayYmd.split("-").map(Number);
  const [hh, mm] = (s?.cutoff_time ?? "15:00").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d + (s?.cutoff_day_offset ?? 0), hh + 6, mm, 0));
}

export function describeCutoff(s?: CutoffSettings | null): string {
  const [hh, mm] = (s?.cutoff_time ?? "15:00").split(":").map(Number);
  const h12 = ((hh + 11) % 12) + 1;
  const off = s?.cutoff_day_offset ?? 0;
  const day = off === 0 ? "cada sábado" : `el ${DAY_LABELS[off].toLowerCase()} siguiente a cada sábado`;
  return `${day} antes de las ${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}
