import { describe, expect, it } from "vitest";
import {
  buildReport,
  eligibleSaturdays,
  periodPresets,
  saturdaysBetween,
  svDateOf,
  type ReportAttendance,
  type ReportProfile,
} from "./reports";

// Enero 2027: sábados 02, 09, 16, 23, 30
const ana: ReportProfile = {
  id: "a",
  full_name: "Ana",
  email: "ana@x",
  is_active: true,
  created_at: "2026-12-01T12:00:00Z",
};
const beto: ReportProfile = {
  id: "b",
  full_name: "Beto",
  email: "beto@x",
  is_active: true,
  created_at: "2027-01-10T15:00:00Z",
}; // alta: 10/01
const ciro: ReportProfile = {
  id: "c",
  full_name: "Ciro",
  email: "ciro@x",
  is_active: false,
  created_at: "2026-12-01T12:00:00Z",
};

const att = (
  user_id: string,
  saturday_date: string,
  status: ReportAttendance["status"],
  justification: string | null = null,
): ReportAttendance => ({ user_id, saturday_date, status, justification });

const base = {
  profiles: [ana, beto, ciro],
  holidays: ["2027-01-16"],
  from: "2027-01-01",
  to: "2027-01-31",
  today: "2027-01-31",
};

describe("fechas", () => {
  it("lista sábados del rango", () => {
    expect(saturdaysBetween("2027-01-01", "2027-01-31")).toEqual([
      "2027-01-02",
      "2027-01-09",
      "2027-01-16",
      "2027-01-23",
      "2027-01-30",
    ]);
  });

  it("excluye feriados y sábados futuros", () => {
    expect(eligibleSaturdays("2027-01-01", "2027-01-31", "2027-01-20", ["2027-01-16"])).toEqual([
      "2027-01-02",
      "2027-01-09",
    ]);
  });

  it("rango futuro → sin sábados", () => {
    expect(eligibleSaturdays("2027-07-01", "2027-12-31", "2027-01-20", [])).toEqual([]);
  });

  it("fecha de alta en hora SV (UTC-6)", () => {
    expect(svDateOf("2027-01-10T03:00:00Z")).toBe("2027-01-09"); // 9 ene 21:00 SV
    expect(svDateOf("2027-01-10T15:00:00Z")).toBe("2027-01-10");
  });

  it("presets de período según semestre", () => {
    const [cur, prev, y] = periodPresets("2027-03-15");
    expect([cur.from, cur.to]).toEqual(["2027-01-01", "2027-06-30"]);
    expect([prev.from, prev.to]).toEqual(["2026-07-01", "2026-12-31"]);
    expect(y.label).toBe("Año 2027");
    const [cur2, prev2] = periodPresets("2027-09-01");
    expect(cur2.from).toBe("2027-07-01");
    expect(prev2.from).toBe("2027-01-01");
  });
});

describe("buildReport", () => {
  const attendances = [
    att("a", "2027-01-02", "Asistió"),
    att("a", "2027-01-09", "Permiso", "Viaje"),
    att("a", "2027-01-23", "No Asistió"),
    // 30 sin marcar
    att("b", "2027-01-23", "Asistió"),
    att("b", "2027-01-30", "Asistió"),
    att("c", "2027-01-02", "Asistió"),
  ];
  const r = buildReport({ ...base, attendances });

  it("4 sábados elegibles (16 es feriado)", () => {
    expect(r.saturdays).toEqual(["2027-01-02", "2027-01-09", "2027-01-23", "2027-01-30"]);
  });

  it("excluye inactivos por defecto", () => {
    expect(r.rows.map((x) => x.name)).toEqual(["Ana", "Beto"]);
  });

  it("calcula % por rover igual que la vista SQL", () => {
    const a = r.rows.find((x) => x.userId === "a")!;
    expect(a).toMatchObject({
      eligible: 4,
      attended: 1,
      excused: 1,
      missed: 1,
      unmarked: 1,
      percentage: 50,
      atRisk: true,
    });
  });

  it("no penaliza sábados previos al alta", () => {
    const b = r.rows.find((x) => x.userId === "b")!;
    expect(b).toMatchObject({ eligible: 2, attended: 2, percentage: 100, atRisk: false });
    expect(r.matrix.b["2027-01-02"]).toBe("N/A");
    expect(r.matrix.b["2027-01-30"]).toBe("Asistió");
    expect(r.matrix.a["2027-01-30"]).toBe("Sin marcar");
  });

  it("agrega por sábado con miembros elegibles ese día", () => {
    const s23 = r.bySaturday.find((x) => x.date === "2027-01-23")!;
    expect(s23).toMatchObject({ members: 2, attended: 1, missed: 1, rate: 50 });
    const s02 = r.bySaturday.find((x) => x.date === "2027-01-02")!;
    expect(s02).toMatchObject({ members: 1, attended: 1, rate: 100 });
  });

  it("KPIs", () => {
    expect(r.kpis).toEqual({
      members: 2,
      saturdaysHeld: 4,
      avgPercentage: 75,
      avgAttendeesPerSaturday: 0.75,
      totalExcused: 1,
      atRiskCount: 1,
    });
    expect(r.totals).toEqual({ attended: 3, excused: 1, missed: 1, unmarked: 1 });
  });

  it("umbral de riesgo configurable", () => {
    expect(buildReport({ ...base, attendances, riskThreshold: 50 }).kpis.atRiskCount).toBe(0);
  });

  it("incluye inactivos si se pide", () => {
    expect(buildReport({ ...base, attendances, includeInactive: true }).rows).toHaveLength(3);
  });

  it("filtra por rover", () => {
    const one = buildReport({ ...base, attendances, userId: "b" });
    expect(one.rows.map((x) => x.userId)).toEqual(["b"]);
    expect(one.records.every((x) => x.user_id === "b")).toBe(true);
  });

  it("registros filtrados por estado y ordenados desc", () => {
    const p = buildReport({ ...base, attendances, status: "Asistió" });
    expect(p.records.map((x) => `${x.saturday_date}:${x.name}`)).toEqual([
      "2027-01-30:Beto",
      "2027-01-23:Beto",
      "2027-01-02:Ana",
    ]);
  });

  it("período vacío no divide por cero", () => {
    const e = buildReport({ ...base, attendances, from: "2027-07-01", to: "2027-12-31" });
    expect(e.kpis.avgPercentage).toBe(0);
    expect(e.kpis.avgAttendeesPerSaturday).toBe(0);
    expect(e.rows.every((x) => x.percentage === 0 && !x.atRisk)).toBe(true);
  });
});
