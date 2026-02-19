import { RefreshCw, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { pollBitrixNow, useBitrixPollStore } from "@/hooks/useBitrixPolling";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getPollInterval } from "@/lib/bitrix-poller";

export function SyncStatus() {
  const { isPolling, lastPollAt, lastLeadCount, lastError, totalSynced } =
    useBitrixPollStore();

  const intervalSec = Math.round(getPollInterval() / 1000);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <RefreshCw className="h-5 w-5" />
          Estado de Sincronización
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bitrix24 Webhook</span>
          {lastPollAt ? (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Conectado
            </span>
          ) : lastError ? (
            <span className="flex items-center gap-1 text-sm text-red-500">
              <XCircle className="h-4 w-4" /> Error
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Iniciando…
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Auto-poll</span>
          <span className="text-sm">cada {intervalSec}s</span>
        </div>

        {lastPollAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Último poll</span>
            <span className="text-sm">
              {formatDistanceToNow(lastPollAt, {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
        )}

        {lastPollAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Último resultado</span>
            <span className="text-sm font-medium">
              {lastLeadCount > 0
                ? `${lastLeadCount} leads actualizados`
                : "Sin cambios"}
            </span>
          </div>
        )}

        {totalSynced > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total sincronizados</span>
            <span className="text-sm font-medium">
              {totalSynced.toLocaleString("es-CR")} leads
            </span>
          </div>
        )}

        {lastError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700 dark:text-red-400">{lastError}</p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => pollBitrixNow()}
          disabled={isPolling}
        >
          {isPolling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isPolling ? "Sincronizando…" : "Sincronizar Ahora"}
        </Button>
      </CardContent>
    </Card>
  );
}
