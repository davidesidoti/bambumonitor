import { useEffect, useState } from "react";
import { usePrinterStore } from "@/store/printerStore";
import { formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";

export function ConnectionIndicator() {
  const { connected, lastUpdate } = usePrinterStore((s) => s.connection);
  const [, force] = useState(0);

  // Refresh "X seconds ago" label every 5s.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const label = connected ? "connesso" : "offline";
  const since = lastUpdate
    ? `agg. ${formatDistanceToNowStrict(new Date(lastUpdate), { locale: it })} fa`
    : "in attesa";

  return (
    <span
      className="hidden items-center gap-2 text-xs text-fg-3 sm:inline-flex"
      title={lastUpdate ?? "mai aggiornato"}
    >
      <span className={connected ? "pulse-dot ok" : "pulse-dot"} />
      <span className="mono">
        {label} · {since}
      </span>
    </span>
  );
}
