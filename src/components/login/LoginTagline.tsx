import { useEffect, useState, useCallback } from "react";
import { Activity } from "lucide-react";

// ── Creative Copy ──────────────────────────────────────────────────

interface WordStep {
  id: string;
  determiner: string;
  word: string;
}

const WORDS: WordStep[] = [
  { id: "confused", determiner: "A", word: "confused" },
  { id: "incorrect", determiner: "an", word: "incorrect" },
  { id: "ungrounded", determiner: "an", word: "ungrounded" },
  { id: "hallucinated", determiner: "a", word: "hallucinated" },
];

// ── Timings (ms) ───────────────────────────────────────────────────

const WORD_APPEAR = 800;       // fade in duration
const WORD_HOLD = 600;         // how long it sits before strike
const STRIKE_DURATION = 350;   // strike line animation
const POST_STRIKE_HOLD = 500;  // pause after strike before next
const PUNCHLINE_DELAY = 700;   // delay before punchline after last strike
const BRAND_DELAY = 500;       // delay before brand after punchline

// ── Component ──────────────────────────────────────────────────────

interface LoginTaglineProps {
  onBrandRevealed?: () => void;
}

export function LoginTagline({ onBrandRevealed }: LoginTaglineProps) {
  const [phase, setPhase] = useState<"words" | "punchline" | "brand">("words");
  const [activeIndex, setActiveIndex] = useState(0);
  const [striking, setStriking] = useState(false);
  const [struckSet, setStruckSet] = useState<Set<string>>(new Set());

  // ── Sequence engine ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "words") return;
    if (activeIndex >= WORDS.length) return;

    // Step 1: word appears (handled by React rendering with transition)
    // Step 2: hold, then start the strike
    const strikeTimer = setTimeout(() => {
      setStriking(true);
    }, WORD_APPEAR + WORD_HOLD);

    // Step 3: strike completes, advance
    const completeTimer = setTimeout(() => {
      setStruckSet((prev) => {
        const next = new Set(prev);
        next.add(WORDS[activeIndex].id);
        return next;
      });
      setStriking(false);

      if (activeIndex < WORDS.length - 1) {
        setActiveIndex((i) => i + 1);
      } else {
        // All words done → transition to punchline
        setTimeout(() => setPhase("punchline"), PUNCHLINE_DELAY);
      }
    }, WORD_APPEAR + WORD_HOLD + STRIKE_DURATION + POST_STRIKE_HOLD);

    return () => {
      clearTimeout(strikeTimer);
      clearTimeout(completeTimer);
    };
  }, [phase, activeIndex]);

  // ── Punchline → Brand ────────────────────────────────────────────
  useEffect(() => {
    if (phase === "punchline") {
      const t = setTimeout(() => {
        setPhase("brand");
        onBrandRevealed?.();
      }, BRAND_DELAY);
      return () => clearTimeout(t);
    }
  }, [phase, onBrandRevealed]);

  // ── Helpers ──────────────────────────────────────────────────────
  const isStruck = (id: string) => struckSet.has(id);
  const isActive = (index: number) =>
    index === activeIndex && !isStruck(WORDS[index].id);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <div className="text-center mb-10 select-none">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-5 ring-1 ring-primary/10 animate-fade-in">
          <Activity className="w-7 h-7 text-primary" />
        </div>

        {/* Animated Sentence */}
        <div
          className="min-h-[148px] flex flex-col items-center justify-center"
          aria-live="polite"
        >
          {/* ── The bad-word sequence ── */}
          <div className="flex flex-wrap items-baseline justify-center gap-x-1.5 leading-relaxed text-lg sm:text-xl">
            {WORDS.map((item, index) => {
              const visible = index <= activeIndex;
              const struck = isStruck(item.id);
              const active = isActive(index);

              return (
                <span
                  key={item.id}
                  className={`
                    relative inline-block px-1 py-0.5 font-heading font-semibold
                    transition-all duration-500 ease-out
                    ${visible ? "opacity-100 max-w-[12rem]" : "opacity-0 max-w-0 overflow-hidden px-0"}
                    ${struck ? "text-muted-foreground/30 line-through decoration-2 decoration-destructive/60" : "text-foreground"}
                    ${active ? "scale-105" : struck ? "scale-[0.97]" : ""}
                  `}
                  style={{
                    transitionDelay:
                      visible && !struck ? `${WORD_APPEAR}ms` : "0ms",
                  }}
                >
                  {/* Determiner */}
                  <span className="text-sm sm:text-base font-normal text-muted-foreground/70">
                    {index === 0 ? "" : " "}
                    {item.determiner}
                    {index > 0 ? "\u00A0" : "\u00A0"}
                  </span>

                  {/* The word + strike line */}
                  <span className="relative">
                    {item.word}
                    {striking && index === activeIndex && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[2.5px] bg-destructive rounded-full animate-strike-across" />
                    )}
                  </span>

                  {index < WORDS.length - 1 ? "," : ""}
                </span>
              );
            })}
          </div>

          {/* ── Punchline ── */}
          <div
            className={`
              mt-4 transition-all duration-700 ease-out
              ${
                phase === "punchline" || phase === "brand"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }
            `}
          >
            <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed">
              <span className="text-foreground/90 font-semibold not-italic">
                response
              </span>
              {" is already a waste of time."}
            </p>
          </div>

          {/* ── Brand Reveal ── */}
          <div
            className={`
              mt-6 transition-all duration-800 ease-out
              ${
                phase === "brand"
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }
            `}
          >
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              ObserveAI
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-medium tracking-wide uppercase">
              AI Observability Platform
            </p>
            <div className="mt-3 h-px max-w-[120px] mx-auto bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
        </div>
      </div>
    </>
  );
}