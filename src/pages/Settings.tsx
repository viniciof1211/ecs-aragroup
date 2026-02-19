import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { pollBitrixNow, useBitrixPollStore } from "@/hooks/useBitrixPolling";
import { sentimentHealth } from "@/lib/api";
import { INTERACTION_WEIGHTS, DECAY_HALF_LIFE_DAYS } from "@/lib/ecs-engine";
import { SEGMENT_CONFIGS } from "@/types/ecs";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const queryClient = useQueryClient();
  const bitrixPoll = useBitrixPollStore();
  const { darkMode, toggleDarkMode } = usePreferencesStore();

  const [sentimentStatus, setSentimentStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [weights, setWeights] = useState({ ...INTERACTION_WEIGHTS });
  const [decayDays, setDecayDays] = useState(DECAY_HALF_LIFE_DAYS);

  const checkSentiment = async () => {
    setSentimentStatus("loading");
    try {
      await sentimentHealth();
      setSentimentStatus("ok");
    } catch {
      setSentimentStatus("error");
    }
  };

  const clearCache = () => {
    queryClient.clear();
  };

  const bitrixConnected = bitrixPoll.lastPollAt != null && !bitrixPoll.lastError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Conexiones, pesos de puntaje y preferencias
        </p>
      </div>

      {/* API Connections */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            Conexiones API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Bitrix24 Webhook</p>
              <p className="text-xs text-muted-foreground">
                hogaresfuncionales.bitrix24.es — polling cada 180s
              </p>
            </div>
            <div className="flex items-center gap-3">
              {bitrixPoll.isPolling ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : bitrixConnected ? (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" /> Conectado
                </span>
              ) : bitrixPoll.lastError ? (
                <span className="flex items-center gap-1 text-sm text-red-500">
                  <XCircle className="h-5 w-5" /> Error
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Esperando…</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => pollBitrixNow()}
                disabled={bitrixPoll.isPolling}
              >
                Verificar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Agente de Sentimiento</p>
              <p className="text-xs text-muted-foreground">
                levinnovation--ecs-sentiment-agent-ecs-sentiment-server.modal.run
              </p>
            </div>
            <div className="flex items-center gap-3">
              {sentimentStatus === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : sentimentStatus === "ok" ? (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" /> Conectado
                </span>
              ) : sentimentStatus === "error" ? (
                <span className="flex items-center gap-1 text-sm text-red-500">
                  <XCircle className="h-5 w-5" /> Error
                </span>
              ) : null}
              <Button variant="outline" size="sm" onClick={checkSentiment}>
                Verificar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-medium">Supabase</p>
              <p className="text-xs text-muted-foreground">
                Base de datos de leads e interacciones
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="h-5 w-5" /> Configurado
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Score Weights */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            Pesos de Interacción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(weights).map(([key, value]) => (
              <div key={key}>
                <Label className="text-xs capitalize">
                  {key.replace(/_/g, " ")}
                </Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value),
                    }))
                  }
                  className="mt-1"
                />
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="max-w-xs">
            <Label className="text-xs">
              Vida media de decaimiento (días)
            </Label>
            <Input
              type="number"
              value={decayDays}
              onChange={(e) => setDecayDays(Number(e.target.value))}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Segment Thresholds */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            Umbrales de Segmento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {SEGMENT_CONFIGS.map((seg) => (
              <div
                key={seg.name}
                className="rounded-lg border border-border p-3 text-center"
              >
                <span className="text-lg">{seg.icon}</span>
                <p className="text-sm font-medium">{seg.label}</p>
                <p className="text-xs text-muted-foreground">
                  {seg.min}–{seg.max}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Preferences */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            Preferencias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Modo Oscuro</p>
              <p className="text-xs text-muted-foreground">
                Cambiar entre tema claro y oscuro
              </p>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Idioma</p>
              <p className="text-xs text-muted-foreground">
                Español (Costa Rica)
              </p>
            </div>
            <span className="text-sm text-muted-foreground">es-CR</span>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">
            Gestión de Datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => pollBitrixNow()}
              disabled={bitrixPoll.isPolling}
            >
              {bitrixPoll.isPolling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {bitrixPoll.isPolling ? "Sincronizando…" : "Sincronizar con Bitrix24"}
            </Button>

            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Base de Datos
            </Button>

            <Button variant="outline" onClick={clearCache}>
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar Caché
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
