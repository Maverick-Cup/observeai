import { NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import {
  AlertTriangle,
  Braces,
  DollarSign,
  Bell,
  Settings,
  Bug,
  MessageSquare,
  ChevronLeft,
  Sun,
  Moon,
  Activity,
  FlaskConical,
  Shield,
  CheckSquare,
  Maximize2,
  Database,
  FileText,
  Network,
  Puzzle,
} from "lucide-react";

const navItems = [
  { label: "Problems", path: "/", icon: AlertTriangle },
  { label: "Bad Answers", path: "/bad-answers", icon: AlertTriangle },
  { label: "Guardrails", path: "/guardrails", icon: Shield },
  { label: "Reports", path: "/reports", icon: FileText },
  { label: "Ingestion", path: "/ingestion", icon: Network },
  { label: "Traces", path: "/traces", icon: Braces },
  { label: "Cost Analytics", path: "/cost", icon: DollarSign },
  { label: "Alerts", path: "/alerts", icon: Bell },
  { label: "Feedback", path: "/feedback", icon: MessageSquare },
  { label: "Reliability", path: "/reliability", icon: Shield },
  { label: "Evals", path: "/evals", icon: CheckSquare },
  { label: "Schema Registry", path: "/schema", icon: Database },
  { label: "Context", path: "/context", icon: Maximize2 },
  { label: "Integrations", path: "/integrations", icon: Puzzle },
  { label: "DLQ Manager", path: "/dlq", icon: Bug },
  { label: "Stress Lab", path: "/stress-test", icon: FlaskConical },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-muted border-r border-border flex flex-col transition-all duration-200 ease-out z-30 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-heading font-semibold text-sm text-foreground">
              ObserveAI
            </span>
          </div>
        )}
        {collapsed && (
          <Activity className="w-5 h-5 text-primary mx-auto" />
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out cursor-pointer
                ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }
                ${collapsed ? "justify-center px-2" : ""}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="p-3 border-t border-border">
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out cursor-pointer text-muted-foreground hover:text-foreground hover:bg-background/50 ${
            collapsed ? "justify-center" : ""
          }`}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>
    </aside>
  );
}