import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Mark "Asistió" for the current user. Server enforces SV-time cutoff via RLS.
export const markAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ saturdayDate: ymd }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("attendances").upsert(
      {
        user_id: userId,
        saturday_date: data.saturdayDate,
        status: "Asistió",
        justification: null,
      },
      { onConflict: "user_id,saturday_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Submit a justification (Permiso). Must include text.
export const submitJustification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      saturdayDate: ymd,
      justification: z.string().trim().min(5).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("attendances").upsert(
      {
        user_id: userId,
        saturday_date: data.saturdayDate,
        status: "Permiso",
        justification: data.justification,
      },
      { onConflict: "user_id,saturday_date" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
