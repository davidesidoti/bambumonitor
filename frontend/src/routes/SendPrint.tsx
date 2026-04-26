import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { useSendJob, useUploadJob } from "@/hooks/useJobs";
import { PlateViewer3D } from "@/features/sendprint/PlateViewer3D";
import { PrintSettingsPanel } from "@/features/sendprint/PrintSettingsPanel";
import { AmsMappingPanel } from "@/features/sendprint/AmsMappingPanel";
import type { JobDetail } from "@/types/jobs";
import { cn } from "@/lib/cn";

export default function SendPrint() {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<number | null>(null);
  const [mapping, setMapping] = useState<number[]>([]);
  const [useAms, setUseAms] = useState(true);
  const [bedLeveling, setBedLeveling] = useState(true);
  const [vibrationCali, setVibrationCali] = useState(true);
  const [layerInspect, setLayerInspect] = useState(true);
  const [flowCali, setFlowCali] = useState(false);
  const [timelapse, setTimelapse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const upload = useUploadJob();
  const send = useSendJob(job?.id ?? null);

  const plates = job?.metadata.plates ?? [];
  const filaments = useMemo(
    () => job?.metadata.filaments ?? [],
    [job],
  );
  const currentPlate = plates.find((p) => p.index === selectedPlate) ?? null;

  useEffect(() => {
    if (!job) {
      setSelectedPlate(null);
      return;
    }
    setSelectedPlate(job.metadata.plates[0]?.index ?? null);
    setMapping(job.metadata.filaments.map((_, i) => i));
  }, [job]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (j) => {
        setJob(j);
        toast.success(`Caricato ${j.original_filename}`, {
          description: `${j.plate_count} piatto/i, ${j.metadata.filaments.length} filamento/i`,
        });
      },
      onError: (err) => {
        toast.error("Upload fallito", { description: extractMessage(err) });
      },
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSend = () => {
    if (!job || selectedPlate == null) return;
    if (mapping.length !== filaments.length) {
      toast.error("Mappatura AMS incompleta");
      return;
    }
    send.mutate(
      {
        plate: selectedPlate,
        ams_mapping: mapping,
        use_ams: useAms,
        bed_leveling: bedLeveling,
        flow_cali: flowCali,
        vibration_cali: vibrationCali,
        layer_inspect: layerInspect,
        timelapse,
      },
      {
        onSuccess: (r) => {
          toast.success("Job inviato", { description: r.detail });
        },
        onError: (err) => {
          toast.error("Invio fallito", { description: extractMessage(err) });
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertTitle>Solo .3mf pre-slicati</AlertTitle>
        <AlertDescription>
          Esporta il progetto da Bambu Studio con "Export plate sliced 3mf".
          La stampa parte direttamente in modalità LAN.
        </AlertDescription>
      </Alert>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              {job ? job.original_filename : "Nessun progetto caricato"}
            </div>
            <div className="text-xs text-fg-3">
              {job
                ? `${(job.size_bytes / 1024 / 1024).toFixed(1)} MB · ${job.plate_count} piatti`
                : "Carica un file .3mf per iniziare"}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".3mf"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? "Caricamento…" : job ? "Sostituisci" : "Carica .3mf"}
            </Button>
            {job && (
              <Button onClick={onSend} disabled={send.isPending || selectedPlate == null}>
                {send.isPending ? "Invio…" : "Invia alla stampante"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {job && plates.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {plates.map((p) => (
                <button
                  key={p.index}
                  type="button"
                  onClick={() => setSelectedPlate(p.index)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border bg-bg-2 px-3 py-1.5 text-xs",
                    selectedPlate === p.index && "border-fg-2 bg-bg-3",
                  )}
                >
                  {p.has_thumbnail && (
                    <img
                      src={`/api/jobs/${job.id}/thumbnail/${p.index}`}
                      alt=""
                      className="h-8 w-8 rounded-sm object-cover"
                    />
                  )}
                  <span>Piatto {p.index}</span>
                </button>
              ))}
            </div>
            {selectedPlate != null && <PlateViewer3D jobId={job.id} key={job.id} />}
          </div>

          <div className="grid gap-4">
            <PrintSettingsPanel
              settings={job.metadata.settings}
              plate={currentPlate}
            />
            <AmsMappingPanel
              filaments={filaments}
              useAms={useAms}
              onUseAmsChange={setUseAms}
              mapping={mapping}
              onMappingChange={setMapping}
            />
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 text-sm font-semibold">Opzioni stampa</div>
              <div className="grid gap-2">
                <Toggle
                  label="Auto bed leveling"
                  value={bedLeveling}
                  onChange={setBedLeveling}
                />
                <Toggle
                  label="Vibration calibration"
                  value={vibrationCali}
                  onChange={setVibrationCali}
                />
                <Toggle
                  label="Layer inspection"
                  value={layerInspect}
                  onChange={setLayerInspect}
                />
                <Toggle
                  label="Flow calibration"
                  value={flowCali}
                  onChange={setFlowCali}
                />
                <Toggle
                  label="Timelapse"
                  value={timelapse}
                  onChange={setTimelapse}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </Label>
  );
}

function extractMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (
      err.body &&
      typeof err.body === "object" &&
      "detail" in err.body
    ) {
      return String((err.body as { detail: unknown }).detail);
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
