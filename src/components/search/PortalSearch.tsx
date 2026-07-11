import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import SITEMAP, { type SitemapEntry } from "../../data/sitemap";
import { AIAssistant } from "./AIAssistant";
import { Sparkles, Search, MessageSquareText } from "lucide-react";

interface PortalSearchProps {
  open: boolean;
  onClose: () => void;
}

// ── Tab options ────────────────────────────────────────────────────

type SearchTab = "pages" | "ai";

/**
 * Global portal search — press Cmd+K / Ctrl+K to open.
 * Two tabs: "Pages" (sitemap keyword search) and "Ask AI" (conversational AI assistant).
 */
export function PortalSearch({ open, onClose }: PortalSearchProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SearchTab>("pages");

  // Reset tab on open
  useEffect(() => {
    if (open) setTab("pages");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog — wider for AI tab */}
      <div
        className={`relative mx-4 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-slide-up ${
          tab === "ai" ? "w-full max-w-2xl" : "w-full max-w-xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Search or ask about ObserveAI"
      >
        {/* ── Tab Bar ──────────────────────────────────────────── */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("pages")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer ${
              tab === "pages"
                ? "text-primary border-b-2 border-primary bg-primary/[0.03]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
            role="tab"
            aria-selected={tab === "pages"}
          >
            <Search className="w-4 h-4" />
            Pages
          </button>
          <button
            onClick={() => setTab("ai")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-150 cursor-pointer ${
              tab === "ai"
                ? "text-primary border-b-2 border-primary bg-primary/[0.03]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
            role="tab"
            aria-selected={tab === "ai"}
          >
            <Sparkles className="w-4 h-4" />
            Ask AI
          </button>
        </div>

        {/* ── Tab Content ──────────────────────────────────────── */}
        {tab === "pages" ? (
          <PagesSearch onClose={onClose} navigate={navigate} />
        ) : (
          <div className="max-h-[70vh] overflow-hidden">
            <AIAssistant onClose={onClose} inline />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pages Search Tab (existing sitemap search) ─────────────────────

function PagesSearch({
  onClose,
  navigate,
}: {
  onClose: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  // ── Flatten all results with category grouping ──────────────────────────

  const results = (() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    // Score each entry
    const scored: Array<{ entry: SitemapEntry; score: number }> = [];
    for (const entry of SITEMAP) {
      let score = 0;
      const lowerLabel = entry.label.toLowerCase();
      const lowerDesc = entry.description.toLowerCase();

      // Exact label match gets priority
      if (lowerLabel === q) score += 100;
      if (lowerLabel.startsWith(q)) score += 60;
      if (lowerLabel.includes(q)) score += 30;

      // Description match
      if (lowerDesc.includes(q)) score += 10;

      // Tag/keyword match
      for (const tag of [...entry.tags, ...entry.keywords]) {
        if (tag.toLowerCase().includes(q)) score += 5;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    // Sort by score descending, then alphabetically
    scored.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));

    return scored.map((s) => s.entry);
  })();

  const flatResults = results;

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Auto-focus input when opened
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────

  const goTo = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[selectedIdx]) {
          goTo(flatResults[selectedIdx].path);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || flatResults.length === 0) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-result-index]");
    items[selectedIdx]?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, flatResults.length]);

  // ── Render icon dynamically ─────────────────────────────────────────────

  const getIcon = (iconName: string) => {
    const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <LucideIcons.FileQuestion className="w-5 h-5" />;
  };

  // Group results by category in display order
  const categoryOrder: SitemapEntry["category"][] = [
    "Observability",
    "Quality",
    "Operations",
    "Configuration",
    "Testing",
  ];

  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      items: flatResults.filter((r) => r.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Search input */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <LucideIcons.Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, features, settings…"
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-[10px] font-mono text-muted-foreground border border-border">
          <span className="text-xs">⌘</span>K
        </kbd>
        {query && (
          <button
            onClick={() => setQuery("")}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <LucideIcons.X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results */}
      <div
        ref={listRef}
        className="overflow-y-auto max-h-[50vh] py-2"
        onKeyDown={handleKeyDown}
      >
        {query.trim() === "" ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            <LucideIcons.Compass className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium text-foreground mb-1">Tour the Portal</p>
            <p>Start typing to search every page, feature, and tool in ObserveAI.</p>
          </div>
        ) : flatResults.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            <LucideIcons.SearchX className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium text-foreground mb-1">No matches</p>
            <p>
              Nothing found for "<span className="font-mono text-xs">{query}</span>".
              Try a broader term like{" "}
              <button
                onClick={() => setQuery("traces")}
                className="text-primary hover:underline cursor-pointer"
              >
                traces
              </button>,{" "}
              <button
                onClick={() => setQuery("cost")}
                className="text-primary hover:underline cursor-pointer"
              >
                cost
              </button>, or{" "}
              <button
                onClick={() => setQuery("guardrails")}
                className="text-primary hover:underline cursor-pointer"
              >
                guardrails
              </button>.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {grouped.map((group) => (
              <div key={group.category}>
                {/* Category header */}
                <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.category}
                </div>
                {group.items.map((entry, localIdx) => {
                  const globalIdx = flatResults.indexOf(entry);
                  const isSelected = globalIdx === selectedIdx;
                  return (
                    <button
                      key={entry.path}
                      data-result-index={globalIdx}
                      onClick={() => goTo(entry.path)}
                      onMouseEnter={() => setSelectedIdx(globalIdx)}
                      className={`w-full flex items-start gap-3 px-5 py-3 text-left transition-colors duration-100 cursor-pointer ${
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div
                        className={`mt-0.5 flex-shrink-0 ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {getIcon(entry.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                            {entry.path}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {entry.description}
                        </p>
                      </div>
                      <LucideIcons.ArrowRight
                        className={`w-4 h-4 flex-shrink-0 transition-opacity ${
                          isSelected ? "opacity-100 text-primary" : "opacity-0"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">↑</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">↓</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">↵</kbd>
          Open
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Esc</kbd>
          Close
        </span>
      </div>
    </>
  );
}

/**
 * Hook: registers Cmd+K / Ctrl+K globally and provides open/close state.
 */
export function usePortalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return { open, setOpen };
}