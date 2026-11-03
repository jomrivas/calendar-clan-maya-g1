-- =====================================================================
-- Calendar Clan Maya G1 — Esquema inicial consolidado
-- Reemplaza las 8 migraciones generadas en Lovable. Idempotente en
-- proyecto vacío. Zona horaria de negocio: America/El_Salvador (UTC-6).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE public.attendance_status AS ENUM ('Asistió', 'No Asistió', 'Permiso');

-- ---------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  email       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Un único rol por usuario.
CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL DEFAULT 'user',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.holidays_sv (
  holiday_date date PRIMARY KEY,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saturday_date date NOT NULL,
  status        public.attendance_status NOT NULL,
  justification text,
  marked_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, saturday_date)
);
CREATE INDEX idx_attendances_date ON public.attendances(saturday_date);

-- Configuración global (fila única).
CREATE TABLE public.app_settings (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),
  cutoff_day_offset integer NOT NULL DEFAULT 0 CHECK (cutoff_day_offset BETWEEN 0 AND 6),
  cutoff_time       time NOT NULL DEFAULT '15:00',
  updated_at        timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (true);

-- ---------------------------------------------------------------------
-- FUNCIONES DE ROL (SECURITY DEFINER → evitan recursión de RLS)
-- ---------------------------------------------------------------------
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE FUNCTION public.has_admin_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  )
$$;

-- Corte de asistencia: sábado + offset días, a la hora configurada (hora SV).
CREATE FUNCTION public.attendance_cutoff(_sat date)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ((_sat + s.cutoff_day_offset)::timestamp + s.cutoff_time) AT TIME ZONE 'America/El_Salvador'
  FROM public.app_settings s LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_access(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.attendance_cutoff(date)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)  TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid)             TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.has_admin_access(uuid)           TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.attendance_cutoff(date)          TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------
-- Alta de usuario → profile + rol 'user'. Nunca asigna admin automáticamente
-- (el super_admin inicial se asigna con supabase/seed/bootstrap_super_admin.sql).
CREATE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reglas de negocio de asistencia.
CREATE FUNCTION public.validate_attendance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXTRACT(DOW FROM NEW.saturday_date) <> 6 THEN
    RAISE EXCEPTION 'La fecha % no es sábado', NEW.saturday_date;
  END IF;
  IF EXISTS (SELECT 1 FROM public.holidays_sv WHERE holiday_date = NEW.saturday_date) THEN
    RAISE EXCEPTION 'La fecha % es feriado en El Salvador', NEW.saturday_date;
  END IF;
  IF NEW.status = 'Permiso' AND (NEW.justification IS NULL OR length(trim(NEW.justification)) = 0) THEN
    RAISE EXCEPTION 'Los permisos requieren justificación';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance
BEFORE INSERT OR UPDATE ON public.attendances
FOR EACH ROW EXECUTE FUNCTION public.validate_attendance();

-- Un usuario normal solo puede editar su nombre; email/is_active solo super_admin
-- (o service_role desde el servidor).
CREATE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'No tienes permiso para modificar estos campos';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- GRANTS + RLS
-- ---------------------------------------------------------------------
GRANT SELECT, UPDATE                 ON public.profiles     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays_sv  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances  TO authenticated;
GRANT SELECT, UPDATE                 ON public.app_settings TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.holidays_sv,
             public.attendances, public.app_settings TO service_role;

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays_sv  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_admin_access(auth.uid()));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));
-- INSERT/DELETE: solo vía trigger de auth y service_role (cascada al borrar usuario).

-- user_roles (super_admin gestiona; nadie puede crear super_admin desde la app)
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_access(auth.uid()));
CREATE POLICY "roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin');
CREATE POLICY "roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND user_id <> auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin');
CREATE POLICY "roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND user_id <> auth.uid());

-- holidays_sv
CREATE POLICY "holidays_select" ON public.holidays_sv FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_manage" ON public.holidays_sv FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- attendances
CREATE POLICY "attendance_select" ON public.attendances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_admin_access(auth.uid()));
CREATE POLICY "attendance_insert" ON public.attendances FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.attendance_cutoff(saturday_date) > now())
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "attendance_update" ON public.attendances FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND public.attendance_cutoff(saturday_date) > now())
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "attendance_delete" ON public.attendances FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- app_settings
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_update" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- VISTA: resumen semestral
-- Sábados elegibles = sábados del semestre actual, sin feriados, hasta hoy (SV)
-- y desde la fecha de alta del usuario (no penaliza a miembros nuevos).
-- ---------------------------------------------------------------------
CREATE VIEW public.semester_attendance WITH (security_invoker = on) AS
WITH ctx AS (
  SELECT
    (now() AT TIME ZONE 'America/El_Salvador')::date AS today,
    EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/El_Salvador'))::int AS year,
    CASE WHEN EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/El_Salvador')) <= 6 THEN 1 ELSE 2 END AS semester
),
bounds AS (
  SELECT
    p.id AS user_id, p.full_name, p.email, c.year, c.semester,
    GREATEST(
      make_date(c.year, CASE WHEN c.semester = 1 THEN 1 ELSE 7 END, 1),
      (p.created_at AT TIME ZONE 'America/El_Salvador')::date
    ) AS from_date,
    LEAST(
      CASE WHEN c.semester = 1 THEN make_date(c.year, 6, 30) ELSE make_date(c.year, 12, 31) END,
      c.today
    ) AS to_date
  FROM public.profiles p CROSS JOIN ctx c
),
saturdays AS (
  SELECT b.user_id, b.full_name, b.email, b.year, b.semester, gs::date AS sat
  FROM bounds b,
  LATERAL generate_series(b.from_date, b.to_date, interval '1 day') gs
  WHERE EXTRACT(DOW FROM gs) = 6
    AND NOT EXISTS (SELECT 1 FROM public.holidays_sv h WHERE h.holiday_date = gs::date)
)
SELECT
  b.user_id, b.full_name, b.email, b.year, b.semester,
  count(s.sat)                                                        AS eligible_saturdays,
  count(a.id) FILTER (WHERE a.status IN ('Asistió', 'Permiso'))      AS counted,
  count(a.id) FILTER (WHERE a.status = 'Asistió')                    AS attended,
  count(a.id) FILTER (WHERE a.status = 'Permiso')                    AS excused,
  count(a.id) FILTER (WHERE a.status = 'No Asistió')                 AS missed,
  CASE WHEN count(s.sat) = 0 THEN 0
       ELSE round(100.0 * count(a.id) FILTER (WHERE a.status IN ('Asistió', 'Permiso')) / count(s.sat), 2)
  END AS percentage
FROM bounds b
LEFT JOIN saturdays s ON s.user_id = b.user_id
LEFT JOIN public.attendances a ON a.user_id = s.user_id AND a.saturday_date = s.sat
GROUP BY b.user_id, b.full_name, b.email, b.year, b.semester;

GRANT SELECT ON public.semester_attendance TO authenticated;

-- ---------------------------------------------------------------------
-- SEED: feriados El Salvador 2027–2028 (editables desde /admin/holidays)
-- ---------------------------------------------------------------------
INSERT INTO public.holidays_sv (holiday_date, name) VALUES
  ('2027-01-01', 'Año Nuevo'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-03-27', 'Sábado Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-05-10', 'Día de las Madres'),
  ('2027-06-17', 'Día del Padre'),
  ('2027-08-06', 'Día del Salvador del Mundo'),
  ('2027-09-15', 'Día de la Independencia'),
  ('2027-11-02', 'Día de los Difuntos'),
  ('2027-12-25', 'Navidad'),
  ('2028-01-01', 'Año Nuevo'),
  ('2028-04-13', 'Jueves Santo'),
  ('2028-04-14', 'Viernes Santo'),
  ('2028-04-15', 'Sábado Santo'),
  ('2028-05-01', 'Día del Trabajo'),
  ('2028-05-10', 'Día de las Madres'),
  ('2028-06-17', 'Día del Padre'),
  ('2028-08-06', 'Día del Salvador del Mundo'),
  ('2028-09-15', 'Día de la Independencia'),
  ('2028-11-02', 'Día de los Difuntos'),
  ('2028-12-25', 'Navidad')
ON CONFLICT (holiday_date) DO NOTHING;
