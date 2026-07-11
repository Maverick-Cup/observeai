/**
 * Guardrail Scorers — four inline evaluation functions that score every response
 * before it ships. Each returns a score 0–1 and a pass/fail verdict.
 */

import {
  type GuardrailScorerResult,
  type HallucinationScorerInput,
  type ContextQualityScorerInput,
  type PolicyComplianceScorerInput,
  type CostEfficiencyScorerInput,
  type MemorySafetyScorerInput,
  MODEL_COST_MAP,
} from "../../types/guardrails";
import { evaluateTokenSafety } from "./safe-tokenization";

// ── 5. Memory Safety Scorer ─────────────────────────────────────
// Detects memory poisoning, prompt injection, and special-token
// smuggling in both input (user queries) and output (model responses).

const MEMORY_SAFETY_TOKEN_LIMIT = 2048;

export function scoreMemorySafety(
  input: MemorySafetyScorerInput,
  threshold: number = 0.7,
): GuardrailScorerResult {
  const { userInput, response } = input;

  if ((!userInput || userInput.trim().length === 0) && (!response || response.trim().length === 0)) {
    return { score: 0.5, threshold, passed: false, reason: "No content to evaluate" };
  }

  const issues: string[] = [];

  // Evaluate user query for injection / poisoning
  if (userInput) {
    const queryResult = evaluateTokenSafety(userInput);
    if (queryResult.flags.length > 0) {
      issues.push(...queryResult.flags.map((f) => `Input: ${f}`));
    }
    if (queryResult.riskLevel === "high") {
      issues.push("Input contains high-risk token injection patterns");
    }
  }

  // Evaluate model response for leaked tokens or poisoned output
  if (response) {
    const responseResult = evaluateTokenSafety(response);
    if (responseResult.flags.length > 0) {
      issues.push(...responseResult.flags.map((f) => `Output: ${f}`));
    }
    if (responseResult.riskLevel === "high") {
      issues.push("Model output contains special tokens — possible prompt leak");
    }
  }

  // Score calculation
  const issueCount = issues.length;
  const baseScore = issueCount === 0 ? 1.0 : Math.max(0, 1.0 - Math.min(issueCount * 0.25, 0.95));
  const score = Math.round(baseScore * 100) / 100;

  return {
    score,
    threshold,
    passed: score >= threshold,
    reason: issueCount === 0
      ? "No memory safety issues detected"
      : `Memory safety flags (${issueCount}): ${issues.slice(0, 5).join("; ")}${issues.length > 5 ? ` (+${issues.length - 5} more)` : ""}`,
  };
}

// ── Helper: simple sentence splitter ─────────────────────────────

function extractClaims(response: string): string[] {
  // Split on sentence boundaries. This is a heuristic — real impl would use NER/NLI.
  return response
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function containsClaimInChunks(claim: string, chunks: string[]): boolean {
  const claimWords = claim.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (claimWords.length === 0) return true;
  let matchCount = 0;
  for (const word of claimWords) {
    for (const chunk of chunks) {
      if (chunk.toLowerCase().includes(word)) {
        matchCount++;
        break;
      }
    }
  }
  return matchCount / claimWords.length >= 0.4; // 40% of significant words found
}

// ── 1. Hallucination Scorer ──────────────────────────────────────

export function scoreHallucination(
  input: HallucinationScorerInput,
  threshold: number = 0.7,
): GuardrailScorerResult {
  const { response, retrievedChunks } = input;

  if (!response || response.trim().length === 0) {
    return { score: 0.5, threshold, passed: false, reason: "Empty response — cannot verify" };
  }

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return { score: 0.3, threshold, passed: false, reason: "No retrieved context to verify against" };
  }

  const claims = extractClaims(response);
  if (claims.length === 0) {
    return { score: 0.8, threshold, passed: true, reason: "No substantive claims to verify" };
  }

  const supportedClaims = claims.filter((c) => containsClaimInChunks(c, retrievedChunks));
  const score = supportedClaims.length / claims.length;

  return {
    score: Math.round(score * 100) / 100,
    threshold,
    passed: score >= threshold,
    reason: score >= threshold
      ? `All claims supported by retrieved context (${supportedClaims.length}/${claims.length})`
      : `${claims.length - supportedClaims.length} of ${claims.length} claims unsupported by retrieved context — potential hallucination`,
  };
}

// ── 2. Context Quality Scorer ─────────────────────────────────────

export function scoreContextQuality(
  input: ContextQualityScorerInput,
  threshold: number = 0.6,
): GuardrailScorerResult {
  const { query, retrievedChunks, minChunks = 2 } = input;

  if (!query || query.trim().length === 0) {
    return { score: 0.5, threshold, passed: false, reason: "No user query to evaluate context against" };
  }

  if (!retrievedChunks || retrievedChunks.length === 0) {
    return { score: 0.2, threshold, passed: false, reason: "No context retrieved for the query" };
  }

  // Score 1: Sufficient number of chunks
  const chunkSufficiency = Math.min(retrievedChunks.length / minChunks, 1);

  // Score 2: Average relevance score of chunks
  const avgRelevance = retrievedChunks.reduce((sum, ch) => sum + (ch.score ?? 0.5), 0) / retrievedChunks.length;

  // Score 3: Query term overlap (simple heuristic)
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let chunkWords = new Set<string>();
  for (const ch of retrievedChunks) {
    ch.content.toLowerCase().split(/\s+/).forEach((w) => {
      if (w.length > 2) chunkWords.add(w);
    });
  }
  const matchedTerms = queryWords.filter((w) => chunkWords.has(w));
  const queryCoverage = queryWords.length > 0 ? matchedTerms.length / queryWords.length : 1;

  // Composite: 30% chunk sufficiency, 40% relevance, 30% query coverage
  const score = chunkSufficiency * 0.3 + avgRelevance * 0.4 + queryCoverage * 0.3;

  const reasons: string[] = [];
  if (retrievedChunks.length < minChunks) reasons.push(`Only ${retrievedChunks.length} chunks retrieved (min ${minChunks})`);
  if (avgRelevance < 0.5) reasons.push(`Average relevance score ${(avgRelevance * 100).toFixed(0)}% is low`);
  if (queryCoverage < 0.3) reasons.push(`Query term coverage insufficient (${(queryCoverage * 100).toFixed(0)}%)`);

  return {
    score: Math.round(score * 100) / 100,
    threshold,
    passed: score >= threshold,
    reason: score >= threshold
      ? "Context quality sufficient"
      : `Low context quality: ${reasons.join("; ")}`,
  };
}

// ── 3. Policy Compliance Scorer ──────────────────────────────────

// Default blocklist of common prohibited / dangerous patterns
const DEFAULT_BLOCKLIST = [
  "ignore all previous instructions",
  "you are now",
  "system prompt",
  "admin mode",
  "override",
  "jailbreak",
  "dan",
  "do anything now",
  "hypothetical",
  "role-play",
];

export function scorePolicyCompliance(
  input: PolicyComplianceScorerInput,
  threshold: number = 0.9,
): GuardrailScorerResult {
  const { response, blocklist, patterns } = input;
  const activeBlocklist = blocklist ?? DEFAULT_BLOCKLIST;
  const responseLower = response.toLowerCase();

  // Check blocklist
  const violations: string[] = [];
  for (const term of activeBlocklist) {
    if (responseLower.includes(term.toLowerCase())) {
      violations.push(term);
    }
  }

  // Check custom regex patterns
  if (patterns) {
    for (const pattern of patterns) {
      if (pattern.test(response)) {
        violations.push(`Pattern match: ${pattern.source}`);
      }
    }
  }

  // Score: 1 if no violations, decreasing per violation
  const violationPenalty = violations.length * 0.15;
  const score = Math.max(0, 1 - violationPenalty);

  return {
    score: Math.round(score * 100) / 100,
    threshold,
    passed: score >= threshold,
    reason: violations.length === 0
      ? "No policy violations detected"
      : `Policy violations found: ${violations.slice(0, 3).join(", ")}${violations.length > 3 ? ` (+${violations.length - 3} more)` : ""}`,
  };
}

// ── 4. Cost Efficiency Scorer ─────────────────────────────────────

export function scoreCostEfficiency(
  input: CostEfficiencyScorerInput,
  threshold: number = 0.8,
): GuardrailScorerResult {
  const { totalTokens, model, expectedTokensMin, expectedTokensMax, costUsd, expectedCostMax } = input;

  const modelConfig = MODEL_COST_MAP[model] ?? MODEL_COST_MAP.default;
  const minTokens = expectedTokensMin ?? modelConfig.minTokens;
  const maxTokens = expectedTokensMax ?? modelConfig.maxTokens;
  const maxCost = expectedCostMax ?? modelConfig.maxTokens * modelConfig.costPerToken * 2;

  // Token efficiency score
  let tokenScore = 1;
  if (totalTokens < minTokens) {
    tokenScore = totalTokens / minTokens; // too short, might be low quality
  } else if (totalTokens > maxTokens) {
    tokenScore = Math.max(0, 1 - (totalTokens - maxTokens) / maxTokens); // too long
  }

  // Cost efficiency score
  let costScore = 1;
  if (costUsd !== undefined && maxCost > 0) {
    costScore = Math.max(0, 1 - (costUsd / maxCost));
  }

  const score = tokenScore * 0.5 + costScore * 0.5;

  const reasons: string[] = [];
  if (totalTokens > maxTokens) reasons.push(`Token count ${totalTokens} exceeds expected max ${maxTokens}`);
  if (totalTokens < minTokens) reasons.push(`Response too short (${totalTokens} tokens, expected ${minTokens})`);
  if (costUsd !== undefined && costUsd > maxCost) reasons.push(`Cost $${costUsd.toFixed(4)} exceeds max $${maxCost.toFixed(4)}`);

  return {
    score: Math.round(score * 100) / 100,
    threshold,
    passed: score >= threshold,
    reason: score >= threshold
      ? "Cost and token usage within expected range"
      : `Cost efficiency concern: ${reasons.join("; ")}`,
  };
}