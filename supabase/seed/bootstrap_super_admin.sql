-- =====================================================================
-- Bootstrap del super_admin (ejecutar UNA vez, después de crear tu usuario)
--
-- 1. Supabase Dashboard → Authentication → Users → "Add user"
--    (email + contraseña, marcar "Auto Confirm User").
-- 2. Cambiá el email abajo y ejecutá este script en SQL Editor.
-- =====================================================================
DO $$
DECLARE
  _email text := 'mauriciorivas00@gmail.com';  -- ← tu correo
  _uid   uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con email %', _email;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

  RAISE NOTICE 'Usuario % ahora es super_admin', _email;
END $$;
