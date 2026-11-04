-- Funciones de rol fuera del esquema expuesto por la API (/rest/v1/rpc).
-- Las políticas RLS las siguen usando; los clientes ya no pueden invocarlas.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_super_admin(uuid)            SET SCHEMA private;
ALTER FUNCTION public.has_admin_access(uuid)          SET SCHEMA private;
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION private.is_super_admin(uuid)            SET search_path = public;
ALTER FUNCTION private.has_admin_access(uuid)          SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.is_super_admin(auth.uid()) THEN
    IF NEW.email IS DISTINCT FROM OLD.email OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'No tienes permiso para modificar estos campos';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
