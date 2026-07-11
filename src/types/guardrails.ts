/**
 * Guardrail types — the inline eval pipeline that scores every response before it ships.
 */

export type GuardrailDecision = "allow" | "flag" | "block";

export interface GuardrailScorerResult {
  score: number;       // 0–1, higher = better/safer
  threshold: number;   // configurable threshold for this scorer
  passed: boolean;     // score >= threshold
  reason: string;      // human-readable explanation
}

export interface HallucinationScorerInput {
  response: string;
  retrievedChunks: string[];
}

export interface ContextQualityScorerInput {
  query: string;
  retrievedChunks: Array<{ content: string; score?: number }>;
  minChunks?: number;
}

export interface PolicyComplianceScorerInput {
  response: string;
  blocklist?: string[];
  patterns?: RegExp[];
}

export interface CostEfficiencyScorerInput {
  totalTokens: number;
  model: string;
  expectedTokensMin?: number;
  expectedTokensMax?: number;
  costUsd?: number;
  expectedCostMax?: number;
}

export interface MemorySafetyScorerInput {
  userInput?: string;
  retrievedChunks?: string[];
  response?: string;
}

export interface GuardrailScorerInputs {
  hallucination: HallucinationScorerInput;
  contextQuality: ContextQualityScorerInput;
  policyCompliance: PolicyComplianceScorerInput;
  costEfficiency: CostEfficiencyScorerInput;
  memorySafety: MemorySafetyScorerInput;
}

export interface GuardrailScorerThresholds {
  hallucination: number;    // default 0.7
  contextQuality: number;   // default 0.6
  policyCompliance: number; // default 0.9
  costEfficiency: number;   // default 0.8
  memorySafety: number;     // default 0.7
}

export interface GuardrailEvaluation {
  decision: GuardrailDecision;
  scores: {
    hallucination: GuardrailScorerResult;
    contextQuality: GuardrailScorerResult;
    policyCompliance: GuardrailScorerResult;
    costEfficiency: GuardrailScorerResult;
    memorySafety: GuardrailScorerResult;
  };
  overallScore: number; // weighted average of all scorer scores
  reasons: string[];    // all failure reasons (if any)
  processedAt: number;  // timestamp
}

export interface GuardrailEvent {
  id: string;
  traceId: string;
  timestamp: number;
  decision: GuardrailDecision;
  overallScore: number;
  failureReasons: string[];
  model: string;
  userQuery: string;
  latencyMs: number;
}

// For the Guardrails pipeline simulation page
export interface GuardrailPipelineConfig {
  enabled: boolean;
  thresholds: GuardrailScorerThresholds;
  blockOnScoreBelow: number;   // overall < this → BLOCK
  flagOnScoreBelow: number;    // overall < this → FLAG, else ALLOW
  enabledScorers: Array<keyof GuardrailScorerInputs>;
}

export const DEFAULT_GUARDRAIL_CONFIG: GuardrailPipelineConfig = {
  enabled: true,
  thresholds: {
    hallucination: 0.7,
    contextQuality: 0.6,
    policyCompliance: 0.9,
    costEfficiency: 0.8,
    memorySafety: 0.7,
  },
  blockOnScoreBelow: 0.4,
  flagOnScoreBelow: 0.7,
  enabledScorers: ["hallucination", "contextQuality", "policyCompliance", "costEfficiency", "memorySafety"],
};

export const MODEL_COST_MAP: Record<string, { minTokens: number; maxTokens: number; costPerToken: number }> = {
  "GPT-4o": { minTokens: 200, maxTokens: 4096, costPerToken: 0.00001 },
  "GPT-4": { minTokens: 200, maxTokens: 4096, costPerToken: 0.00003 },
  "GPT-3.5": { minTokens: 100, maxTokens: 2048, costPerToken: 0.0000015 },
  "Claude 3.5": { minTokens: 200, maxTokens: 4096, costPerToken: 0.000015 },
  "Claude 3": { minTokens: 200, maxTokens: 4096, costPerToken: 0.00001 },
  "Llama 3": { minTokens: 100, maxTokens: 2048, costPerToken: 0.0000005 },
  "Mistral": { minTokens: 100, maxTokens: 2048, costPerToken: 0.000001 },
  default: { minTokens: 100, maxTokens: 4096, costPerToken: 0.00001 },
};