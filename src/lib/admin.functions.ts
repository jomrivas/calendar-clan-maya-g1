import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentSemester, cutoffUtc, formatYmd, getSaturdaysOfMonth } from "@/lib/sv-time";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function getRole(ctx: { supabase: any; userId: string }): Promise<"super_admin" | "admin" | "user"> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as any) ?? "user";
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const r = await getRole(ctx);
  if (r !== "admin" && r !== "super_admin") throw new Error("Forbidden: admin only");
}

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const r = await getRole(ctx);
  if (r !== "super_admin") throw new Error("Forbidden: super admin only");
}

const MAX_ADMINS = 2;

async function ensureAdminQuotaForAssignment(
  ctx: { supabase: any },
  opts: { targetUserId: string; newRole: "admin" | "user" | "super_admin" },
) {
  if (opts.newRole !== "admin") return;
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  const current = (data ?? []).filter((r: any) => r.user_id !== opts.targetUserId);
  if (current.length >= MAX_ADMINS) {
    throw new Error(`Solo se permiten ${MAX_ADMINS} administradores como máximo`);
  }
}

export { assertAdmin, assertSuperAdmin, ensureAdminQuotaForAssignment };

// Backfill 'No Asistió' para cada usuario activo en sábados pasados del año
// en curso (sin feriados), solo desde la fecha de alta del usuario y solo si
// ya pasó el corte. Idempotente: no pisa registros existentes.
export const finalizePastSaturdays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertSuperAdmin(context);

    const [{ data: profiles, error: pErr }, { data: holidays, error: hErr }, { data: st }] =
      await Promise.all([
        supabase.from("profiles").select("id, created_at").eq("is_active", true),
        supabase.from("holidays_sv").select("holiday_date"),
        supabase.from("app_settings").select("cutoff_day_offset,cutoff_time").maybeSingle(),
      ]);
    if (pErr) throw new Error(pErr.message);
    if (hErr) throw new Error(hErr.message);

    const holidaySet = new Set((holidays ?? []).map((h) => h.holiday_date));
    const nowMs = Date.now();
    const { year } = currentSemester();

    const past: string[] = [];
    for (let m = 0; m < 12; m++) {
      for (const sat of getSaturdaysOfMonth(year, m)) {
        if (holidaySet.has(sat)) continue;
        if (cutoffUtc(sat, st).getTime() > nowMs) continue;
        past.push(sat);
      }
    }
    if (past.length === 0 || !profiles?.length) return { inserted: 0 };

    const rows: { user_id: string; saturday_date: string; status: "No Asistió" }[] = [];
    for (const p of profiles) {
      const joined = formatYmd(new Date(p.created_at)); // fecha de alta (aprox. UTC)
      for (const sat of past) {
        if (sat < joined) continue;
        rows.push({ user_id: p.id, saturday_date: sat, status: "No Asistió" });
      }
    }
    if (rows.length === 0) return { inserted: 0 };

    const { error: insErr, count } = await supabase
      .from("attendances")
      .upsert(rows, { onConflict: "user_id,saturday_date", ignoreDuplicates: true, count: "exact" });
    if (insErr) throw new Error(insErr.message);
    return { inserted: count ?? 0 };
  });

// Admin overview
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const [{ data: users }, { data: semester }, { data: missed }, { data: allAttendances }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, is_active, created_at"),
      supabase.from("semester_attendance").select("*"),
      supabase
        .from("attendances")
        .select("id, user_id, saturday_date, status, justification, profiles!inner(full_name,email)")
        .order("saturday_date", { ascending: false })
        .limit(50),
      supabase
        .from("attendances")
        .select("user_id, saturday_date, status, justification")
        .order("saturday_date", { ascending: false }),
    ]);

    return {
      users: users ?? [],
      semester: semester ?? [],
      recent: missed ?? [],
      attendances: allAttendances ?? [],
    };
  });

// Admin: update user
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      fullName: z.string().trim().min(1).max(120).optional(),
      isActive: z.boolean().optional(),
      role: z.enum(["admin", "user"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase } = context;

    if (data.fullName !== undefined || data.isActive !== undefined) {
      const patch: any = {};
      if (data.fullName !== undefined) patch.full_name = data.fullName;
      if (data.isActive !== undefined) patch.is_active = data.isActive;
      const { error } = await supabase.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      if (data.userId === context.userId) {
        throw new Error("No puedes cambiar tu propio rol");
      }
      await ensureAdminQuotaForAssignment(context, {
        targetUserId: data.userId,
        newRole: data.role,
      });
      // Un rol por usuario (user_id UNIQUE): upsert atómico.
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Admin: manual status override
export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      saturdayDate: ymd,
      status: z.enum(["Asistió", "No Asistió", "Permiso"]),
      justification: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase } = context;
    const { error } = await supabase.from("attendances").upsert(
      {
        user_id: data.userId,
        saturday_date: data.saturdayDate,
        status: data.status,
        justification: data.justification ?? null,
      },
      { onConflict: "user_id,saturday_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: holiday CRUD
export const addHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ date: ymd, name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("holidays_sv")
      .upsert({ holiday_date: data.date, name: data.name }, { onConflict: "holiday_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ date: ymd }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("holidays_sv")
      .delete()
      .eq("holiday_date", data.date);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), saturdayDate: ymd }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("attendances").delete()
      .eq("user_id", data.userId).eq("saturday_date", data.saturdayDate);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCutoffSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      dayOffset: z.number().int().min(0).max(6),
      time: z.string().regex(/^\d{2}:\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .update({ cutoff_day_offset: data.dayOffset, cutoff_time: data.time, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
