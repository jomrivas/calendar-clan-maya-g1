// Feature flags públicos (configurables por entorno).
// El registro abierto está apagado por defecto: el super_admin crea las cuentas.
// Si lo activás, habilitá también "Allow new users to sign up" en Supabase Auth.
export const ALLOW_SIGNUP = import.meta.env.VITE_ALLOW_SIGNUP === "true";
