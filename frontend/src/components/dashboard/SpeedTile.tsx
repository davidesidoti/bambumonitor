import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SPEED_LABEL } from "@/lib/format";
import { useSetSpeed, type SpeedLevel } from "@/hooks/useControl";
import { cn } from "@/lib/cn";

const LEVELS: SpeedLevel[] = [1, 2, 3, 4];

export function SpeedTile({ current }: { current: number }) {
  const setSpeed = useSetSpeed();

  const onPick = async (level: SpeedLevel) => {
    if (level === current) return;
    try {
      await setSpeed.mutateAsync(level);
      toast.success(`Velocità: ${SPEED_LABEL[level]}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(`Cambio velocità fallito: ${msg}`);
    }
  };

  const label = SPEED_LABEL[current] ?? "—";
  const busy = setSpeed.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(
            "group flex min-w-[140px] flex-1 cursor-pointer flex-col gap-1 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad)] text-left transition-colors hover:bg-bg-2",
            "disabled:cursor-not-allowed disabled:opacity-70",
          )}
        >
          <div className="flex items-center gap-2">
            <span className="label">Velocità</span>
            {busy ? (
              <Loader2
                size={11}
                className="ml-auto animate-spin"
                stroke="var(--fg-3)"
              />
            ) : (
              <ChevronDown
                size={11}
                className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                stroke="var(--fg-3)"
              />
            )}
          </div>
          <div className="text-base font-semibold">{label}</div>
          <div className="text-xs text-fg-3">livello {current}/4 · clic per cambiare</div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {LEVELS.map((lv) => (
          <DropdownMenuItem
            key={lv}
            onSelect={() => onPick(lv)}
            disabled={busy}
            className={cn(
              "flex items-center justify-between",
              lv === current && "font-semibold text-brand",
            )}
          >
            <span>{SPEED_LABEL[lv]}</span>
            <span className="mono text-xs text-fg-3">{lv}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
