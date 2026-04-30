-- ============== ENUMS ==============
DO $$ BEGIN
  CREATE TYPE public.seat_class AS ENUM ('economy', 'business', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== SEATS ==============
CREATE TABLE IF NOT EXISTS public.seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  seat_number text NOT NULL,
  class public.seat_class NOT NULL DEFAULT 'economy',
  row_index integer NOT NULL,
  col_index integer NOT NULL,
  price_multiplier numeric NOT NULL DEFAULT 1.0 CHECK (price_multiplier > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bus_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_seats_bus ON public.seats(bus_id);
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY seats_public_read ON public.seats
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY seats_company_write ON public.seats
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.buses b
                 WHERE b.id = seats.bus_id
                   AND public.has_company_role(auth.uid(), 'company_admin', b.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.buses b
                      WHERE b.id = seats.bus_id
                        AND public.has_company_role(auth.uid(), 'company_admin', b.company_id)));

CREATE POLICY seats_super_all ON public.seats
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ============== SEAT LOCKS ==============
CREATE TABLE IF NOT EXISTS public.seat_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_id uuid NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  locked_by_session text,
  locked_by_user uuid,
  lock_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_locks_trip_seat_uniq UNIQUE (trip_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_seat_locks_trip ON public.seat_locks(trip_id);
CREATE INDEX IF NOT EXISTS idx_seat_locks_session ON public.seat_locks(locked_by_session);
CREATE INDEX IF NOT EXISTS idx_seat_locks_expires ON public.seat_locks(lock_expires_at);

ALTER TABLE public.seat_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY seat_locks_public_read ON public.seat_locks
  FOR SELECT TO anon, authenticated USING (true);

-- ============== BOOKINGS: link to seats ==============
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES public.seats(id),
  ADD COLUMN IF NOT EXISTS seat_class public.seat_class;

-- One paid booking per seat per trip
CREATE UNIQUE INDEX IF NOT EXISTS uniq_paid_booking_per_seat
  ON public.bookings(trip_id, seat_id)
  WHERE status = 'paid' AND seat_id IS NOT NULL;

-- ============== RPC: lock_seats ==============
CREATE OR REPLACE FUNCTION public.lock_seats(
  _trip_id uuid,
  _seat_ids uuid[],
  _session_token text,
  _ttl_minutes integer DEFAULT 10
) RETURNS TABLE (seat_id uuid, lock_id uuid, lock_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _expires_at timestamptz := now() + make_interval(mins => _ttl_minutes);
  _user uuid := auth.uid();
  _seat uuid;
  _new_id uuid;
BEGIN
  IF _session_token IS NULL OR length(_session_token) < 10 THEN
    RAISE EXCEPTION 'Invalid session token';
  END IF;
  IF array_length(_seat_ids, 1) IS NULL OR array_length(_seat_ids, 1) > 6 THEN
    RAISE EXCEPTION 'Select between 1 and 6 seats';
  END IF;

  DELETE FROM public.seat_locks
   WHERE trip_id = _trip_id AND lock_expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.bookings
     WHERE trip_id = _trip_id
       AND bookings.seat_id = ANY(_seat_ids)
       AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'One or more seats are already booked';
  END IF;

  FOREACH _seat IN ARRAY _seat_ids LOOP
    UPDATE public.seat_locks sl
       SET lock_expires_at = _expires_at
     WHERE sl.trip_id = _trip_id
       AND sl.seat_id = _seat
       AND (sl.locked_by_session = _session_token
            OR (_user IS NOT NULL AND sl.locked_by_user = _user))
     RETURNING sl.id INTO _new_id;

    IF _new_id IS NULL THEN
      BEGIN
        INSERT INTO public.seat_locks (trip_id, seat_id, locked_by_session, locked_by_user, lock_expires_at)
        VALUES (_trip_id, _seat, _session_token, _user, _expires_at)
        RETURNING id INTO _new_id;
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Seat % is being held by another user. Please pick a different seat.', _seat;
      END;
    END IF;

    seat_id := _seat;
    lock_id := _new_id;
    lock_expires_at := _expires_at;
    RETURN NEXT;
    _new_id := NULL;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_seats(uuid, uuid[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_seats(uuid, uuid[], text, integer) TO anon, authenticated;

-- ============== RPC: release_seat_lock ==============
CREATE OR REPLACE FUNCTION public.release_seat_lock(
  _trip_id uuid,
  _seat_id uuid,
  _session_token text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.seat_locks sl
   WHERE sl.trip_id = _trip_id
     AND sl.seat_id = _seat_id
     AND (sl.locked_by_session = _session_token
          OR (auth.uid() IS NOT NULL AND sl.locked_by_user = auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public.release_seat_lock(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_seat_lock(uuid, uuid, text) TO anon, authenticated;

-- ============== RPC: confirm_booking_payment ==============
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  _booking_id uuid,
  _session_token text
) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _b public.bookings;
BEGIN
  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF _b.status = 'paid' THEN RETURN _b; END IF;

  IF _b.seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.seat_locks sl
       WHERE sl.trip_id = _b.trip_id
         AND sl.seat_id = _b.seat_id
         AND sl.lock_expires_at > now()
         AND (sl.locked_by_session = _session_token
              OR (auth.uid() IS NOT NULL AND sl.locked_by_user = auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Your seat reservation has expired. Please pick a new seat.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.bookings
       WHERE trip_id = _b.trip_id
         AND seat_id = _b.seat_id
         AND id <> _b.id
         AND status = 'paid'
    ) THEN
      RAISE EXCEPTION 'Seat just got booked by someone else.';
    END IF;
  END IF;

  UPDATE public.bookings SET status = 'paid' WHERE id = _booking_id RETURNING * INTO _b;

  IF _b.seat_id IS NOT NULL THEN
    DELETE FROM public.seat_locks WHERE trip_id = _b.trip_id AND seat_id = _b.seat_id;
  END IF;

  IF _b.discount_id IS NOT NULL THEN
    UPDATE public.discounts SET used_count = used_count + 1 WHERE id = _b.discount_id;
  END IF;

  RETURN _b;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_booking_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid, text) TO anon, authenticated;

-- ============== RPC: expire_seat_locks (cron) ==============
CREATE OR REPLACE FUNCTION public.expire_seat_locks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH d AS (DELETE FROM public.seat_locks WHERE lock_expires_at <= now() RETURNING 1)
  SELECT count(*) INTO _n FROM d;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_seat_locks() FROM PUBLIC;

-- ============== Realtime ==============
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_locks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.seat_locks REPLICA IDENTITY FULL;
ALTER TABLE public.bookings   REPLICA IDENTITY FULL;

-- ============== pg_cron ==============
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-seat-locks-every-minute');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'expire-seat-locks-every-minute',
  '* * * * *',
  $$ SELECT public.expire_seat_locks(); $$
);
