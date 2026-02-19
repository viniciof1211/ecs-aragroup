import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, Download, X, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { utils, writeFile } from "xlsx";

import { useLeads } from "@/hooks/useLeads";
import { useFilterStore } from "@/stores/useFilterStore";
import { useSentimentStore } from "@/stores/useSentimentStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSegmentConfig, getSegmentFromScore, STATUS_LABELS, SEGMENT_CONFIGS } from "@/types/ecs";
import { cn } from "@/lib/utils";
import type { ECSLead, Segment } from "@/types/ecs";

function ScoreBadge({ score }: { score: number }) {
  const segment = getSegmentFromScore(score);
  const config = getSegmentConfig(segment);
  return (
    <Badge
      className="min-w-[3rem] justify-center font-display text-xs font-bold text-white"
      style={{ backgroundColor: config.color }}
    >
      {score}
    </Badge>
  );
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta > 2) return <ArrowUp className="h-4 w-4 text-emerald-500" />;
  if (delta < -2) return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

const QUALITY_LABELS: Record<string, string> = {
  excellent: "Excelente",
  good: "Bueno",
  moderate: "Moderado",
  poor: "Pobre",
  minimal: "Mínimo",
};

export default function LeadExplorer() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeads();
  const sentimentResults = useSentimentStore((s) => s.results);
  const {
    search, setSearch,
    segments, setSegments,
    statuses, setStatuses,
    sortBy, setSortBy,
    sortDir, setSortDir,
    page, setPage,
    pageSize,
    resetFilters,
  } = useFilterStore();

  const filtered = useMemo(() => {
    let result = [...leads];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q)
      );
    }

    if (segments.length > 0) {
      result = result.filter((l) => {
        const seg = l.segment || getSegmentFromScore(l.current_score);
        return segments.includes(seg);
      });
    }

    if (statuses.length > 0) {
      result = result.filter((l) => statuses.includes(l.status));
    }

    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() ?? "";
          bVal = b.name?.toLowerCase() ?? "";
          break;
        case "current_score":
          aVal = a.current_score;
          bVal = b.current_score;
          break;
        case "interaction_count":
          aVal = a.interaction_count ?? 0;
          bVal = b.interaction_count ?? 0;
          break;
        case "last_interaction_at":
          aVal = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
          bVal = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
          break;
        case "first_seen":
          aVal = a.first_seen ? new Date(a.first_seen).getTime() : 0;
          bVal = b.first_seen ? new Date(b.first_seen).getTime() : 0;
          break;
        case "sentiment":
          aVal = sentimentResults[a.id]?.sentiment_score ?? -999;
          bVal = sentimentResults[b.id]?.sentiment_score ?? -999;
          break;
        case "bonus":
          aVal = sentimentResults[a.id]?.ecs_sentiment_bonus ?? -999;
          bVal = sentimentResults[b.id]?.ecs_sentiment_bonus ?? -999;
          break;
        default:
          aVal = a.current_score;
          bVal = b.current_score;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [leads, search, segments, statuses, sortBy, sortDir, sentimentResults]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const avgScore =
    filtered.length > 0
      ? Math.round(filtered.reduce((s, l) => s + l.current_score, 0) / filtered.length)
      : 0;

  const handleSort = useCallback(
    (col: string) => {
      if (sortBy === col) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        setSortBy(col);
        setSortDir("desc");
      }
    },
    [sortBy, sortDir, setSortBy, setSortDir]
  );

  const exportExcel = useCallback(() => {
    const ws = utils.json_to_sheet(
      filtered.map((l) => ({
        Nombre: l.name,
        Email: l.email,
        Teléfono: l.phone,
        Empresa: l.company,
        Puntaje: l.current_score,
        Segmento: getSegmentConfig(l.segment || getSegmentFromScore(l.current_score)).label,
        Estado: STATUS_LABELS[l.status] || l.status,
        Interacciones: l.interaction_count,
        "Última Actividad": l.last_interaction_at || "",
      }))
    );
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Leads");
    writeFile(wb, "leads-export.xlsx");
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando leads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Explorador de Leads</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length.toLocaleString("es-CR")} leads encontrados · Puntaje promedio: {avgScore}
          </p>
        </div>
        <Button onClick={exportExcel} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-card">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email, teléfono, empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={segments.length === 1 ? segments[0] : "all"}
            onValueChange={(v) => setSegments(v === "all" ? [] : [v as Segment])}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {SEGMENT_CONFIGS.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.icon} {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statuses.length === 1 ? statuses[0] : "all"}
            onValueChange={(v) =>
              setStatuses(v === "all" ? [] : [v as ECSLead["status"]])
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || segments.length > 0 || statuses.length > 0) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("current_score")}
              >
                Score {sortBy === "current_score" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                Nombre {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Canales</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("interaction_count")}
              >
                Int. {sortBy === "interaction_count" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("sentiment")}
              >
                Sentimiento {sortBy === "sentiment" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Calidad</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("bonus")}
              >
                Bonus {sortBy === "bonus" && (sortDir === "asc" ? "↑" : "↓")}
              </TableHead>
              <TableHead>Tendencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  No se encontraron leads
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <TableCell>
                    <ScoreBadge score={lead.current_score} />
                  </TableCell>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.company || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {STATUS_LABELS[lead.status] || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(lead.channels ?? []).slice(0, 3).map((ch) => (
                        <Badge key={ch} variant="secondary" className="text-[10px]">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{lead.interaction_count ?? 0}</TableCell>
                  <TableCell>
                    {sentimentResults[lead.id] ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            sentimentResults[lead.id].sentiment_score > 0.3 ? "bg-green-500" :
                            sentimentResults[lead.id].sentiment_score > -0.3 ? "bg-yellow-500" :
                            "bg-red-500"
                          )}
                        />
                        <span className="text-xs">
                          {sentimentResults[lead.id].sentiment_score > 0 ? "+" : ""}
                          {sentimentResults[lead.id].sentiment_score.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sentimentResults[lead.id] ? (
                      <Badge variant="outline" className="text-[10px]">
                        {QUALITY_LABELS[sentimentResults[lead.id].engagement_quality] || sentimentResults[lead.id].engagement_quality}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sentimentResults[lead.id] ? (
                      <span className={cn(
                        "text-xs font-display font-semibold",
                        sentimentResults[lead.id].ecs_sentiment_bonus >= 0 ? "text-emerald-600" : "text-red-500"
                      )}>
                        {sentimentResults[lead.id].ecs_sentiment_bonus >= 0 ? "+" : ""}
                        {sentimentResults[lead.id].ecs_sentiment_bonus.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <TrendArrow
                      current={lead.current_score}
                      previous={lead.previous_score}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
