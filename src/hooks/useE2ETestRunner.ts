import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface E2ETestStep {
  id: string;
  label: string;
  targetRoute: string;
  check: () => Promise<{ pass: boolean; detail: string }>;
}

export interface E2ETestResult {
  stepId: string;
  label: string;
  pass: boolean;
  detail: string;
  durationMs: number;
}

export interface E2ETestSuiteResult {
  suiteName: string;
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  steps: E2ETestResult[];
  timestamp: number;
}

/**
 * Generate a scripted test suite that navigates through core app pages
 * and verifies DOM content is present.
 */
export function useE2ETestRunner() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<E2ETestSuiteResult[]>([]);

  const generateSuite = useCallback(
    (navigate: ReturnType<typeof useNavigate>) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const steps: E2ETestStep[] = [
        {
          id: "nav-dashboard",
          label: "Navigate to Dashboard",
          targetRoute: "/",
          check: async () => {
            navigate("/");
            await wait(300);
            return {
              pass: document.querySelector("h1")?.textContent?.includes("Dashboard") ?? false,
              detail: document.querySelector("h1")?.textContent ?? "No h1 found",
            };
          },
        },
        {
          id: "dashboard-kpis",
          label: "Dashboard KPI cards render",
          targetRoute: "/",
          check: async () => {
            const statCards = document.querySelectorAll('[class*="StatCard"], [class*="stat"]');
            const statLabels = document.querySelectorAll("p, span");
            const foundLabels = Array.from(statLabels)
              .map((el) => el.textContent)
              .filter(Boolean);
            const hasTraces = foundLabels.some((t) => t?.includes("Trace"));
            const hasCost = foundLabels.some((t) => t?.includes("Cost"));
            return {
              pass: hasTraces || hasCost,
              detail: hasTraces
                ? "Traces metric found"
                : hasCost
                  ? "Cost metric found"
                  : "No KPI labels detected",
            };
          },
        },
        {
          id: "nav-traces",
          label: "Navigate to Traces",
          targetRoute: "/traces",
          check: async () => {
            navigate("/traces");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("trace"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "traces-table",
          label: "Traces table renders",
          targetRoute: "/traces",
          check: async () => {
            const rows = document.querySelectorAll("table tbody tr, [class*='row']");
            const rowCount = rows.length;
            return {
              pass: rowCount > 0,
              detail: `${rowCount} rows found`,
            };
          },
        },
        {
          id: "nav-bad-answers",
          label: "Navigate to Bad Answers",
          targetRoute: "/bad-answers",
          check: async () => {
            navigate("/bad-answers");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("bad") || heading.toLowerCase().includes("answer"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "nav-alerts",
          label: "Navigate to Alerts",
          targetRoute: "/alerts",
          check: async () => {
            navigate("/alerts");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("alert"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "nav-cost",
          label: "Navigate to Cost Analytics",
          targetRoute: "/cost",
          check: async () => {
            navigate("/cost");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("cost"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "nav-feedback",
          label: "Navigate to Feedback",
          targetRoute: "/feedback",
          check: async () => {
            navigate("/feedback");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("feedback") || heading.toLowerCase().includes("rating"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "nav-settings",
          label: "Navigate to Settings",
          targetRoute: "/settings",
          check: async () => {
            navigate("/settings");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("settings") || heading.toLowerCase().includes("config"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "nav-dlq",
          label: "Navigate to DLQ",
          targetRoute: "/dlq",
          check: async () => {
            navigate("/dlq");
            await wait(300);
            const heading = document.querySelector("h1")?.textContent ?? "";
            return {
              pass: heading.toLowerCase().includes("dlq") || heading.toLowerCase().includes("dead"),
              detail: `Heading: "${heading}"`,
            };
          },
        },
        {
          id: "sidebar-visible",
          label: "Sidebar navigation visible",
          targetRoute: "/",
          check: async () => {
            navigate("/");
            await wait(200);
            const links = document.querySelectorAll("nav a, aside a");
            return {
              pass: links.length >= 5,
              detail: `${links.length} nav links found`,
            };
          },
        },
      ];

      return steps;
    },
    [],
  );

  const runSuite = useCallback(
    async (navigate: ReturnType<typeof useNavigate>) => {
      setRunning(true);

      const steps = generateSuite(navigate);
      const stepResults: E2ETestResult[] = [];
      const suiteStart = performance.now();

      for (const step of steps) {
        const stepStart = performance.now();
        try {
          const result = await step.check();
          stepResults.push({
            stepId: step.id,
            label: step.label,
            pass: result.pass,
            detail: result.detail,
            durationMs: performance.now() - stepStart,
          });
        } catch (err) {
          stepResults.push({
            stepId: step.id,
            label: step.label,
            pass: false,
            detail: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            durationMs: performance.now() - stepStart,
          });
        }
      }

      const suiteResult: E2ETestSuiteResult = {
        suiteName: "Core App Flow",
        passed: stepResults.filter((r) => r.pass).length,
        failed: stepResults.filter((r) => !r.pass).length,
        total: stepResults.length,
        durationMs: performance.now() - suiteStart,
        steps: stepResults,
        timestamp: Date.now(),
      };

      setResults((prev) => [suiteResult, ...prev].slice(0, 10));
      setRunning(false);
    },
    [generateSuite],
  );

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { runSuite, clearResults, running, results };
}