import { useEffect, useMemo, useState } from "react";

// 10:00 -> 09:59 ... 00:00
export function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [target]);

  return useMemo(() => {
    if (!target) return { ms: 0, label: "—", expired: true };
    const ms = Math.max(0, target.getTime() - now);
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return { ms, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: ms <= 0 };
  }, [target, now]);
}
