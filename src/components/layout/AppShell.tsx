import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useBitrixPolling } from "@/hooks/useBitrixPolling";
import { useMetaPolling } from "@/hooks/useMetaPolling";
import { useSIPAPolling } from "@/hooks/useSIPAPolling";
import { GlobalAdvisorChat } from "./GlobalAdvisorChat";

export function AppShell() {
  const sidebarOpen = usePreferencesStore((s) => s.sidebarOpen);

  // Start Bitrix24 webhook polling (every 180s)
  useBitrixPolling();

  // Start Meta Marketing API polling (every 240s)
  useMetaPolling();

  // Start S.I.P.A. proactive alerting (every 240s, first run after 30s)
  useSIPAPolling();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main
        className={cn(
          "min-h-[calc(100vh-4rem)] transition-all duration-300",
          sidebarOpen ? "ml-56" : "ml-16"
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
        <Footer />
      </main>
      <GlobalAdvisorChat />
    </div>
  );
}
