/**
 * Guardrail Orchestrator — runs all scorers in parallel, aggregates results,
 * and returns an ALLOW / FLAG / BLOCK decision.
 */

import {
  type GuardrailEvaluation,
  type GuardrailScorerInputs,
  type GuardrailScorerThresholds,
  type GuardrailPipelineConfig,
  DEFAULT_GUARDRAIL_CONFIG,
} from "../../types/guardrails";
import {
  scoreHallucination,
  scoreContextQuality,
  scorePolicyCompliance,
  scoreCostEfficiency,
  scoreMemorySafety,
} from "./scorers";

// ── Orchestrator ──────────────────────────────────────────────────

export function evaluateGuardrails(
  inputs: GuardrailScorerInputs,
  config?: Partial<GuardrailPipelineConfig>,
): GuardrailEvaluation {
  const fullConfig: GuardrailPipelineConfig = { ...DEFAULT_GUARDRAIL_CONFIG, ...config };
  const thresholds: GuardrailScorerThresholds = {
    ...DEFAULT_GUARDRAIL_CONFIG.thresholds,
    ...config?.thresholds,
  };

  const processedAt = Date.now();

  // Run all enabled scorers in parallel (conceptually — synchronous here)
  const h = fullConfig.enabledScorers.includes("hallucination")
    ? scoreHallucination(inputs.hallucination, thresholds.hallucination)
    : { score: 1, threshold: 0.5, passed: true, reason: "Scorer disabled" };

  const cq = fullConfig.enabledScorers.includes("contextQuality")
    ? scoreContextQuality(inputs.contextQuality, thresholds.contextQuality)
    : { score: 1, threshold: 0.5, passed: true, reason: "Scorer disabled" };

  const pc = fullConfig.enabledScorers.includes("policyCompliance")
    ? scorePolicyCompliance(inputs.policyCompliance, thresholds.policyCompliance)
    : { score: 1, threshold: 0.5, passed: true, reason: "Scorer disabled" };

  const ce = fullConfig.enabledScorers.includes("costEfficiency")
    ? scoreCostEfficiency(inputs.costEfficiency, thresholds.costEfficiency)
    : { score: 1, threshold: 0.5, passed: true, reason: "Scorer disabled" };

  const ms = fullConfig.enabledScorers.includes("memorySafety")
    ? scoreMemorySafety(inputs.memorySafety, thresholds.memorySafety)
    : { score: 1, threshold: 0.5, passed: true, reason: "Scorer disabled" };

  // Overall score: weighted average (equal weights for now)
  const scores = [h.score, cq.score, pc.score, ce.score, ms.score];
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Collect reasons from failed scorers
  const reasons: string[] = [];
  if (!h.passed) reasons.push(h.reason);
  if (!cq.passed) reasons.push(cq.reason);
  if (!pc.passed) reasons.push(pc.reason);
  if (!ce.passed) reasons.push(ce.reason);
  if (!ms.passed) reasons.push(ms.reason);

  // Decision logic
  let decision: GuardrailEvaluation["decision"] = "allow";
  if (overallScore < fullConfig.blockOnScoreBelow) {
    decision = "block";
  } else if (overallScore < fullConfig.flagOnScoreBelow) {
    decision = "flag";
  }

  return {
    decision,
    scores: {
      hallucination: h,
      contextQuality: cq,
      policyCompliance: pc,
      costEfficiency: ce,
      memorySafety: ms,
    },
    overallScore: Math.round(overallScore * 100) / 100,
    reasons,
    processedAt,
  };
}

/**
 * Generate a human-readable summary of the guardrail evaluation.
 */
export function guardrailSummary(eval_: GuardrailEvaluation): string {
  const prefix =
    eval_.decision === "block"
      ? "🚫 BLOCKED"
      : eval_.decision === "flag"
        ? "⚠️ Flagged"
        : "✅ Allowed";

  if (eval_.reasons.length === 0) {
    return `${prefix} — All checks passed (score: ${(eval_.overallScore * 100).toFixed(0)}%)`;
  }

  return `${prefix} — ${eval_.reasons[0]}${eval_.reasons.length > 1 ? ` (+${eval_.reasons.length - 1} more issues)` : ""}`;
}