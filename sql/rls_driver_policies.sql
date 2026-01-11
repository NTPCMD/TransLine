-- RLS policies for driver app (examples). Adjust table and column names if your schema differs.

-- 1) Allow drivers to read their own drivers row
ALTER TABLE IF EXISTS public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "drivers_select_own" ON public.drivers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "drivers_update_own" ON public.drivers FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2) Vehicles: allow a driver to read/write the vehicle that is assigned to them (if using vehicles.assigned_driver_id)
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "vehicles_select_assigned" ON public.vehicles FOR SELECT USING (assigned_driver_id IS NOT NULL AND assigned_driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "vehicles_update_assigned" ON public.vehicles FOR UPDATE USING (assigned_driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid())) WITH CHECK (assigned_driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- 3) driver_vehicles join table (if you have active assignments there)
ALTER TABLE IF EXISTS public.driver_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT_EXISTS "driver_vehicles_select_own" ON public.driver_vehicles FOR SELECT USING (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY IF NOT_EXISTS "driver_vehicles_insert_own" ON public.driver_vehicles FOR INSERT WITH CHECK (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- 4) Odometer entries (example table: odometer_entries). Ensure drivers can only read and insert their own entries
ALTER TABLE IF EXISTS public.odometer_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "odometer_select_own" ON public.odometer_entries FOR SELECT USING (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY IF NOT_EXISTS "odometer_insert_own" ON public.odometer_entries FOR INSERT WITH CHECK (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- 5) Shifts: drivers can create a shift only for themselves
ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "shifts_insert_own" ON public.shifts FOR INSERT WITH CHECK (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY IF NOT_EXISTS "shifts_select_own" ON public.shifts FOR SELECT USING (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Notes:
-- - Supabase's `auth.uid()` returns the authenticated user's uuid from the JWT. The `drivers.user_id` column should store that UID (or use `auth_user_id`).
-- - For admin or service roles, create separate policies allowing access based on `auth.role()` or using `policy_name` conditions.
-- - If your schema uses different table/column names, adapt the queries above accordingly.
