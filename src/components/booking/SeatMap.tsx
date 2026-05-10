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
  economy:  "bg-sky-200 hover:bg-sky-300 text-slate-900 ring-sky-500",
  business: "bg-rose-200 hover:bg-rose-300 text-slate-900 ring-rose-500",
  vip:      "bg-amber-200 hover:bg-amber-300 text-slate-900 ring-amber-500",
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
      <div className="mx-auto w-fit rounded-[2rem] border-2 border-primary/40 bg-zinc-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-primary" /> Driver
          </span>
          <div className="h-1 flex-1 rounded-full bg-zinc-800" />
          <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200">Door</span>
        </div>

        <div className="space-y-2.5">
          {rows.map(([rowIndex, rowSeats]) => (
            <div key={rowIndex} className="flex items-center gap-2">
              <span className="w-6 text-right text-[11px] font-extrabold text-zinc-400">{rowIndex}</span>
              <div className="flex flex-1 items-center gap-2">
                {Array.from({ length: maxCol }).map((_, i) => {
                  const colIndex = i + 1;
                  const seat = rowSeats.find((s) => s.col_index === colIndex);
                  if (!seat) return <div key={colIndex} className="h-12 w-12 shrink-0" />;

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
                        "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tracking-tight transition-all",
                        "ring-2 ring-inset shadow-md",
                        !isBooked && !isLockedByOther && CLASS_BG[seat.class],
                        isLockedByOther && "cursor-not-allowed bg-yellow-400 text-yellow-950 ring-yellow-600",
                        isBooked && "cursor-not-allowed bg-zinc-700 text-zinc-400 ring-zinc-600 line-through",
                        isSelected && "scale-110 bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.4)] ring-primary",
                        !disabled && !isSelected && "hover:scale-110"
                      )}
                    >
                      <span className="drop-shadow-sm">{seat.seat_number}</span>
                      {seat.class === "vip" && (
                        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-zinc-900">V</span>
                      )}
                      {seat.class === "business" && (
                        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-zinc-900">B</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {seats.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-400">
            No seat layout configured for this bus yet.
          </p>
        )}

        <div className="mt-4 flex justify-center">
          <span className="rounded-full bg-zinc-800 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Rear</span>
        </div>
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
