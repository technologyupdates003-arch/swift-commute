import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type SeatClass = "economy" | "business" | "vip";

export interface Seat {
  id: string;
  seat_number: string;
  class: SeatClass;
  row_index: number;
  col_index: number;
  price_multiplier: number;
}

interface SeatLock { trip_id: string; seat_id: string; locked_by_session: string | null; lock_expires_at: string }
interface BookedSeat { trip_id: string; seat_id: string | null }

interface Props {
  seats: Seat[];
  tripId: string;
  selectedSeatIds: string[];
  onToggle: (seat: Seat) => void;
  sessionToken: string;
  maxSelectable?: number;
}

const CLASS_BG: Record<SeatClass, string> = {
  economy:  "bg-sky-100 hover:bg-sky-200 text-sky-900 ring-sky-300",
  business: "bg-rose-100 hover:bg-rose-200 text-rose-900 ring-rose-300",
  vip:      "bg-amber-100 hover:bg-amber-200 text-amber-900 ring-amber-300",
};

const SeatMap = ({ seats, tripId, selectedSeatIds, onToggle, sessionToken, maxSelectable = 4 }: Props) => {
  const [locks, setLocks] = useState<SeatLock[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());

  // Load + subscribe to locks
  useEffect(() => {
    if (!tripId) return;
    let active = true;

    const load = async () => {
      const [{ data: ls }, { data: bs }] = await Promise.all([
        supabase.from("seat_locks").select("trip_id,seat_id,locked_by_session,lock_expires_at").eq("trip_id", tripId),
        supabase.from("bookings").select("trip_id,seat_id").eq("trip_id", tripId).eq("status", "paid"),
      ]);
      if (!active) return;
      setLocks((ls ?? []) as SeatLock[]);
      setBooked(new Set((bs ?? []).map((b: BookedSeat) => b.seat_id).filter(Boolean) as string[]));
    };
    load();

    const ch = supabase
      .channel(`trip-${tripId}-seats`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seat_locks", filter: `trip_id=eq.${tripId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings",   filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();

    // Drop expired locks every 15s on the client
    const t = setInterval(load, 15000);
    return () => { active = false; clearInterval(t); supabase.removeChannel(ch); };
  }, [tripId]);

  const lockMap = useMemo(() => {
    const m = new Map<string, SeatLock>();
    const now = Date.now();
    locks.forEach((l) => {
      if (new Date(l.lock_expires_at).getTime() > now) m.set(l.seat_id, l);
    });
    return m;
  }, [locks]);

  // Group seats by row_index
  const rows = useMemo(() => {
    const byRow = new Map<number, Seat[]>();
    seats.forEach((s) => {
      if (!byRow.has(s.row_index)) byRow.set(s.row_index, []);
      byRow.get(s.row_index)!.push(s);
    });
    return Array.from(byRow.entries())
      .sort(([a], [b]) => a - b)
      .map(([r, list]) => [r, list.sort((x, y) => x.col_index - y.col_index)] as const);
  }, [seats]);

  const maxCol = useMemo(
    () => seats.reduce((m, s) => Math.max(m, s.col_index), 0),
    [seats]
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <Legend swatch="bg-sky-100 ring-2 ring-sky-300" label="Economy" />
        <Legend swatch="bg-rose-100 ring-2 ring-rose-300" label="Business" />
        <Legend swatch="bg-amber-100 ring-2 ring-amber-300" label="VIP" />
        <Legend swatch="bg-yellow-300" label="Locked" />
        <Legend swatch="bg-secondary text-secondary-foreground" label="Selected (you)" />
        <Legend swatch="bg-muted-foreground/40" label="Booked" />
      </div>

      {/* Bus body */}
      <div className="mx-auto w-fit rounded-2xl border-2 border-muted bg-background p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-md bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Driver</span>
          <span className="rounded-md bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Door</span>
        </div>

        <div className="space-y-2">
          {rows.map(([rowIndex, rowSeats]) => (
            <div key={rowIndex} className="flex items-center gap-2">
              <span className="w-5 text-right text-[10px] font-bold text-muted-foreground">{rowIndex}</span>
              <div className="flex flex-1 items-center gap-2">
                {Array.from({ length: maxCol }).map((_, i) => {
                  const colIndex = i + 1;
                  const seat = rowSeats.find((s) => s.col_index === colIndex);
                  // Aisle = empty cell roughly in the middle (or wherever no seat is defined)
                  if (!seat) return <div key={colIndex} className="h-11 w-11 shrink-0" />;

                  const isBooked = booked.has(seat.id);
                  const lock = lockMap.get(seat.id);
                  const isLockedByMe = !!lock && lock.locked_by_session === sessionToken;
                  const isLockedByOther = !!lock && !isLockedByMe;
                  const isSelected = selectedSeatIds.includes(seat.id);

                  const disabled = isBooked || isLockedByOther || (!isSelected && selectedSeatIds.length >= maxSelectable);

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggle(seat)}
                      title={`${seat.seat_number} • ${seat.class.toUpperCase()}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-transform",
                        "ring-2 ring-inset",
                        !isBooked && !isLockedByOther && CLASS_BG[seat.class],
                        isLockedByOther && "cursor-not-allowed bg-yellow-300 text-yellow-900 ring-yellow-500",
                        isBooked && "cursor-not-allowed bg-muted-foreground/40 text-background ring-muted-foreground/40 line-through",
                        isSelected && "scale-105 bg-secondary text-secondary-foreground shadow-elegant ring-secondary",
                        !disabled && !isSelected && "hover:scale-105"
                      )}
                    >
                      {seat.seat_number}
                      {seat.class === "vip" && (
                        <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1 text-[8px] font-extrabold text-white">V</span>
                      )}
                      {seat.class === "business" && (
                        <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1 text-[8px] font-extrabold text-white">B</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {seats.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No seat layout configured for this bus yet.
          </p>
        )}
      </div>
    </div>
  );
};

const Legend = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn("inline-block h-4 w-4 rounded ring-2 ring-inset", swatch)} />
    {label}
  </span>
);

export default SeatMap;
