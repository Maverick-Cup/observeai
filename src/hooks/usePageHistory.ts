import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "observeai-page-history";
const MAX_HISTORY = 4;

export interface PageEntry {
  path: string;
  label: string;
  timestamp: number;
}

const pageLabels: Record<string, string> = {
  "/": "Dashboard",
  "/bad-answers": "Bad Answers",
  "/traces": "Traces",
  "/cost": "Cost Analytics",
  "/alerts": "Alerts",
  "/feedback": "Feedback",
  "/dlq": "DLQ Manager",
  "/settings": "Settings",
};

function loadHistory(): PageEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PageEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: PageEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function usePageHistory() {
  const location = useLocation();
  const [history, setHistory] = useState<PageEntry[]>(loadHistory);

  // Track current page visit
  useEffect(() => {
    const label = pageLabels[location.pathname];
    if (!label) return;

    setHistory((prev) => {
      // Remove any existing entry for this path
      const filtered = prev.filter((e) => e.path !== location.pathname);
      const next = [{ path: location.pathname, label, timestamp: Date.now() }, ...filtered].slice(
        0,
        MAX_HISTORY,
      );
      saveHistory(next);
      return next;
    });
  }, [location.pathname]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  const recentPages = history;

  return { recentPages, clearHistory };
}