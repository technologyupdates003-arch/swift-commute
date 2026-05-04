
-- Enable scheduling extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add recurring fields to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_daily boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS departure_time time;

-- Backfill departure_time from existing departure_at for daily templates later set
UPDATE public.trips SET departure_time = (departure_at AT TIME ZONE 'Africa/Nairobi')::time
  WHERE departure_time IS NULL;

-- Function: roll forward daily trips
CREATE OR REPLACE FUNCTION public.roll_daily_trips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t record;
  _next_at timestamptz;
  _created int := 0;
  _tz text := 'Africa/Nairobi';
BEGIN
  FOR _t IN
    SELECT DISTINCT ON (route_id, bus_id, departure_time)
      id, company_id, route_id, bus_id, price, departure_time
    FROM public.trips
    WHERE is_daily = true
      AND departure_time IS NOT NULL
    ORDER BY route_id, bus_id, departure_time, departure_at DESC
  LOOP
    -- compute next occurrence: today or tomorrow in Nairobi tz
    _next_at := ((current_date + 1)::text || ' ' || _t.departure_time::text)::timestamp
                AT TIME ZONE _tz;

    -- skip if a trip already exists for this template at that slot
    IF NOT EXISTS (
      SELECT 1 FROM public.trips
      WHERE route_id = _t.route_id
        AND bus_id = _t.bus_id
        AND departure_at = _next_at
    ) THEN
      INSERT INTO public.trips (company_id, route_id, bus_id, price, departure_at, status, is_daily, departure_time)
      VALUES (_t.company_id, _t.route_id, _t.bus_id, _t.price, _next_at, 'scheduled', false, _t.departure_time);
      _created := _created + 1;
    END IF;
  END LOOP;
  RETURN _created;
END $$;

-- Schedule it daily at 00:05 UTC (03:05 Nairobi)
SELECT cron.unschedule('roll-daily-trips') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'roll-daily-trips'
);

SELECT cron.schedule(
  'roll-daily-trips',
  '5 0 * * *',
  $$ SELECT public.roll_daily_trips(); $$
);
