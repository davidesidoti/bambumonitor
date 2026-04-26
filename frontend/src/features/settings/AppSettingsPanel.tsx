import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/features/settings/SectionCard";

const ACCESS_CODE_MASK = "********";

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

interface AppSettings {
  printer_ip: string;
  printer_serial: string;
  printer_access_code: string;
  log_level: LogLevel;
  dev_mode: boolean;
  ustreamer_url: string;
  telemetry_interval_seconds: number;
  ws_heartbeat_interval_seconds: number;
}

export function AppSettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<AppSettings>({
    queryKey: ["settings", "app"],
    queryFn: () => apiFetch<AppSettings>("/settings/app"),
  });

  const [form, setForm] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (body: AppSettings) =>
      apiFetch<{ restart_scheduled: boolean }>("/settings/app", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Salvato. Riavvio backend in corso...", {
        description: "L'interfaccia si riconnetterà automaticamente.",
      });
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ["settings", "app"] }),
        7000,
      );
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError ? formatApiError(e) : (e as Error).message;
      toast.error("Errore salvataggio", { description: msg });
    },
  });

  if (isLoading || !form) {
    return <div className="text-sm text-fg-3">Caricamento…</div>;
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Impossibile caricare i settaggi</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Errore sconosciuto"}
        </AlertDescription>
      </Alert>
    );
  }

  const update = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <Alert variant="warning">
        <AlertTitle>Riavvio richiesto</AlertTitle>
        <AlertDescription>
          Salvare queste impostazioni riavvia il backend. La connessione live
          cadrà per qualche secondo.
        </AlertDescription>
      </Alert>

      <SectionCard
        title="Stampante"
        description="Credenziali e indirizzo MQTT della Bambu Lab A1."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IP stampante">
            <Input
              value={form.printer_ip}
              onChange={(e) => update("printer_ip", e.target.value)}
              placeholder="192.168.1.100"
            />
          </Field>
          <Field label="Numero seriale">
            <Input
              value={form.printer_serial}
              onChange={(e) =>
                update("printer_serial", e.target.value.toUpperCase())
              }
              maxLength={14}
              minLength={14}
              placeholder="14 caratteri"
            />
          </Field>
          <Field label="Codice di accesso">
            <Input
              type="password"
              value={form.printer_access_code}
              onChange={(e) => update("printer_access_code", e.target.value)}
              onFocus={(e) => {
                if (e.currentTarget.value === ACCESS_CODE_MASK) {
                  update("printer_access_code", "");
                }
              }}
              onBlur={(e) => {
                if (e.currentTarget.value === "") {
                  update("printer_access_code", ACCESS_CODE_MASK);
                }
              }}
              placeholder="8 cifre"
              maxLength={8}
            />
          </Field>
          <Field label="URL ustreamer">
            <Input
              value={form.ustreamer_url}
              onChange={(e) => update("ustreamer_url", e.target.value)}
              placeholder="http://127.0.0.1:9999"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Intervalli"
        description="Telemetria e heartbeat WebSocket."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telemetria (s)">
            <Input
              type="number"
              min={1}
              max={300}
              value={form.telemetry_interval_seconds}
              onChange={(e) =>
                update("telemetry_interval_seconds", Number(e.target.value))
              }
            />
          </Field>
          <Field label="Heartbeat WS (s)">
            <Input
              type="number"
              min={5}
              max={300}
              value={form.ws_heartbeat_interval_seconds}
              onChange={(e) =>
                update(
                  "ws_heartbeat_interval_seconds",
                  Number(e.target.value),
                )
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Diagnostica"
        description="Log e modalità sviluppo."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Livello log">
            <Select
              value={form.log_level}
              onValueChange={(v) => update("log_level", v as LogLevel)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBUG">DEBUG</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARNING">WARNING</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Label className="mt-6 cursor-pointer">
            <Switch
              checked={form.dev_mode}
              onCheckedChange={(v) => update("dev_mode", v)}
            />
            <span>Modalità sviluppo (CORS aperto)</span>
          </Label>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvataggio…" : "Salva e riavvia"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-fg-2">{label}</span>
      {children}
    </label>
  );
}

function formatApiError(e: ApiError): string {
  if (e.body && typeof e.body === "object" && "detail" in e.body) {
    const d = (e.body as { detail: unknown }).detail;
    if (Array.isArray(d)) {
      return d
        .map((it) => {
          const r = it as { loc?: unknown[]; msg?: string };
          const loc = Array.isArray(r.loc) ? r.loc.join(".") : "";
          return loc ? `${loc}: ${r.msg ?? ""}` : (r.msg ?? "");
        })
        .join("\n");
    }
    return String(d);
  }
  return e.message;
}
