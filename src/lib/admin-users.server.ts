import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function createManagedUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "user";
}) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (error) throw new Error(error.message);

  const uid = created.user!.id;

  // El trigger handle_new_user crea profile + rol 'user'; si piden admin, se reemplaza.
  if (input.role === "admin") {
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", uid);

    if (roleError) throw new Error(roleError.message);
  }

  return { ok: true, id: uid };
}

export async function updateManagedUserAuth(input: {
  userId: string;
  email?: string;
  password?: string;
}) {
  const patch: Record<string, string> = {};

  if (input.email) patch.email = input.email;
  if (input.password) patch.password = input.password;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(input.userId, patch);
  if (error) throw new Error(error.message);

  if (input.email) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email: input.email })
      .eq("id", input.userId);

    if (profileError) throw new Error(profileError.message);
  }

  return { ok: true };
}

export async function deleteManagedUser(userId: string) {
  // profiles, user_roles y attendances se borran en cascada (FK ON DELETE CASCADE).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  return { ok: true };
}