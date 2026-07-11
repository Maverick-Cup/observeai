import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

// ── Tour Steps ────────────────────────────────────────────────────

interface TourStep {
  page: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    page: "/",
    title: "Welcome to ObserveAI!",
    description:
      "Your all-in-one platform for monitoring, evaluating, and improving your AI agents. Let's take a 60-second tour to get you oriented.",
  },
  {
    page: "/traces",
    title: "Trace Explorer",
    description:
      "Every LLM call is captured as a trace — view input/output, latency, token usage, and cost. Filter by model, status, or date to find what matters.",
  },
  {
    page: "/guardrails",
    title: "Guardrails Pipeline",
    description:
      "Each trace runs through 5 safety scorers: hallucination, context quality, policy compliance, cost efficiency, and memory safety. Spot issues at a glance.",
  },
  {
    page: "/evals",
    title: "Eval Harness",
    description:
      "Import datasets, run eval suites, track performance over time, and see when regressions happen. The foundation of continuous AI quality.",
  },
  {
    page: "/",
    title: "You're All Set!",
    description:
      "Explore the sidebar for dashboards, alerts, cost tracking, integrations, and more. The tour is saved — reopen it anytime from the Dashboard.",
  },
];

const STORAGE_KEY = "observeai_tour_completed";
const STEP_KEY = "observeai_tour_step";

// ── Props ─────────────────────────────────────────────────────────

interface OnboardingTourProps {
  forceStart?: boolean;
  onForceStartConsumed?: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function OnboardingTour({
  forceStart = false,
  onForceStartConsumed,
}: OnboardingTourProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isCompleted = localStorage.getItem(STORAGE_KEY) === "true";

  // Restore in-progress step from sessionStorage (survives remounts on route change)
  const [stepIndex, setStepIndex] = useState(() => {
    if (!isCompleted) {
      const stored = sessionStorage.getItem(STEP_KEY);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < STEPS.length) {
          return parsed;
        }
      }
    }
    return 0;
  });

  const [visible, setVisible] = useState(false);

  // ── First-visit gate (auto-show after page render) ─────────────
  useEffect(() => {
    if (!isCompleted && !forceStart) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Force-start from parent ─────────────────────────────────────
  useEffect(() => {
    if (forceStart) {
      sessionStorage.removeItem(STEP_KEY);
      setStepIndex(0);
      setVisible(true);
      onForceStartConsumed?.();
    }
  }, [forceStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist current step across remounts ────────────────────────
  useEffect(() => {
    if (visible) {
      sessionStorage.setItem(STEP_KEY, String(stepIndex));
    }
  }, [stepIndex, visible]);

  // ── Navigate to step's page ────────────────────────────────────
  const goToPage = useCallback(
    (targetPage: string) => {
      if (location.pathname !== targetPage) {
        navigate(targetPage);
      }
    },
    [location.pathname, navigate]
  );

  // ── Close / skip ───────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setVisible(false);
    sessionStorage.removeItem(STEP_KEY);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  // ── Next step ──────────────────────────────────────────────────
  const next = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx >= STEPS.length) {
      dismiss();
      return;
    }
    setStepIndex(nextIdx);
    // Step is persisted to sessionStorage via the effect above
    goToPage(STEPS[nextIdx].page);
  }, [stepIndex, goToPage, dismiss]);

  // ── Previous step ──────────────────────────────────────────────
  const prev = useCallback(() => {
    const prevIdx = Math.max(0, stepIndex - 1);
    setStepIndex(prevIdx);
    goToPage(STEPS[prevIdx].page);
  }, [stepIndex, goToPage]);

  // ── Keyboard navigation ────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
          style={{ animation: "scaleIn 250ms ease-out" }}
        >
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Close button */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 justify-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Step {stepIndex + 1} of {STEPS.length}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer -mr-1 -mt-1 shrink-0"
                aria-label="Close tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="text-center">
              <h3 className="text-lg font-heading font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Extra hint for last step */}
            {isLast && (
              <p className="text-xs text-primary italic flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                You can restart this tour anytime from the Dashboard.
              </p>
            )}

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === stepIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2 gap-3">
              {isFirst ? (
                <button
                  onClick={dismiss}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  Skip tour
                </button>
              ) : (
                <button
                  onClick={prev}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}

              <button
                onClick={next}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                  isLast
                    ? "bg-success text-success-foreground hover:bg-success/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {isLast ? (
                  <>
                    Get started
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe for scale-in animation */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}