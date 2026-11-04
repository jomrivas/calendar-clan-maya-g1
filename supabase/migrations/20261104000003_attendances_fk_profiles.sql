-- attendances.user_id → profiles.id para habilitar el embed `profiles!inner(...)`
-- (bug heredado: sin esta FK PostgREST no resuelve la relación).
-- La cascada se mantiene: auth.users → profiles → attendances.
ALTER TABLE public.attendances DROP CONSTRAINT attendances_user_id_fkey;
ALTER TABLE public.attendances
  ADD CONSTRAINT attendances_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
