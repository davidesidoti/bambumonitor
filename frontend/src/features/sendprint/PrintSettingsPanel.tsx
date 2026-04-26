import { SectionCard } from "@/features/settings/SectionCard";
import type { PlateInfo, ProjectSettings } from "@/types/jobs";

interface Props {
  settings: ProjectSettings;
  plate: PlateInfo | null;
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBool(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Sì" : "No";
}

export function PrintSettingsPanel({ settings, plate }: Props) {
  return (
    <SectionCard
      title="Impostazioni progetto"
      description="Estratte dal file .3mf (sola lettura)."
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Stampante" value={settings.printer_model ?? "—"} />
        <Row label="Piatto" value={settings.bed_type ?? "—"} />
        <Row
          label="Diametro ugello"
          value={
            settings.nozzle_diameter ? `${settings.nozzle_diameter} mm` : "—"
          }
        />
        <Row
          label="Altezza layer"
          value={settings.layer_height ? `${settings.layer_height} mm` : "—"}
        />
        <Row
          label="Riempimento"
          value={settings.sparse_infill_density ?? "—"}
        />
        <Row label="Supporti" value={fmtBool(settings.enable_support)} />
        <Row label="Tipo supporto" value={settings.support_type ?? "—"} />
        <Row label="Prime tower" value={fmtBool(settings.enable_prime_tower)} />
        {plate && (
          <>
            <Row
              label="Durata stimata"
              value={fmtDuration(plate.estimated_seconds)}
            />
            <Row
              label="Filamento"
              value={
                plate.weight_grams != null
                  ? `${plate.weight_grams.toFixed(1)} g`
                  : "—"
              }
            />
          </>
        )}
      </dl>
    </SectionCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className="mono text-right text-fg">{value}</dd>
    </>
  );
}
