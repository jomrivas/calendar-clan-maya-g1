import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, ensureAdminQuotaForAssignment } from "@/lib/admin.functions";
import {
  createManagedUser,
  deleteManagedUser,
  updateManagedUserAuth,
} from "@/lib/admin-users.server";

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(100),
      fullName: z.string().trim().min(1).max(120),
      role: z.enum(["admin", "user"]).default("user"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.role === "admin") {
      await ensureAdminQuotaForAssignment(context, {
        targetUserId: "__new__",
        newRole: "admin",
      });
    }
    return createManagedUser(data);
  });

export const updateUserAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid(),
      email: z.string().email().max(255).optional(),
      password: z.string().min(6).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    return updateManagedUserAuth(data);
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta");
    }
    return deleteManagedUser(data.userId);
  });
