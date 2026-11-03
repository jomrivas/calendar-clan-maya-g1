// Variables públicas (se exponen al navegador). Vite las reemplaza en build
// tanto en el bundle cliente como en el servidor.
export function getPublicSupabaseEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    const missing = [
      ...(!url ? ["VITE_SUPABASE_URL"] : []),
      ...(!key ? ["VITE_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`[Supabase] Faltan variables de entorno: ${missing.join(", ")}. Revisá .env`);
  }
  return { url, key };
}
