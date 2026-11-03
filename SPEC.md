# SPEC — Calendar Clan Maya G1

> Spec-Driven Development. Fuente de verdad del alcance, la arquitectura y las fases.
> Versión 1.0 · 2026-11-03 · Owner: Mauricio Rivas

## 1. Objetivo

Portal de control de **asistencia sabatina** del Clan Maya G1: cada rover marca su asistencia o permiso antes del corte; la dirigencia consulta métricas semestrales y gestiona usuarios y feriados.

- **Alcance de esta versión:** salir de Lovable y operar de forma independiente en **Vercel + Supabase propio**, a partir del **ciclo 2027** (datos limpios).
- **Lovable** se mantiene operativo hasta cerrar el ciclo 2026 y después se archiva.

## 2. Arquitectura

```
Navegador ──► Vercel (TanStack Start SSR + server functions, Nitro preset "vercel")
                │  JWT del usuario (Bearer)
                ▼
            Supabase propio
              ├─ Auth (email + contraseña; registro abierto apagado)
              ├─ Postgres + RLS (reglas de negocio en BD)
              └─ service_role → solo en server functions de gestión de usuarios
```

| Capa | Tecnología |
|---|---|
| UI | React 19, TanStack Router, Tailwind 4, shadcn/ui (15 componentes) |
| Servidor | TanStack Start `createServerFn` + Nitro → Vercel Functions |
| Datos | Supabase Postgres 17, RLS, triggers |
| Zona horaria | `America/El_Salvador` (UTC-6, sin horario de verano) |

**Principio:** la seguridad vive en la BD (RLS + triggers). Las server functions validan rol como segunda capa, nunca como única.

## 3. Roles

| Rol | Puede |
|---|---|
| `user` (rover) | Ver/editar su propia asistencia **antes del corte** y editar su nombre |
| `admin` (máx. 2) | Lo anterior + ver todos los perfiles, asistencias y el dashboard |
| `super_admin` | Todo: usuarios (CRUD + roles), feriados, corte, asistencia fuera de plazo y backfill |

- No se puede crear `super_admin` desde la app; solo con `supabase/seed/bootstrap_super_admin.sql`.
- Nadie puede cambiar ni borrar su propio rol.

## 4. Esquema de datos

```
auth.users 1─1 profiles      (id, full_name, email, is_active, created_at)
auth.users 1─1 user_roles    (user_id UNIQUE, role app_role)
auth.users 1─N attendances   (user_id, saturday_date, status, justification) UNIQUE(user_id, saturday_date)
holidays_sv                  (holiday_date PK, name)
app_settings (fila única)    (cutoff_day_offset 0–6, cutoff_time)
VIEW semester_attendance     (security_invoker) → % por usuario del semestre actual
```

**Reglas en la BD:**
- `attendances.saturday_date` debe ser sábado y no puede ser feriado (trigger).
- `Permiso` exige justificación (trigger).
- Corte = sábado + `cutoff_day_offset` días a las `cutoff_time` (hora SV) → `attendance_cutoff()` (RLS).
- `profiles.email` e `is_active` solo los modifica el super_admin o el service_role (trigger).
- Borrar un usuario de Auth borra en cascada su perfil, rol y asistencias.
- `% = (Asistió + Permiso) / sábados elegibles`. Los sábados elegibles cuentan desde la fecha de alta del usuario.

## 5. Fases

| Fase | Entregable | Estado |
|---|---|---|
| **1. Migración** | Repo limpio sin Lovable, migración consolidada, build para Vercel, RLS probado | ✅ Listo (local) |
| **2. Despliegue** | Proyecto Supabase nuevo, bootstrap del super_admin, proyecto Vercel `calendar-clanmaya-g1`, alta de ~12 usuarios | ⏳ Pendiente de tu confirmación |
| **3. Reportes** | Dashboard de métricas (tendencia por sábado, ranking, % por semestre), filtros por rango y usuario, **exportar a Excel** (.xlsx) | 🔜 |
| **4. UI Clan Maya** | Design system de la marca (paleta, tipografía, grecas, logo) aplicado a todas las pantallas | 🔜 |
| **5. QA** | Suite E2E con Playwright (POM): login, marcar, corte, permisos por rol, exportación | 🔜 |

### Paleta de marca (para Fase 4)

| Token | Hex |
|---|---|
| Azul Maya oscuro | `#0F1D38` |
| Marrón tierra | `#634B30` |
| Amarillo pirámide | `#E6BE3C` |
| Morado Scout | `#4A1A7B` |
| Crema de fondo | `#FAF6F1` |

## 6. Cambios respecto a la versión de Lovable

| Antes | Ahora |
|---|---|
| `@lovable.dev/vite-tanstack-config` (target Cloudflare) | Vite estándar + Nitro preset `vercel` |
| 8 migraciones con parches y UUID hardcodeado | 1 migración consolidada + seed de bootstrap por email |
| El primer usuario registrado se volvía admin | El trigger siempre asigna `user` |
| `user_roles` sin políticas de escritura (fallaba el cambio de rol) | Políticas para super_admin + `user_id UNIQUE` + upsert atómico |
| Se podía cambiar el propio rol | Bloqueado en RLS y en el servidor |
| Usuario podía editar `is_active`/`email` propios vía API | Trigger `protect_profile_fields` |
| La vista penalizaba sábados previos al alta | Cuenta desde `created_at` del perfil |
| El backfill marcaba "No Asistió" antes del alta | Respeta la fecha de alta y usa `cutoffUtc()` |
| Registro público abierto | `VITE_ALLOW_SIGNUP=false` por defecto |
| `.env` versionado y código muerto de Lovable | `.env.example` y código muerto eliminado; 43 → 15 componentes UI |
