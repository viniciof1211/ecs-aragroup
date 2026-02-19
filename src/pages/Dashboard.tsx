import { Loader2 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useInteractions } from "@/hooks/useInteractions";
import { useTimeFilteredData } from "@/hooks/useTimeFilteredData";
import { KPICards } from "@/components/dashboard/KPICards";
import { SegmentFunnel } from "@/components/dashboard/SegmentFunnel";
import { ScoreTrendChart } from "@/components/dashboard/ScoreTrendChart";
import { TopMovers } from "@/components/dashboard/TopMovers";
import { ChannelMixChart } from "@/components/dashboard/ChannelMixChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { SyncStatus } from "@/components/dashboard/SyncStatus";
import { SentimentWidget } from "@/components/dashboard/SentimentWidget";

export default function Dashboard() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: interactions = [], isLoading: interactionsLoading } =
    useInteractions();
  const { allLeads, filteredInteractions } = useTimeFilteredData(leads, interactions);

  if (leadsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando datos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Vista ejecutiva del estado de leads y engagement
        </p>
      </div>

      <KPICards leads={allLeads} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScoreTrendChart leads={allLeads} />
        </div>
        <SegmentFunnel leads={allLeads} />
      </div>

      <TopMovers leads={allLeads} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {interactionsLoading ? (
          <div className="flex h-48 items-center justify-center lg:col-span-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Cargando interacciones...</span>
          </div>
        ) : (
          <>
            <ChannelMixChart interactions={filteredInteractions} />
            <ActivityFeed interactions={filteredInteractions} />
          </>
        )}
        <div className="space-y-6">
          <SentimentWidget totalLeads={allLeads.length} />
          <AlertsPanel leads={allLeads} />
          <SyncStatus />
        </div>
      </div>
    </div>
  );
}
