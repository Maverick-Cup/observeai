import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { SuggestionBar } from "../ui/SuggestionBar";
import { PortalSearch } from "../search/PortalSearch";
import { OnboardingTour } from "../onboarding/OnboardingTour";

// ── Tour Context ──────────────────────────────────────────────────

interface TourContextType {
  startTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within AppShell");
  return ctx;
}

// ── AppShell ──────────────────────────────────────────────────────

interface AppShellProps {
  children: ReactNode;
  projectName?: string;
  environment?: string;
  unreadAlerts?: number;
}

export function AppShell({
  children,
  projectName,
  environment: initialEnv,
  unreadAlerts,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [environment, setEnvironment] = useState(initialEnv ?? "production");
  const [tourForceStart, setTourForceStart] = useState(false);

  const startTour = () => {
    setTourForceStart(true);
  };

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  return (
    <TourContext.Provider value={{ startTour }}>
      <div className="min-h-screen bg-background flex flex-col">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <TopBar
          projectName={projectName}
          environment={environment}
          unreadAlerts={unreadAlerts}
          sidebarCollapsed={sidebarCollapsed}
          onSearchToggle={() => setSearchOpen(true)}
          onEnvironmentChange={setEnvironment}
        />

        <PortalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

        <OnboardingTour
          forceStart={tourForceStart}
          onForceStartConsumed={() => setTourForceStart(false)}
        />

        <main
          className={`pt-14 flex-1 transition-all duration-200 ease-out ${
            sidebarCollapsed ? "pl-16" : "pl-60"
          }`}
        >
          <div className="p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-5">
              <SuggestionBar />
            </div>
            {children}
          </div>
        </main>

        <Footer
          className={`transition-all duration-200 ease-out ${
            sidebarCollapsed ? "pl-16" : "pl-60"
          }`}
        />
      </div>
    </TourContext.Provider>
  );
}