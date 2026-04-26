import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SectionCard } from "@/features/settings/SectionCard";

interface WebcamSettings {
  device: string;
  resolution: string;
  desired_fps: number;
  host: string;
  port: number;
  drop_same_frames: number;

  auto_exposure: boolean;
  exposure_dynamic_framerate: boolean;
  exposure_time_absolute: number;

  brightness: number;
  contrast: number;
  saturation: number;
  gain: number;
  gamma: number;
  sharpness: number;
  backlight_compensation: number;

  white_balance_automatic: boolean;
  power_line_frequency: number;

  extra_ctrls: Record<string, string>;
}

const RESOLUTIONS = ["640x480", "1280x720", "1920x1080"];
const POWER_LINE_OPTIONS = [
  { value: 0, label: "Disabilitato" },
  { value: 1, label: "50 Hz (Europa)" },
  { value: 2, label: "60 Hz (USA/JP)" },
];

export function WebcamSettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<WebcamSettings>({
    queryKey: ["settings", "webcam"],
    queryFn: () => apiFetch<WebcamSettings>("/settings/webcam"),
  });
  const [form, setForm] = useState<WebcamSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: WebcamSettings) =>
      apiFetch<{ restarted: boolean }>("/settings/webcam", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Webcam riavviata.", {
        description: "Lo stream MJPEG riprenderà tra qualche secondo.",
      });
      qc.invalidateQueries({ queryKey: ["settings", "webcam"] });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError
          ? typeof e.body === "object" && e.body && "detail" in e.body
            ? String((e.body as { detail: unknown }).detail)
            : e.message
          : (e as Error).message;
      toast.error("Errore salvataggio", { description: msg });
    },
  });

  if (isLoading || !form) {
    return <div className="text-sm text-fg-3">Caricamento…</div>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Impossibile caricare i settaggi webcam</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Errore sconosciuto"}
        </AlertDescription>
      </Alert>
    );
  }

  const update = <K extends keyof WebcamSettings>(
    k: K,
    v: WebcamSettings[K],
  ) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const customResolution = !RESOLUTIONS.includes(form.resolution);
  const extraCtrlEntries = Object.entries(form.extra_ctrls);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <SectionCard
        title="Sorgente video"
        description="Periferica e endpoint del processo ustreamer."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Device"
            help="Es. /dev/video0 oppure /dev/v4l/by-id/usb-..."
          >
            <Input
              value={form.device}
              onChange={(e) => update("device", e.target.value)}
              placeholder="/dev/video0"
              spellCheck={false}
            />
          </Field>
          <Field label="Risoluzione">
            <Select
              value={customResolution ? "custom" : form.resolution}
              onValueChange={(v) => {
                if (v !== "custom") update("resolution", v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                {customResolution && (
                  <SelectItem value="custom">{form.resolution}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="FPS desiderati">
            <Input
              type="number"
              min={1}
              max={120}
              value={form.desired_fps}
              onChange={(e) => update("desired_fps", Number(e.target.value))}
            />
          </Field>
          <Field label="Drop same frames">
            <Input
              type="number"
              min={0}
              max={60}
              value={form.drop_same_frames}
              onChange={(e) =>
                update("drop_same_frames", Number(e.target.value))
              }
            />
          </Field>
          <Field label="Host">
            <Input
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
              placeholder="127.0.0.1"
            />
          </Field>
          <Field label="Porta">
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => update("port", Number(e.target.value))}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Esposizione"
        description="Auto, framerate dinamico e tempo manuale (in unità v4l2)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Label className="cursor-pointer">
            <Switch
              checked={form.auto_exposure}
              onCheckedChange={(v) => update("auto_exposure", v)}
            />
            <span>Esposizione automatica</span>
          </Label>
          <Label className="cursor-pointer">
            <Switch
              checked={form.exposure_dynamic_framerate}
              onCheckedChange={(v) => update("exposure_dynamic_framerate", v)}
            />
            <span>Framerate dinamico (auto-FPS in scarsa luce)</span>
          </Label>
          {!form.auto_exposure && (
            <NumberSliderField
              label="Tempo di esposizione"
              value={form.exposure_time_absolute}
              min={1}
              max={10000}
              onValueChange={(v) => update("exposure_time_absolute", v)}
              className="sm:col-span-2"
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Bilanciamento del bianco e rete"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Label className="cursor-pointer">
            <Switch
              checked={form.white_balance_automatic}
              onCheckedChange={(v) => update("white_balance_automatic", v)}
            />
            <span>Bilanciamento bianco automatico</span>
          </Label>
          <Field label="Frequenza rete (anti-flicker)">
            <Select
              value={String(form.power_line_frequency)}
              onValueChange={(v) => update("power_line_frequency", Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POWER_LINE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Controlli immagine (v4l2)"
        description="I range dipendono dalla webcam. La luminosità accetta valori negativi."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberSliderField
            label="Luminosità"
            value={form.brightness}
            min={-255}
            max={255}
            onValueChange={(v) => update("brightness", v)}
          />
          <NumberSliderField
            label="Contrasto"
            value={form.contrast}
            min={0}
            max={255}
            onValueChange={(v) => update("contrast", v)}
          />
          <NumberSliderField
            label="Saturazione"
            value={form.saturation}
            min={0}
            max={255}
            onValueChange={(v) => update("saturation", v)}
          />
          <NumberSliderField
            label="Gain"
            value={form.gain}
            min={0}
            max={255}
            onValueChange={(v) => update("gain", v)}
          />
          <NumberSliderField
            label="Gamma"
            value={form.gamma}
            min={0}
            max={500}
            onValueChange={(v) => update("gamma", v)}
          />
          <NumberSliderField
            label="Nitidezza"
            value={form.sharpness}
            min={0}
            max={255}
            onValueChange={(v) => update("sharpness", v)}
          />
          <NumberSliderField
            label="Compensazione controluce"
            value={form.backlight_compensation}
            min={0}
            max={10}
            onValueChange={(v) => update("backlight_compensation", v)}
          />
        </div>
      </SectionCard>

      {extraCtrlEntries.length > 0 && (
        <SectionCard
          title="Controlli aggiuntivi"
          description="Letti dal drop-in esistente, salvati invariati."
        >
          <ul className="grid gap-1 text-sm">
            {extraCtrlEntries.map(([k, v]) => (
              <li key={k} className="mono flex justify-between">
                <span>{k}</span>
                <span className="text-fg-3">{v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Riavvio…" : "Salva e riavvia ustreamer"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-fg-2">{label}</span>
      {children}
      {help && <span className="text-xs text-fg-3">{help}</span>}
    </label>
  );
}

function NumberSliderField({
  label,
  value,
  min,
  max,
  onValueChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 text-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        <Input
          type="number"
          className="h-7 w-24 text-right"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
        />
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onValueChange(v)}
      />
      <div className="flex justify-between text-[10px] text-fg-4">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
