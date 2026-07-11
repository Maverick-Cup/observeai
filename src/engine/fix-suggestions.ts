/**
 * Fix Suggestions Engine
 *
 * Generates human-readable fix suggestions from Reliability Score dimension failures.
 * Each dimension has tailored logic that maps low scores to actionable recommendations.
 */

import type { ScoreInputs } from "./reliability-score";

export interface FixSuggestion {
  dimension: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action: string;
}

// ── Timeouts & Retries ───────────────────────────────────────────

function suggestTimeoutsRetries(
  score: number,
  input: ScoreInputs["timeoutsRetries"],
): FixSuggestion | null {
  if (score >= 80) return null;

  const timeoutRate = input.totalCalls > 0 ? input.timeoutCount / input.totalCalls : 0;
  const retrySuccessRate = input.retryCount > 0 ? input.retrySuccessCount / input.retryCount : 1;

  if (timeoutRate > 0.05) {
    return {
      dimension: "timeoutsRetries",
      severity: score < 60 ? "critical" : "warning",
      title: "High timeout rate",
      description: `${(timeoutRate * 100).toFixed(1)}% of calls are timing out (${input.timeoutCount} of ${input.totalCalls}).`,
      action: `Increase timeout limit or add circuit breaker — rate of ${(timeoutRate * 100).toFixed(1)}% exceeds the 5% threshold.`,
    };
  }

  if (retrySuccessRate < 0.8) {
    return {
      dimension: "timeoutsRetries",
      severity: score < 60 ? "critical" : "warning",
      title: "Retries failing too often",
      description: `Only ${(retrySuccessRate * 100).toFixed(0)}% of retries succeed (${input.retrySuccessCount}/${input.retryCount}).`,
      action: "Consider increasing backoff duration or switching to exponential backoff with jitter.",
    };
  }

  if (input.circuitBreakerTrips > 0) {
    return {
      dimension: "timeoutsRetries",
      severity: "warning",
      title: "Circuit breaker tripped",
      description: `Circuit breaker tripped ${input.circuitBreakerTrips} times.`,
      action: "Review downstream dependency health. Consider increasing circuit breaker threshold or implementing half-open recovery.",
    };
  }

  return null;
}

// ── Prompt Injection ─────────────────────────────────────────────

function suggestPromptInjection(
  score: number,
  input: ScoreInputs["promptInjection"],
): FixSuggestion | null {
  if (score >= 80 || input.totalAttempts === 0) return null;

  const unblockedCount = input.totalAttempts - input.blockedCount;

  if (unblockedCount > 0) {
    return {
      dimension: "promptInjection",
      severity: unblockedCount > 5 ? "critical" : "warning",
      title: "Injection attempts slipping through",
      description: `${unblockedCount} of ${input.totalAttempts} injection attempts were not blocked.`,
      action: `Tighten guardrail regex patterns for top threat vectors. ${input.criticalCount} critical attempts detected — prioritize these first.`,
    };
  }

  if (input.criticalCount > 0) {
    return {
      dimension: "promptInjection",
      severity: "warning",
      title: "Critical injection attempts detected",
      description: `${input.criticalCount} critical-severity injection attempts were blocked.`,
      action: "Review the critical patterns and consider adding human-in-the-loop verification for high-risk inputs.",
    };
  }

  return null;
}

// ── Test Determinism ─────────────────────────────────────────────

function suggestTestDeterminism(
  score: number,
  input: ScoreInputs["testDeterminism"],
): FixSuggestion | null {
  if (score >= 80) return null;

  if (input.totalRuns === 0) {
    return {
      dimension: "testDeterminism",
      severity: "info",
      title: "No eval runs recorded",
      description: "There are no eval runs to measure determinism.",
      action: "Run your first eval suite to establish a baseline pass rate.",
    };
  }

  if (input.regressionCount > 0) {
    return {
      dimension: "testDeterminism",
      severity: input.regressionCount > 3 ? "critical" : "warning",
      title: `${input.regressionCount} regression(s) detected`,
      description: `Current pass rate is ${input.currentPassRate.toFixed(1)}% with ${input.regressionCount} regressions from ${input.totalRuns} runs.`,
      action: "Review recent prompt version changes. Consider reverting to the previous version that had a higher pass rate.",
    };
  }

  if (input.currentPassRate < 70) {
    return {
      dimension: "testDeterminism",
      severity: "critical",
      title: "Low eval pass rate",
      description: `Pass rate is ${input.currentPassRate.toFixed(1)}%, well below the 70% target.`,
      action: "Audit your test cases for flakiness and review model output quality. Consider updating prompt instructions or switching to a more capable model.",
    };
  }

  return null;
}

// ── Cost Control ─────────────────────────────────────────────────

function suggestCostControl(
  score: number,
  input: ScoreInputs["costControl"],
): FixSuggestion | null {
  if (score >= 80) return null;

  const spendRatio = input.budget > 0 ? input.spent / input.budget : 0;
  const overshoot = Math.max(0, input.projected - input.budget);

  if (overshoot > 0) {
    return {
      dimension: "costControl",
      severity: overshoot > input.budget * 0.2 ? "critical" : "warning",
      title: "Projected budget overshoot",
      description: `Projected to exceed budget by $${overshoot.toFixed(2)} (${((input.projected / input.budget - 1) * 100).toFixed(0)}% over).`,
      action: `Reduce max_tokens on long-context calls or switch expensive model calls to a cheaper alternative. Current burn rate: $${(input.spent / 30).toFixed(2)}/day.`,
    };
  }

  if (spendRatio > 0.8) {
    return {
      dimension: "costControl",
      severity: "warning",
      title: "Budget nearly exhausted",
      description: `${(spendRatio * 100).toFixed(0)}% of monthly budget spent ($${input.spent.toFixed(2)} of $${input.budget.toFixed(2)}).`,
      action: "Consider increasing budget or implementing per-call token limits to slow burn rate.",
    };
  }

  return null;
}

// ── Context Window ───────────────────────────────────────────────

function suggestContextWindow(
  score: number,
  input: ScoreInputs["contextWindow"],
): FixSuggestion | null {
  if (score >= 80) return null;

  if (input.totalTraces === 0) {
    return null;
  }

  const truncationRate = input.truncationCount / input.totalTraces;
  const over80Rate = input.over80PctCount / input.totalTraces;

  if (truncationRate > 0.05) {
    return {
      dimension: "contextWindow",
      severity: truncationRate > 0.1 ? "critical" : "warning",
      title: "Frequent context truncation",
      description: `${(truncationRate * 100).toFixed(1)}% of traces hit the context limit (${input.truncationCount} of ${input.totalTraces}).`,
      action: "Review chunking strategy or increase context size. Truncation may be losing important context.",
    };
  }

  if (over80Rate > 0.3) {
    return {
      dimension: "contextWindow",
      severity: "warning",
      title: "High context utilization",
      description: `${(over80Rate * 100).toFixed(1)}% of traces use >80% of context window (${input.over80PctCount} of ${input.totalTraces}).`,
      action: "Implement relevance-based retrieval to reduce token count. Consider summarizing older turns in chat history.",
    };
  }

  if (input.avgRelevance !== null && input.avgRelevance < 0.5) {
    return {
      dimension: "contextWindow",
      severity: "warning",
      title: "Low retrieved-relevance score",
      description: `Average relevance score is ${(input.avgRelevance * 100).toFixed(0)}% — below the 50% threshold.`,
      action: "Review retrieval pipeline. Consider hybrid search (dense + sparse), re-ranking, or improving embedding quality.",
    };
  }

  return null;
}

// ── Eval Harness ─────────────────────────────────────────────────

function suggestEvalHarness(
  score: number,
  input: ScoreInputs["evalHarness"],
): FixSuggestion | null {
  if (score >= 80) return null;

  if (input.totalRuns === 0) {
    return {
      dimension: "evalHarness",
      severity: "info",
      title: "No eval runs configured",
      description: "The eval harness has not been run yet.",
      action: "Create your first eval run to establish baseline scores and enable regression detection.",
    };
  }

  const majorRegressions = input.regressions.filter((r) => r.severity === "major" || r.severity === "critical");
  const worstDelta = input.regressions.length > 0
    ? Math.min(...input.regressions.map((r) => r.delta))
    : 0;

  if (majorRegressions.length > 0) {
    return {
      dimension: "evalHarness",
      severity: "critical",
      title: `${majorRegressions.length} major regression(s) detected`,
      description: `${majorRegressions.length} regression(s) with severity "major" or "critical". Worst delta: ${Math.abs(worstDelta).toFixed(0)} points.`,
      action: "Identify the prompt version that caused the regression and revert or update the prompt. Run eval suite against previous versions to confirm.",
    };
  }

  if (input.currentPassRate < 75) {
    return {
      dimension: "evalHarness",
      severity: "warning",
      title: "Eval pass rate below target",
      description: `Current pass rate is ${input.currentPassRate.toFixed(1)}%, below the 75% target.`,
      action: "Review failing test cases for common failure patterns. Consider updating prompt instructions to address edge cases.",
    };
  }

  return null;
}

// ── Output Trust ─────────────────────────────────────────────────

function suggestOutputTrust(
  score: number,
  input: ScoreInputs["outputTrust"],
): FixSuggestion | null {
  if (score >= 80) return null;

  if (input.total === 0) return null;

  const validRate = input.total > 0 ? input.validCount / input.total : 1;
  const invalidCount = input.total - input.validCount;

  if (invalidCount > 0) {
    const topErrorRate = input.invalidCount > 0 ? input.topErrorCount / input.invalidCount : 0;

    if (topErrorRate > 0.5) {
      return {
        dimension: "outputTrust",
        severity: invalidCount > 100 ? "critical" : "warning",
        title: "Schema validation failures: dominant error type",
        description: `One error type accounts for ${(topErrorRate * 100).toFixed(0)}% of all ${invalidCount} validation failures. Valid rate: ${(validRate * 100).toFixed(1)}%.`,
        action: "Add targeted error handling for the most common error. Consider updating the schema to accommodate valid edge cases.",
      };
    }

    return {
      dimension: "outputTrust",
      severity: invalidCount > 100 ? "warning" : "info",
      title: `${invalidCount} schema validation failures`,
      description: `${invalidCount} of ${input.total} responses failed schema validation (${(validRate * 100).toFixed(1)}% valid).`,
      action: "Review model output formatting. Consider adding structured output mode (JSON mode, tool calls) to enforce schema compliance.",
    };
  }

  return null;
}

// ── Orchestrator ─────────────────────────────────────────────────

export interface FixSuggestionInputs {
  scores: Record<string, number>; // dimension key → score (0-100)
  rawInputs: ScoreInputs;
}

/**
 * Generate all fix suggestions based on current dimension scores and raw data.
 * Returns only non-null suggestions, sorted by severity (critical first).
 */
export function generateFixSuggestions(input: FixSuggestionInputs): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  const critical = suggestTimeoutsRetries(input.scores.timeoutsRetries, input.rawInputs.timeoutsRetries);
  if (critical) suggestions.push(critical);

  const injection = suggestPromptInjection(input.scores.promptInjection, input.rawInputs.promptInjection);
  if (injection) suggestions.push(injection);

  const determinism = suggestTestDeterminism(input.scores.testDeterminism, input.rawInputs.testDeterminism);
  if (determinism) suggestions.push(determinism);

  const cost = suggestCostControl(input.scores.costControl, input.rawInputs.costControl);
  if (cost) suggestions.push(cost);

  const context = suggestContextWindow(input.scores.contextWindow, input.rawInputs.contextWindow);
  if (context) suggestions.push(context);

  const evalHarness = suggestEvalHarness(input.scores.evalHarness, input.rawInputs.evalHarness);
  if (evalHarness) suggestions.push(evalHarness);

  const trust = suggestOutputTrust(input.scores.outputTrust, input.rawInputs.outputTrust);
  if (trust) suggestions.push(trust);

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return suggestions;
}