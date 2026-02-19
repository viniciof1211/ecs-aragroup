import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import { useBitrixPolling } from "@/hooks/useBitrixPolling";

export function AppShell() {
  const sidebarOpen = usePreferencesStore((s) => s.sidebarOpen);

  // Start Bitrix24 webhook polling (every 180s)
  useBitrixPolling();

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
    </div>
  );
}
