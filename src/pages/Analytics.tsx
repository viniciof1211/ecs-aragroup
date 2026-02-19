import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeads } from "@/hooks/useLeads";
import { useInteractions } from "@/hooks/useInteractions";
import { useTimeFilteredData } from "@/hooks/useTimeFilteredData";
import { DiagnosticTab } from "@/components/analytics/DiagnosticTab";
import { PredictiveTab } from "@/components/analytics/PredictiveTab";
import { PrescriptiveTab } from "@/components/analytics/PrescriptiveTab";
import { SentimentPanel } from "@/components/analytics/SentimentPanel";

export default function Analytics() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: interactions = [], isLoading: intLoading } = useInteractions();
  const { allLeads, filteredInteractions } = useTimeFilteredData(leads, interactions);

  if (leadsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Inteligencia de negocio: diagnóstico, predicción, prescripción y sentimiento IA
        </p>
      </div>

      <Tabs defaultValue="sentiment" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="sentiment">Sentimiento</TabsTrigger>
          <TabsTrigger value="diagnostic">Diagnóstico</TabsTrigger>
          <TabsTrigger value="predictive">Predictivo</TabsTrigger>
          <TabsTrigger value="prescriptive">Prescriptivo</TabsTrigger>
        </TabsList>

        <TabsContent value="sentiment">
          <SentimentPanel leads={allLeads} interactions={filteredInteractions} />
        </TabsContent>

        <TabsContent value="diagnostic">
          {intLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando interacciones...</span>
            </div>
          ) : (
            <DiagnosticTab leads={allLeads} interactions={filteredInteractions} />
          )}
        </TabsContent>

        <TabsContent value="predictive">
          {intLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando interacciones...</span>
            </div>
          ) : (
            <PredictiveTab leads={allLeads} interactions={filteredInteractions} />
          )}
        </TabsContent>

        <TabsContent value="prescriptive">
          {intLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando interacciones...</span>
            </div>
          ) : (
            <PrescriptiveTab leads={allLeads} interactions={filteredInteractions} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
