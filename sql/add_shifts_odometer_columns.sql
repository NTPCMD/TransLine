-- Add odometer fields to shifts table if they don't exist
ALTER TABLE IF EXISTS public.shifts
  ADD COLUMN IF NOT EXISTS odometer_reading numeric;

ALTER TABLE IF EXISTS public.shifts
  ADD COLUMN IF NOT EXISTS odometer_photo_url text;

-- If you prefer a separate odometer_entries table, create it like:
-- CREATE TABLE public.odometer_entries (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
--   vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
--   kms numeric NOT NULL,
--   photo_url text,
--   created_at timestamptz DEFAULT now()
-- );
