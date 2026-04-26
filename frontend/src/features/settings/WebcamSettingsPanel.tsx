import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  exposure: number;
  gain: number;
  contrast: number;
  brightness: number;
}

const RESOLUTIONS = ["640x480", "1280x720", "1920x1080"];

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
          <Field label="Device">
            <Input
              value={form.device}
              onChange={(e) => update("device", e.target.value)}
              placeholder="/dev/video0"
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
              max={60}
              value={form.desired_fps}
              onChange={(e) => update("desired_fps", Number(e.target.value))}
            />
          </Field>
          <Field label="Drop same frames">
            <Input
              type="number"
              min={0}
              max={30}
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
        title="Controlli immagine (v4l2)"
        description="Applicati come ExecStartPre prima di avviare ustreamer. I range dipendono dalla webcam."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SliderField
            label="Esposizione"
            value={form.exposure}
            min={1}
            max={10000}
            onValueChange={(v) => update("exposure", v)}
          />
          <SliderField
            label="Gain"
            value={form.gain}
            min={0}
            max={100}
            onValueChange={(v) => update("gain", v)}
          />
          <SliderField
            label="Contrasto"
            value={form.contrast}
            min={0}
            max={255}
            onValueChange={(v) => update("contrast", v)}
          />
          <SliderField
            label="Luminosità"
            value={form.brightness}
            min={0}
            max={255}
            onValueChange={(v) => update("brightness", v)}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Riavvio…" : "Salva e riavvia ustreamer"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-fg-2">{label}</span>
      {children}
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-2">{label}</span>
        <span className="mono text-xs tabular-nums">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onValueChange(v)}
      />
    </div>
  );
}
