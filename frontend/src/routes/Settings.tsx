import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppSettingsPanel } from "@/features/settings/AppSettingsPanel";
import { ClientSettingsPanel } from "@/features/settings/ClientSettingsPanel";
import { SystemPanel } from "@/features/settings/SystemPanel";
import { WebcamSettingsPanel } from "@/features/settings/WebcamSettingsPanel";

export default function Settings() {
  return (
    <div className="grid gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-fg-3">
          Configurazione backend, webcam, client e gestione versione.
        </p>
      </header>

      <Alert variant="warning">
        <AlertTitle>LAN trusted, nessuna autenticazione</AlertTitle>
        <AlertDescription>
          Queste impostazioni modificano file di sistema e riavviano servizi.
          Esponi l'app solo su una rete fidata.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="backend">
        <TabsList className="self-start">
          <TabsTrigger value="backend">Backend</TabsTrigger>
          <TabsTrigger value="webcam">Webcam</TabsTrigger>
          <TabsTrigger value="client">App</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="backend">
          <AppSettingsPanel />
        </TabsContent>
        <TabsContent value="webcam">
          <WebcamSettingsPanel />
        </TabsContent>
        <TabsContent value="client">
          <ClientSettingsPanel />
        </TabsContent>
        <TabsContent value="system">
          <SystemPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
