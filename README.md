# Calendar Clan Maya G1

Control de asistencia sabatina del Clan Maya G1 · TanStack Start + Supabase · deploy en Vercel.
Alcance y arquitectura: ver [`SPEC.md`](./SPEC.md).

## Requisitos
- Node 20+ (`node -v`)
- Cuenta de Supabase y de Vercel

## 1. Correr local (PowerShell)

```powershell
git clone https://github.com/jomrivas/calendar-clan-maya-g1.git
cd calendar-clan-maya-g1
npm ci
Copy-Item .env.example .env   # completar con las claves del proyecto Supabase
npm run dev                   # http://localhost:3000
```

| Script | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | Verificar tipos |
| `npm run build` | Build para Vercel (`.vercel/output`) |

## 2. Supabase (una sola vez)

1. Crear el proyecto en **supabase.com**, región `us-east-1` (la más cercana a SV).
2. **SQL Editor** → pegar y ejecutar `supabase/migrations/20261103000000_init.sql`.
3. **Authentication → Sign In / Providers**:
   - Desactivar *Allow new users to sign up* (el super_admin crea las cuentas).
   - Desactivar *Confirm email* (opcional, porque las cuentas se crean ya confirmadas).
4. **Authentication → Users → Add user**: crear tu cuenta (marcar *Auto Confirm*).
5. **SQL Editor** → ejecutar `supabase/seed/bootstrap_super_admin.sql` (con tu email).
6. **Authentication → URL Configuration** → *Site URL* = `https://calendar-clanmaya-g1.vercel.app`.
7. Copiar desde **Project Settings → API Keys**: URL, publishable key y secret key.

## 3. Vercel

1. *Add New Project* → importar el repo de GitHub → nombre del proyecto **`calendar-clanmaya-g1`**.
2. Framework: **Other** (lo define `vercel.json`).
3. Variables de entorno (Production + Preview):

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (**solo servidor**) |
| `VITE_SITE_URL` | `https://calendar-clanmaya-g1.vercel.app` |
| `VITE_ALLOW_SIGNUP` | `false` |

4. Deploy. Cada `git push` a `main` redespliega automáticamente.

## 4. Operación
- **Alta de rovers:** `/admin/users` → *Nuevo usuario* (super_admin).
- **Feriados:** `/admin/holidays` (vienen precargados 2027–2028).
- **Corte:** en el dashboard de admin (por defecto, sábado a las 3:00 PM).
- **Regenerar tipos tras cambios de esquema:**
  `npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`

## Seguridad
- `SUPABASE_SERVICE_ROLE_KEY` nunca lleva prefijo `VITE_` ni se commitea.
- Las reglas de negocio y los permisos viven en RLS y triggers; están probados con 15 casos (ver historial del commit inicial).
