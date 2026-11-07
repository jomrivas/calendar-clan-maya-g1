import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import type { ReportAttendance, ReportProfile } from "@/lib/reports";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Datos crudos para /admin/reportes. Los cálculos se hacen en el cliente con
// buildReport() (src/lib/reports.ts) para que filtros y gráficos no
// requieran nuevas llamadas al servidor.
export const getReportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) =>
    z
      .object({ from: ymd, to: ymd })
      .refine((v) => v.from <= v.to, "El rango de fechas es inválido")
      .refine(
        (v) => Number(v.to.slice(0, 4)) - Number(v.from.slice(0, 4)) <= 2,
        "Máximo 3 años por reporte",
      )
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const [profiles, attendances, holidays] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, is_active, created_at"),
      supabase
        .from("attendances")
        .select("user_id, saturday_date, status, justification")
        .gte("saturday_date", data.from)
        .lte("saturday_date", data.to),
      supabase
        .from("holidays_sv")
        .select("holiday_date")
        .gte("holiday_date", data.from)
        .lte("holiday_date", data.to),
    ]);
    for (const r of [profiles, attendances, holidays])
      if (r.error) throw new Error(r.error.message);

    return {
      profiles: (profiles.data ?? []) as ReportProfile[],
      attendances: (attendances.data ?? []) as ReportAttendance[],
      holidays: (holidays.data ?? []).map((h) => h.holiday_date),
    };
  });
