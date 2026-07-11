import { useState, useRef, useEffect } from "react";
import { Bell, ChevronDown, Command, LogOut, Search, User, X, Lightbulb, ExternalLink } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const FEEDBACK_FORM_URL = "https://forms.gle/4vzppQhixzzQNYJE8";

interface TopBarProps {
  projectName?: string;
  environment?: string;
  unreadAlerts?: number;
  onSearchToggle?: () => void;
  onEnvironmentChange?: (env: string) => void;
  sidebarCollapsed?: boolean;
}

export function TopBar({
  projectName = "Default Project",
  environment = "production",
  unreadAlerts = 0,
  onSearchToggle,
  onEnvironmentChange,
  sidebarCollapsed = false,
}: TopBarProps) {
  const { user, logout } = useAuth();
  const [envOpen, setEnvOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [userMenuOpen]);

  const sidebarWidth = sidebarCollapsed ? "lg:pl-16" : "lg:pl-60";

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-20 flex items-center justify-between px-4 transition-all duration-200 ease-out ${sidebarWidth}`}
    >
      {/* Left: Search + Project */}
      <div className="flex items-center gap-4 flex-1">
        {/* Portal Search trigger */}
        <button
          onClick={onSearchToggle}
          className="hidden sm:flex items-center gap-2 w-64 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-150 ease-out cursor-pointer group"
          aria-label="Open search"
        >
          <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="flex-1 text-left">Search pages, features…</span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted-foreground">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Environment selector */}
        <div className="relative">
          <button
            onClick={() => setEnvOpen(!envOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                environment === "production"
                  ? "bg-success"
                  : environment === "staging"
                    ? "bg-warning"
                    : "bg-info"
              }`}
            />
            {environment}
            <ChevronDown className="w-3 h-3" />
          </button>
          {envOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setEnvOpen(false)} />
              <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                {["production", "staging", "development"].map((env) => (
                  <button
                    key={env}
                    onClick={() => {
                      setEnvOpen(false);
                      onEnvironmentChange?.(env);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        env === "production"
                          ? "bg-success"
                          : env === "staging"
                            ? "bg-warning"
                            : "bg-info"
                      }`}
                    />
                    {env}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Feedback, Notifications + User menu */}
      <div className="flex items-center gap-3">
        {/* Feedback / Idea */}
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 ease-out cursor-pointer group"
        >
          <Lightbulb className="w-4 h-4 text-warning group-hover:text-warning/80 transition-colors" />
          <span>Feedback & Ideas</span>
          <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </a>

        {/* Mobile feedback icon */}
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Share feedback or ideas"
        >
          <Lightbulb className="w-5 h-5" />
        </a>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
          <Bell className="w-5 h-5" />
          {unreadAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadAlerts > 9 ? "9+" : unreadAlerts}
            </span>
          )}
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${
                userMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-30 min-w-[180px]">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}