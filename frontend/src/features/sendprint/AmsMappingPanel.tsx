import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/features/settings/SectionCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { autoMapAms, type AmsSlot } from "./colorMatch";
import type { ProjectFilament } from "@/types/jobs";

interface Props {
  filaments: ProjectFilament[];
  useAms: boolean;
  onUseAmsChange: (v: boolean) => void;
  mapping: number[];
  onMappingChange: (m: number[]) => void;
}

const AMS_SLOT_COUNT = 4;

export function AmsMappingPanel({
  filaments,
  useAms,
  onUseAmsChange,
  mapping,
  onMappingChange,
}: Props) {
  const [slots, setSlots] = useState<AmsSlot[]>(() =>
    Array.from({ length: AMS_SLOT_COUNT }, (_, i) => ({
      index: i,
      color: null,
      type: null,
    })),
  );
  const [autoApplied, setAutoApplied] = useState(false);

  const projectColors = useMemo(
    () => filaments.map((f) => f.color),
    [filaments],
  );

  useEffect(() => {
    if (autoApplied || filaments.length === 0) return;
    onMappingChange(filaments.map((_, i) => i));
    setAutoApplied(true);
  }, [filaments, autoApplied, onMappingChange]);

  const updateSlot = (idx: number, patch: Partial<AmsSlot>) => {
    setSlots((s) =>
      s.map((slot) => (slot.index === idx ? { ...slot, ...patch } : slot)),
    );
  };

  const updateMappingAt = (filamentIdx: number, slot: number) => {
    const next = [...mapping];
    while (next.length <= filamentIdx) next.push(-1);
    next[filamentIdx] = slot;
    onMappingChange(next);
  };

  const runAuto = () => {
    onMappingChange(autoMapAms(projectColors, slots));
  };

  return (
    <SectionCard
      title="Filamenti AMS"
      description="Associa ogni filamento del progetto a uno slot AMS, oppure 'esterno' per la bobina libera."
      action={
        <Label className="cursor-pointer text-xs">
          <Switch checked={useAms} onCheckedChange={onUseAmsChange} />
          <span>Usa AMS</span>
        </Label>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="mb-2 text-xs font-medium text-fg-2">
            Colori AMS configurati
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <div
                key={slot.index}
                className="flex items-center gap-2 rounded-md border bg-bg-2 px-2 py-1"
              >
                <div
                  className="h-5 w-5 rounded-sm border border-line"
                  style={{ background: slot.color ?? "transparent" }}
                />
                <Input
                  className="h-7 flex-1 text-xs"
                  value={slot.color ?? ""}
                  placeholder={`Slot ${slot.index + 1} #RRGGBB`}
                  onChange={(e) => updateSlot(slot.index, { color: e.target.value || null })}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-fg-3 underline hover:text-fg"
            onClick={runAuto}
          >
            Auto-match colori
          </button>
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-medium text-fg-2">
            Filamenti del progetto ({filaments.length})
          </div>
          {filaments.map((f, i) => (
            <div
              key={f.index}
              className="flex items-center gap-3 rounded-md border bg-bg-2 px-3 py-2"
            >
              <div
                className="h-6 w-6 rounded-sm border border-line"
                style={{ background: f.color }}
              />
              <div className="flex-1 text-sm">
                <div className="mono">{f.color}</div>
                <div className="text-xs text-fg-3">
                  {f.type}
                  {f.filament_id ? ` · ${f.filament_id}` : ""}
                </div>
              </div>
              <Select
                value={String(mapping[i] ?? -1)}
                onValueChange={(v) => updateMappingAt(i, Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">Esterno</SelectItem>
                  {Array.from({ length: AMS_SLOT_COUNT }, (_, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Slot {idx + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
