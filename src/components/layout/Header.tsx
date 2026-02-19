import { Moon, Sun, PanelLeftOpen, PanelLeftClose, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useSentimentStore } from "@/stores/useSentimentStore";
import { TimeRangeSelector } from "./TimeRangeSelector";

export function Header() {
  const { darkMode, toggleDarkMode, sidebarOpen, toggleSidebar } =
    usePreferencesStore();
  const { isRunning, progress } = useSentimentStore();

  const pct = progress
    ? Math.round((progress.done / Math.max(progress.total, 1)) * 100)
    : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </Button>

          <div className="flex items-center gap-2">
            <img
              src="/ecs-logo.png"
              alt="ECS"
              className="h-8 w-8 rounded"
            />
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold leading-tight tracking-tight">
                ECS
              </span>
              <span className="text-xs text-muted-foreground">
                Engagement Continuum Score — ARA Group
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Global time range filter */}
          <TimeRangeSelector />

          {/* Sentiment progress indicator */}
          {isRunning && progress && (
            <div className="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 dark:bg-purple-950/50">
              <Brain className="h-3.5 w-3.5 animate-pulse text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                {pct}% · {progress.done}/{progress.total}
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="shrink-0"
          >
            {darkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <img
            src="/ecs-logo.png"
            alt="ARA Group"
            className="h-9 rounded"
          />
        </div>
      </div>

      {/* Global progress bar */}
      {isRunning && progress && (
        <div className="h-0.5 w-full bg-muted">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </header>
  );
}
