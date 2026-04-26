import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionCard } from "@/features/settings/SectionCard";
import { openSse } from "@/lib/sse";

interface VersionInfo {
  version: string;
  git_sha: string;
  branch: string;
}

type RunState = "idle" | "running" | "done";

export function SystemPanel() {
  const { data, isLoading } = useQuery<VersionInfo>({
    queryKey: ["settings", "version"],
    queryFn: () => apiFetch<VersionInfo>("/settings/version"),
  });

  const [open, setOpen] = useState(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(
    () => () => {
      closeRef.current?.();
    },
    [],
  );

  const startUpdate = () => {
    setLogs([]);
    setExitCode(null);
    setRunState("running");
    setOpen(true);
    closeRef.current = openSse(
      "/api/settings/update/stream",
      (e) => {
        if (e.event === "log" || e.event === "message") {
          setLogs((prev) => [...prev, e.data]);
        } else if (e.event === "error") {
          setLogs((prev) => [...prev, `[errore] ${e.data}`]);
        } else if (e.event === "done") {
          const code = Number(e.data);
          setExitCode(Number.isFinite(code) ? code : -1);
          setRunState("done");
          closeRef.current?.();
        }
      },
      {
        oneShot: true,
        onError: () => {
          if (runState !== "done") {
            setLogs((prev) => [
              ...prev,
              "[connessione interrotta dal server]",
            ]);
          }
        },
      },
    );
  };

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Versione"
        description="Backend in esecuzione."
      >
        {isLoading || !data ? (
          <div className="text-sm text-fg-3">Caricamento…</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <KV k="Versione" v={data.version} />
            <KV k="Branch" v={data.branch} />
            <KV k="Commit" v={data.git_sha} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Aggiornamento"
        description="Esegue git pull, rebuild del frontend e restart dei servizi."
      >
        <Alert variant="warning" className="mb-3">
          <AlertTitle>Operazione invasiva</AlertTitle>
          <AlertDescription>
            Riavvia backend, ustreamer e nginx. La pagina si scollega per
            qualche secondo.
          </AlertDescription>
        </Alert>
        <Button onClick={startUpdate} disabled={runState === "running"}>
          {runState === "running" ? "In corso…" : "Aggiorna app"}
        </Button>
      </SectionCard>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && runState === "running") return; // block close while running
          setOpen(o);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Aggiornamento</DialogTitle>
            <DialogDescription>
              Log dell'esecuzione di update.sh.
            </DialogDescription>
          </DialogHeader>
          <pre
            ref={logRef}
            className="mono max-h-[50vh] min-h-[200px] overflow-auto rounded-md border bg-bg-2 p-3 text-xs whitespace-pre-wrap"
          >
            {logs.length === 0 ? "Avvio…" : logs.join("\n")}
          </pre>
          <DialogFooter>
            {runState === "done" && (
              <>
                <span className="mr-auto text-sm">
                  Exit code:{" "}
                  <span
                    className={
                      exitCode === 0 ? "text-green-500" : "text-red-500"
                    }
                  >
                    {exitCode ?? "—"}
                  </span>
                </span>
                {exitCode === 0 ? (
                  <Button onClick={() => window.location.reload()}>
                    Ricarica pagina
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Chiudi
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border bg-bg-2 px-3 py-2">
      <div className="text-xs text-fg-3">{k}</div>
      <div className="mono text-sm">{v}</div>
    </div>
  );
}
