-- Rendimiento RLS: (select auth.uid()) se evalúa una vez por consulta, no por fila.
-- holidays_manage (FOR ALL) se separa para no duplicar políticas SELECT.
DROP POLICY "profiles_select" ON public.profiles;
DROP POLICY "profiles_update" ON public.profiles;
DROP POLICY "roles_select" ON public.user_roles;
DROP POLICY "roles_insert" ON public.user_roles;
DROP POLICY "roles_update" ON public.user_roles;
DROP POLICY "roles_delete" ON public.user_roles;
DROP POLICY "holidays_manage" ON public.holidays_sv;
DROP POLICY "attendance_select" ON public.attendances;
DROP POLICY "attendance_insert" ON public.attendances;
DROP POLICY "attendance_update" ON public.attendances;
DROP POLICY "attendance_delete" ON public.attendances;
DROP POLICY "settings_update" ON public.app_settings;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = (select auth.uid()) OR private.has_admin_access((select auth.uid())));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()) OR private.is_super_admin((select auth.uid())))
  WITH CHECK (id = (select auth.uid()) OR private.is_super_admin((select auth.uid())));

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR private.has_admin_access((select auth.uid())));
CREATE POLICY "roles_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin((select auth.uid())) AND role <> 'super_admin');
CREATE POLICY "roles_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (private.is_super_admin((select auth.uid())) AND user_id <> (select auth.uid()))
  WITH CHECK (private.is_super_admin((select auth.uid())) AND role <> 'super_admin');
CREATE POLICY "roles_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (private.is_super_admin((select auth.uid())) AND user_id <> (select auth.uid()));

CREATE POLICY "holidays_insert" ON public.holidays_sv FOR INSERT TO authenticated
  WITH CHECK (private.is_super_admin((select auth.uid())));
CREATE POLICY "holidays_update" ON public.holidays_sv FOR UPDATE TO authenticated
  USING (private.is_super_admin((select auth.uid())))
  WITH CHECK (private.is_super_admin((select auth.uid())));
CREATE POLICY "holidays_delete" ON public.holidays_sv FOR DELETE TO authenticated
  USING (private.is_super_admin((select auth.uid())));

CREATE POLICY "attendance_select" ON public.attendances FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR private.has_admin_access((select auth.uid())));
CREATE POLICY "attendance_insert" ON public.attendances FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = (select auth.uid()) AND public.attendance_cutoff(saturday_date) > now())
    OR private.is_super_admin((select auth.uid()))
  );
CREATE POLICY "attendance_update" ON public.attendances FOR UPDATE TO authenticated
  USING (
    (user_id = (select auth.uid()) AND public.attendance_cutoff(saturday_date) > now())
    OR private.is_super_admin((select auth.uid()))
  )
  WITH CHECK (user_id = (select auth.uid()) OR private.is_super_admin((select auth.uid())));
CREATE POLICY "attendance_delete" ON public.attendances FOR DELETE TO authenticated
  USING (private.is_super_admin((select auth.uid())));

CREATE POLICY "settings_update" ON public.app_settings FOR UPDATE TO authenticated
  USING (private.is_super_admin((select auth.uid())))
  WITH CHECK (private.is_super_admin((select auth.uid())));
