import { useEffect, useState } from "react";
import { Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { filamentColor } from "@/lib/filamentColors";
import { useUpdateFilament } from "@/hooks/useFilament";
import type { FilamentSetting } from "@/types/api";

interface Props {
  live: { type: string | null; color: string | null };
  fallback: FilamentSetting | undefined;
}

/**
 * Filament card with manual override.
 *
 * The Bambu A1 base has no AMS, no RFID/NFC reader, and the firmware does
 * not relay the filament type set in Bambu Studio over MQTT. So `live.type`
 * is almost always null on this hardware. We fall back to a user-set value
 * stored in the DB (`/api/filament/current`) and offer inline edit.
 */
export function FilamentTile({ live, fallback }: Props) {
  const update = useUpdateFilament();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [color, setColor] = useState("");

  const effective = {
    type: live.type ?? fallback?.type ?? "",
    color: live.color ?? fallback?.color ?? "",
  };
  const fromMqtt = !!live.type;

  useEffect(() => {
    setType(effective.type);
    setColor(effective.color);
  }, [effective.type, effective.color]);

  const save = async () => {
    try {
      await update.mutateAsync({ type, color });
      toast.success("Filamento aggiornato");
      setOpen(false);
    } catch (e) {
      toast.error("Errore salvataggio filamento");
      console.error(e);
    }
  };

  const display = effective.type || "—";
  const hint = fromMqtt
    ? effective.color || "rilevato dalla stampante"
    : effective.color
      ? `${effective.color} · impostato manualmente`
      : "imposta manualmente";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex min-w-[140px] flex-1 cursor-pointer flex-col gap-1 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad)] text-left transition-colors hover:bg-bg-2"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: filamentColor(effective.color),
                boxShadow: "0 0 0 1px var(--line)",
              }}
            />
            <span className="label">Filamento</span>
            <Edit2
              size={11}
              className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
              stroke="var(--fg-3)"
            />
          </div>
          <div className="text-base font-semibold">{display}</div>
          <div className="text-xs text-fg-3">{hint}</div>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filamento corrente</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-3">
            La A1 senza AMS non rileva il filamento, quindi lo impostiamo a
            mano. Verrà associato a tutte le prossime stampe.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="label">Tipo</span>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="PLA Generic, PETG, PLA-CF..."
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="label">Colore</span>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Giallo, Nero, Arancio Bambu..."
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annulla
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Salvo..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
