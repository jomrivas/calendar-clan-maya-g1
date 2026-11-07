// Exportación a Excel (.xlsx) con ExcelJS.
// ExcelJS se carga bajo demanda (import dinámico) solo al exportar, para no
// sumar ~1 MB al bundle inicial. Los builders reciben el módulo como
// parámetro, así se prueban en Node sin navegador.
import type { Workbook, Worksheet, Fill } from "exceljs";
import {
  buildReport,
  formatDateEs,
  type CellStatus,
  type Report,
  type ReportAttendance,
  type ReportProfile,
} from "@/lib/reports";

type ExcelJSModule = typeof import("exceljs");

// Paleta Clan Maya G1 (ARGB)
const C = {
  azul: "FF0F1D38",
  crema: "FFFAF6F1",
  amarillo: "FFE6BE3C",
  morado: "FF4A1A7B",
  blanco: "FFFFFFFF",
  gris: "FF8A8A8A",
};

const STATUS_FILL: Record<CellStatus, string> = {
  Asistió: "FFDCEFD9",
  Permiso: "FFFBEFC5",
  "No Asistió": "FFF8D7D5",
  "Sin marcar": "FFEDEDED",
  "N/A": "FFFFFFFF",
};

const STATUS_SHORT: Record<CellStatus, string> = {
  Asistió: "A",
  Permiso: "P",
  "No Asistió": "X",
  "Sin marcar": "—",
  "N/A": "",
};

const solid = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function styleHeader(ws: Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.eachCell((c) => {
    c.fill = solid(C.azul);
    c.font = { bold: true, color: { argb: C.blanco } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 22;
}

function addTitle(ws: Worksheet, title: string, subtitle: string, span: number) {
  ws.mergeCells(1, 1, 1, Math.max(span, 2));
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: C.azul } };
  ws.mergeCells(2, 1, 2, Math.max(span, 2));
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { italic: true, color: { argb: C.gris } };
}

export type ClanReportMeta = {
  periodLabel: string;
  generatedAt: Date;
  generatedBy: string;
  filters: string[];
};

/** Workbook del clan: Portada, Resumen, Matriz, Registros. */
export function buildClanWorkbook(
  ExcelJS: ExcelJSModule,
  report: Report,
  meta: ClanReportMeta,
): Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Calendar Check Clan Maya";
  wb.created = meta.generatedAt;
  const rango = `${formatDateEs(report.from)} – ${formatDateEs(report.to)}`;

  // --- Portada --------------------------------------------------------------
  const cover = wb.addWorksheet("Portada", { properties: { tabColor: { argb: C.morado } } });
  cover.columns = [{ width: 34 }, { width: 44 }];
  addTitle(
    cover,
    "Reporte de asistencia — Clan Maya G1",
    "Grupo Scout No. 1 · Asistencia sabatina",
    2,
  );
  const info: [string, string | number][] = [
    ["Período", meta.periodLabel],
    ["Rango", rango],
    ["Generado", meta.generatedAt.toLocaleString("es-SV", { timeZone: "America/El_Salvador" })],
    ["Generado por", meta.generatedBy],
    ["Filtros", meta.filters.length ? meta.filters.join(" · ") : "Ninguno"],
    ["", ""],
    ["Rovers en el reporte", report.kpis.members],
    ["Sábados realizados", report.kpis.saturdaysHeld],
    ["% promedio del clan", report.kpis.avgPercentage / 100],
    ["Asistentes promedio por sábado", report.kpis.avgAttendeesPerSaturday],
    ["Permisos", report.kpis.totalExcused],
    [`Rovers en riesgo (< ${report.riskThreshold}%)`, report.kpis.atRiskCount],
    ["", ""],
    [
      "Leyenda (hoja Matriz)",
      "A = Asistió · P = Permiso · X = No asistió · — = Sin marcar · vacío = antes del alta",
    ],
    [
      "Cálculo del %",
      "(Asistió + Permiso) / sábados elegibles. Sin feriados; cada rover desde su fecha de alta.",
    ],
  ];
  info.forEach(([k, v], i) => {
    const r = cover.getRow(4 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true, color: { argb: C.azul } };
    r.getCell(2).value = v;
    r.getCell(2).alignment = { wrapText: true, horizontal: "left" };
  });
  cover.getCell(`B${4 + 8}`).numFmt = "0.0%";

  // --- Resumen --------------------------------------------------------------
  const sum = wb.addWorksheet("Resumen", { views: [{ state: "frozen", ySplit: 4 }] });
  const sumHead = [
    "Rover",
    "Correo",
    "Estado",
    "Alta",
    "Sábados elegibles",
    "Asistió",
    "Permiso",
    "No asistió",
    "Sin marcar",
    "% asistencia",
    "En riesgo",
  ];
  addTitle(sum, "Resumen por rover", `${meta.periodLabel} · ${rango}`, sumHead.length);
  sum.getRow(4).values = sumHead;
  styleHeader(sum, 4);
  report.rows.forEach((r) => {
    const row = sum.addRow([
      r.name,
      r.email,
      r.isActive ? "Activo" : "Inactivo",
      formatDateEs(r.joined),
      r.eligible,
      r.attended,
      r.excused,
      r.missed,
      r.unmarked,
      r.percentage / 100,
      r.atRisk ? "Sí" : "No",
    ]);
    row.getCell(10).numFmt = "0.0%";
    if (r.atRisk) {
      row.getCell(10).font = { bold: true, color: { argb: "FFB3261E" } };
      row.getCell(11).fill = solid(STATUS_FILL["No Asistió"]);
    }
  });
  const totRow = sum.addRow([
    "TOTAL / PROMEDIO",
    "",
    "",
    "",
    "",
    report.totals.attended,
    report.totals.excused,
    report.totals.missed,
    report.totals.unmarked,
    report.kpis.avgPercentage / 100,
    report.kpis.atRiskCount,
  ]);
  totRow.font = { bold: true };
  totRow.getCell(10).numFmt = "0.0%";
  totRow.eachCell((c) => (c.fill = solid(C.crema)));
  sum.columns = [28, 30, 10, 12, 12, 10, 10, 11, 11, 13, 10].map((width) => ({ width }));
  sum.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + report.rows.length, column: sumHead.length },
  };

  // --- Matriz ---------------------------------------------------------------
  const mx = wb.addWorksheet("Matriz", { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
  const mxHead = ["Rover", ...report.saturdays.map((d) => formatDateEs(d).slice(0, 5)), "%"];
  addTitle(
    mx,
    "Matriz rover × sábado",
    "A = Asistió · P = Permiso · X = No asistió · — = Sin marcar",
    Math.min(mxHead.length, 12),
  );
  mx.getRow(4).values = mxHead;
  styleHeader(mx, 4);
  report.rows.forEach((r) => {
    const cells = report.saturdays.map((d) => report.matrix[r.userId][d]);
    const row = mx.addRow([r.name, ...cells.map((s) => STATUS_SHORT[s]), r.percentage / 100]);
    cells.forEach((s, i) => {
      const c = row.getCell(i + 2);
      c.fill = solid(STATUS_FILL[s]);
      c.alignment = { horizontal: "center" };
      if (s !== "N/A") c.note = s;
    });
    row.getCell(mxHead.length).numFmt = "0%";
  });
  const rateRow = mx.addRow(["% del sábado", ...report.bySaturday.map((s) => s.rate / 100), ""]);
  rateRow.font = { bold: true };
  report.bySaturday.forEach((_, i) => {
    const c = rateRow.getCell(i + 2);
    c.numFmt = "0%";
    c.fill = solid(C.crema);
  });
  mx.getColumn(1).width = 28;
  for (let i = 2; i <= mxHead.length; i++) mx.getColumn(i).width = 7;

  // --- Registros ------------------------------------------------------------
  const rec = wb.addWorksheet("Registros", { views: [{ state: "frozen", ySplit: 4 }] });
  const recHead = ["Sábado", "Rover", "Correo", "Estado", "Justificación"];
  addTitle(rec, "Registros de asistencia", `${report.records.length} registros`, recHead.length);
  rec.getRow(4).values = recHead;
  styleHeader(rec, 4);
  report.records.forEach((r) => {
    const row = rec.addRow([
      formatDateEs(r.saturday_date),
      r.name,
      r.email,
      r.status,
      r.justification ?? "",
    ]);
    row.getCell(4).fill = solid(STATUS_FILL[r.status]);
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
  });
  rec.columns = [12, 28, 30, 13, 60].map((width) => ({ width }));
  rec.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + report.records.length, column: recHead.length },
  };

  return wb;
}

export type RoverHistoryInput = {
  profile: ReportProfile;
  attendances: ReportAttendance[];
  holidays: string[];
  year: number;
  today: string;
  riskThreshold?: number;
};

/** Workbook personal del rover: resumen por semestre + historial del año. */
export function buildRoverWorkbook(ExcelJS: ExcelJSModule, input: RoverHistoryInput): Workbook {
  const { profile, year } = input;
  const common = {
    profiles: [profile],
    attendances: input.attendances,
    holidays: input.holidays,
    today: input.today,
    includeInactive: true,
    riskThreshold: input.riskThreshold,
  };
  const sems = [
    {
      label: `Ene–Jun ${year}`,
      r: buildReport({ ...common, from: `${year}-01-01`, to: `${year}-06-30` }),
    },
    {
      label: `Jul–Dic ${year}`,
      r: buildReport({ ...common, from: `${year}-07-01`, to: `${year}-12-31` }),
    },
  ];
  const full = buildReport({ ...common, from: `${year}-01-01`, to: `${year}-12-31` });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Calendar Check Clan Maya";
  const ws = wb.addWorksheet(`Asistencia ${year}`, {
    properties: { tabColor: { argb: C.amarillo } },
  });
  ws.columns = [
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];
  addTitle(
    ws,
    `Mi asistencia ${year} — ${profile.full_name || profile.email}`,
    "Clan Maya G1 · Grupo Scout No. 1",
    6,
  );

  ws.getRow(4).values = [
    "Semestre",
    "Elegibles",
    "Asistió",
    "Permiso",
    "No asistió",
    "% asistencia",
  ];
  styleHeader(ws, 4);
  sems.forEach(({ label, r }) => {
    const x = r.rows[0];
    const row = ws.addRow([
      label,
      x?.eligible ?? 0,
      x?.attended ?? 0,
      x?.excused ?? 0,
      x?.missed ?? 0,
      (x?.percentage ?? 0) / 100,
    ]);
    row.getCell(6).numFmt = "0.0%";
  });

  const start = ws.rowCount + 2;
  ws.getRow(start).values = ["Sábado", "Estado", "Justificación"];
  styleHeader(ws, start);
  ws.mergeCells(start, 3, start, 6);
  const byDate = new Map(input.attendances.map((a) => [a.saturday_date, a]));
  for (const d of full.saturdays) {
    const st = full.matrix[profile.id]?.[d] ?? "Sin marcar";
    if (st === "N/A") continue;
    const row = ws.addRow([formatDateEs(d), st, byDate.get(d)?.justification ?? ""]);
    ws.mergeCells(row.number, 3, row.number, 6);
    row.getCell(2).fill = solid(STATUS_FILL[st]);
    row.getCell(3).alignment = { wrapText: true };
  }
  return wb;
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
async function loadExcelJS(): Promise<ExcelJSModule> {
  // El bundle de navegador de ExcelJS es UMD: Vite lo expone como `default`.
  const mod = (await import("exceljs")) as ExcelJSModule & { default?: ExcelJSModule };
  return mod.default ?? mod;
}

async function download(wb: Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportClanReport(report: Report, meta: ClanReportMeta) {
  const ExcelJS = await loadExcelJS();
  await download(
    buildClanWorkbook(ExcelJS, report, meta),
    `asistencia-clan-maya_${report.from}_${report.to}.xlsx`,
  );
}

export async function exportRoverHistory(input: RoverHistoryInput) {
  const ExcelJS = await loadExcelJS();
  const slug = (input.profile.full_name || input.profile.email.split("@")[0])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  await download(buildRoverWorkbook(ExcelJS, input), `mi-asistencia-${slug}-${input.year}.xlsx`);
}
