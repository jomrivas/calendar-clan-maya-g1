import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildClanWorkbook, buildRoverWorkbook } from "./excel";
import { buildReport, type ReportProfile } from "./reports";

const ana: ReportProfile = {
  id: "a",
  full_name: "Ana Pérez",
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
};
const attendances = [
  { user_id: "a", saturday_date: "2027-01-02", status: "Asistió" as const, justification: null },
  {
    user_id: "a",
    saturday_date: "2027-01-09",
    status: "Permiso" as const,
    justification: "Viaje familiar",
  },
  { user_id: "b", saturday_date: "2027-01-23", status: "Asistió" as const, justification: null },
];
const report = buildReport({
  profiles: [ana, beto],
  attendances,
  holidays: ["2027-01-16"],
  from: "2027-01-01",
  to: "2027-01-31",
  today: "2027-01-31",
});

async function roundTrip(wb: ExcelJS.Workbook) {
  const buf = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buf as ArrayBuffer);
  return back;
}

describe("buildClanWorkbook", () => {
  it("genera las 4 hojas con datos legibles", async () => {
    const wb = await roundTrip(
      buildClanWorkbook(ExcelJS, report, {
        periodLabel: "Enero 2027",
        generatedAt: new Date("2027-02-01T18:00:00Z"),
        generatedBy: "admin@x",
        filters: ["Estado: Todos"],
      }),
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Portada", "Resumen", "Matriz", "Registros"]);

    const sum = wb.getWorksheet("Resumen")!;
    expect(sum.getRow(4).getCell(1).value).toBe("Rover");
    expect(sum.getRow(5).getCell(1).value).toBe("Ana Pérez");
    expect(sum.getRow(5).getCell(10).value).toBe(0.5); // 2 de 4
    expect(sum.getRow(5).getCell(11).value).toBe("Sí");
    expect(sum.getRow(7).getCell(1).value).toBe("TOTAL / PROMEDIO");

    const mx = wb.getWorksheet("Matriz")!;
    expect(mx.getRow(4).values).toEqual([
      undefined,
      "Rover",
      "02/01",
      "09/01",
      "23/01",
      "30/01",
      "%",
    ]);
    expect(mx.getRow(5).getCell(2).value).toBe("A");
    expect(mx.getRow(5).getCell(3).value).toBe("P");
    expect(mx.getRow(6).getCell(2).value).toBe(""); // Beto antes del alta

    const rec = wb.getWorksheet("Registros")!;
    expect(rec.rowCount).toBe(4 + 3);
    expect(rec.getRow(6).getCell(5).value).toBe("Viaje familiar");
  });
});

describe("buildRoverWorkbook", () => {
  it("resume por semestre e incluye historial sin sábados previos al alta", async () => {
    const wb = await roundTrip(
      buildRoverWorkbook(ExcelJS, {
        profile: beto,
        attendances: attendances.filter((a) => a.user_id === "b"),
        holidays: ["2027-01-16"],
        year: 2027,
        today: "2027-01-31",
      }),
    );
    const ws = wb.worksheets[0];
    expect(ws.name).toBe("Asistencia 2027");
    expect(ws.getRow(5).values).toEqual([undefined, "Ene–Jun 2027", 2, 1, 0, 0, 0.5]);
    const dates: string[] = [];
    ws.eachRow((r, n) => {
      if (n > 8) dates.push(String(r.getCell(1).value));
    });
    expect(dates).toEqual(["23/01/2027", "30/01/2027"]);
  });
});
