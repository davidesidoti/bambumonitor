import { Lightbulb, LightbulbOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSetChamberLight } from "@/hooks/useControl";
import { cn } from "@/lib/cn";

export function ChamberLightTile({ current }: { current: boolean }) {
  const setChamberLight = useSetChamberLight();

  const onToggle = async () => {
    const next = !current;
    try {
      await setChamberLight.mutateAsync(next);
      toast.success(next ? "Lucetta accesa" : "Lucetta spenta");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(`Cambio luce fallito: ${msg}`);
    }
  };

  const busy = setChamberLight.isPending;
  const Icon = current ? Lightbulb : LightbulbOff;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className={cn(
        "group flex min-w-[140px] flex-1 cursor-pointer flex-col gap-1 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad)] text-left transition-colors hover:bg-bg-2",
        "disabled:cursor-not-allowed disabled:opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="label">Lucetta</span>
        {busy ? (
          <Loader2
            size={11}
            className="ml-auto animate-spin"
            stroke="var(--fg-3)"
          />
        ) : (
          <Icon
            size={11}
            className="ml-auto"
            stroke={current ? "var(--brand)" : "var(--fg-3)"}
          />
        )}
      </div>
      <div className="text-base font-semibold">
        {current ? "Accesa" : "Spenta"}
      </div>
      <div className="text-xs text-fg-3">clic per {current ? "spegnere" : "accendere"}</div>
    </button>
  );
}
