/**
 * Safe Tokenization Engine
 *
 * Detects special-token injection attempts in user inputs, retrieved chunks,
 * and model responses. This is ObserveAI's primary defense against memory
 * poisoning via token injection.
 *
 * Attack vectors detected:
 *   - HuggingFace chat template tokens (<|im_start|>, <|im_end|>, etc.)
 *   - Llama/Mistral instruction tokens ([INST], [/INST], <<SYS>>)
 *   - OpenAI/Anthropic control token sequences
 *   - System prompt override language
 *
 * Usage:
 *   const result = scanForSpecialTokens(input);
 *   result.hasInjection    // boolean
 *   result.flaggedPatterns // array of patterns found
 *   result.severity        // "low" | "medium" | "high" | "critical"
 */

// ── Special token patterns ─────────────────────────────────────────

export interface SpecialTokenMatch {
  pattern: string;
  index: number;
  context: string; // ~40 chars surrounding the match
  severity: "low" | "medium" | "high" | "critical";
  source: "user_input" | "retrieved_chunk" | "response";
}

export interface SafeTokenizationResult {
  hasInjection: boolean;
  flaggedPatterns: SpecialTokenMatch[];
  severity: "low" | "medium" | "high" | "critical" | "none";
  score: number; // 0–1, higher = safer
  reason: string;
}

/**
 * Pattern definitions grouped by severity.
 * Each entry: { regex, label, severity, description }
 */
const PATTERNS: Array<{
  regex: RegExp;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}> = [
  // ── CRITICAL: Direct control-token injection ──────────────────
  {
    regex: /<\|im_start\|>/gi,
    label: "<|im_start|>",
    severity: "critical",
    description: "HuggingFace chat template start token — can override system prompt",
  },
  {
    regex: /<\|im_end\|>/gi,
    label: "<|im_end|>",
    severity: "critical",
    description: "HuggingFace chat template end token — can prematurely end conversation",
  },
  {
    regex: /<\|endoftext\|>/gi,
    label: "<|endoftext|>",
    severity: "critical",
    description: "End-of-text token — can truncate generation",
  },
  {
    regex: /<\|endofprompt\|>/gi,
    label: "<|endofprompt|>",
    severity: "critical",
    description: "End-of-prompt token — can manipulate prompt boundaries",
  },

  // ── HIGH: Instruction override tokens ─────────────────────────
  {
    regex: /\[INST\]/gi,
    label: "[INST]",
    severity: "high",
    description: "Llama/Mistral instruction start token — can inject instructions",
  },
  {
    regex: /\[\/INST\]/gi,
    label: "[/INST]",
    severity: "high",
    description: "Llama/Mistral instruction end token",
  },
  {
    regex: /<<SYS>>/gi,
    label: "<<SYS>>",
    severity: "high",
    description: "Llama system prompt delimiter — can override system instructions",
  },
  {
    regex: /<\|python_tag\|>/gi,
    label: "<|python_tag|>",
    severity: "high",
    description: "Code interpreter tag — can inject tool execution commands",
  },
  {
    regex: /<\|assistant\|>/gi,
    label: "<|assistant|>",
    severity: "high",
    description: "Assistant role token — can impersonate the assistant",
  },
  {
    regex: /<\|user\|>/gi,
    label: "<|user|>",
    severity: "high",
    description: "User role token — can inject false user messages",
  },
  {
    regex: /<\|system\|>/gi,
    label: "<|system|>",
    severity: "high",
    description: "System role token — can override system instructions",
  },
  {
    regex: /<\|tool\|>/gi,
    label: "<|tool|>",
    severity: "high",
    description: "Tool role token — can inject fake tool responses",
  },

  // ── MEDIUM: Padding / BOS / EOS tokens ─────────────────────────
  {
    regex: /<\|pad\|>/gi,
    label: "<|pad|>",
    severity: "medium",
    description: "Padding token — can disrupt tokenizer alignment",
  },
  {
    regex: /<s>/gi,
    label: "<s>",
    severity: "medium",
    description: "BOS token — can shift model attention",
  },
  {
    regex: /<\/s>/gi,
    label: "</s>",
    severity: "medium",
    description: "EOS token — can prematurely end generation",
  },
  {
    regex: /<\|reserved_special_token_\d+\|>/gi,
    label: "<|reserved_special_token_*|>",
    severity: "medium",
    description: "Reserved special token — can hijack token IDs",
  },

  // ── LOW: System override language patterns ─────────────────────
  {
    regex: /\bignore\s+all\s+previous\s+instructions\b/i,
    label: "ignore all previous instructions",
    severity: "medium",
    description: "Instruction override phrase — common injection pattern",
  },
  {
    regex: /\byou\s+are\s+now\s+(?:an?\s+)?(?:admin|assistant|system|operator)\b/i,
    label: "you are now an admin/system",
    severity: "medium",
    description: "Role override phrase — attempts to change model persona",
  },
  {
    regex: /\bsystem\s+prompt\s*:/i,
    label: "system prompt:",
    severity: "low",
    description: "System prompt reference — may indicate prompt extraction attempt",
  },
  {
    regex: /\badmin\s+mode\b/i,
    label: "admin mode",
    severity: "low",
    description: "Admin mode claim — privilege escalation attempt",
  },
];

// ── Scanner ────────────────────────────────────────────────────────

/**
 * Scan a single text input for special token patterns.
 */
export function scanInput(
  text: string,
  source: SpecialTokenMatch["source"],
): SpecialTokenMatch[] {
  if (!text || typeof text !== "string") return [];

  const matches: SpecialTokenMatch[] = [];

  for (const p of PATTERNS) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(p.regex.source, p.regex.flags);
    while ((m = regex.exec(text)) !== null) {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(text.length, m.index + m[0].length + 20);
      const context = (start > 0 ? "..." : "") +
        text.slice(start, end).replace(/\n/g, "\\n") +
        (end < text.length ? "..." : "");

      matches.push({
        pattern: p.label,
        index: m.index,
        context,
        severity: p.severity,
        source,
      });

      // Avoid infinite loops on zero-length matches
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  }

  return matches;
}

// ── Aggregated evaluation ──────────────────────────────────────────

const SEVERITY_ORDER = ["none", "low", "medium", "high", "critical"] as const;

/**
 * Evaluate an input or set of inputs for special token injection.
 * Returns a SafeTokenizationResult with overall safety score.
 */
export function evaluateTokenSafety(
  inputs: Array<{ text: string; source: SpecialTokenMatch["source"] }>,
): SafeTokenizationResult {
  const allMatches: SpecialTokenMatch[] = [];

  for (const input of inputs) {
    const matches = scanInput(input.text, input.source);
    allMatches.push(...matches);
  }

  if (allMatches.length === 0) {
    return {
      hasInjection: false,
      flaggedPatterns: [],
      severity: "none",
      score: 1,
      reason: "No special tokens detected",
    };
  }

  // Determine highest severity
  const maxSeverityIdx = Math.max(
    ...allMatches.map((m) => SEVERITY_ORDER.indexOf(m.severity)),
  );
  const severity = SEVERITY_ORDER[maxSeverityIdx] as SafeTokenizationResult["severity"];

  // Compute score: start at 1, subtract penalty per match weighted by severity
  const severityPenalty: Record<string, number> = {
    critical: 0.25,
    high: 0.15,
    medium: 0.08,
    low: 0.03,
  };

  let penalty = 0;
  for (const match of allMatches) {
    penalty += severityPenalty[match.severity] ?? 0;
  }
  const score = Math.max(0, Math.min(1, 1 - penalty / 2)); // cap penalty at 50% to avoid floor

  const criticalCount = allMatches.filter((m) => m.severity === "critical").length;
  const highCount = allMatches.filter((m) => m.severity === "high").length;

  let reason: string;
  if (criticalCount > 0) {
    reason = `Critical: ${criticalCount} special token pattern(s) detected — possible prompt injection`;
  } else if (highCount > 0) {
    reason = `High: ${highCount} instruction override token(s) detected`;
  } else {
    reason = `${allMatches.length} special token pattern(s) detected (${severity} severity)`;
  }

  return {
    hasInjection: true,
    flaggedPatterns: allMatches,
    severity,
    score: Math.round(score * 100) / 100,
    reason,
  };
}

// ── Convenience: cross-turn drift detection ──────────────────────

export interface Turn {
  query: string;
  response: string;
  timestamp: number;
}

export interface DriftEvent {
  turnIndex: number;
  premise: string;
  contradiction: string;
  score: number; // confidence 0-1
}

/**
 * Simple cross-turn consistency check.
 * Detects when the model contradicts its own factual premises across turns.
 * Uses keyword-based heuristic (not NLI — that goes in a premium tier).
 */
export function detectCrossTurnDrift(
  turns: Turn[],
): DriftEvent[] {
  if (turns.length < 2) return [];

  const drifts: DriftEvent[] = [];

  // Extract factual assertions from each response
  const assertions: Array<{ turnIndex: number; statements: string[] }> = turns.map((turn, i) => ({
    turnIndex: i,
    statements: extractAssertions(turn.response),
  }));

  // Compare each turn with the next
  for (let i = 0; i < assertions.length - 1; i++) {
    const current = assertions[i];
    const next = assertions[i + 1];

    for (const stmt of current.statements) {
      const contradiction = findContradiction(stmt, next.statements);
      if (contradiction) {
        drifts.push({
          turnIndex: i + 1,
          premise: stmt,
          contradiction,
          score: 0.7, // heuristic confidence
        });
      }
    }
  }

  return drifts;
}

/**
 * Simple fact extraction — pulls sentences that look like factual claims.
 */
function extractAssertions(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => {
      const lower = s.toLowerCase();
      return (
        s.length > 15 &&
        !lower.startsWith("i think") &&
        !lower.startsWith("maybe") &&
        !lower.startsWith("perhaps") &&
        !lower.startsWith("it depends")
      );
    });
}

/**
 * Check if a statement is contradicted by a set of statements.
 * Uses negation and polarity-based heuristics.
 */
function findContradiction(stmt: string, candidates: string[]): string | null {
  const stmtWords = new Set(stmt.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (stmtWords.size < 3) return null;

  for (const candidate of candidates) {
    if (candidate === stmt) continue;

    const candidateLower = candidate.toLowerCase();
    const candidateWords = new Set(candidateLower.split(/\s+/).filter((w) => w.length > 3));

    // Check for negation patterns around shared key terms
    const sharedTerms = [...stmtWords].filter((w) => candidateWords.has(w));
    if (sharedTerms.length < 2) continue;

    // If both statements share key terms but one has negation, it's a contradiction
    const negations = /\b(not|never|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|cannot|can't|won't|wouldn't|shouldn't|no|none)\b/i;
    const stmtNegated = negations.test(stmt);
    const candNegated = negations.test(candidateLower);

    if (stmtNegated !== candNegated) {
      return candidate;
    }
  }

  return null;
}