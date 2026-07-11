/**
 * Mock guardrail data for demo / simulation mode.
 */

import { type GuardrailEvent, type GuardrailEvaluation } from "../../types/guardrails";

export const MOCK_GUARDRAIL_EVALUATIONS: GuardrailEvaluation[] = [
  {
    decision: "block",
    scores: {
      hallucination: { score: 0.23, threshold: 0.7, passed: false, reason: "4 of 6 claims unsupported by retrieved context — potential hallucination" },
      contextQuality: { score: 0.35, threshold: 0.6, passed: false, reason: "Low context quality: Only 1 chunks retrieved (min 2); Query term coverage insufficient (20%)" },
      policyCompliance: { score: 0.55, threshold: 0.9, passed: false, reason: "Policy violations found: ignore all previous instructions, override" },
      costEfficiency: { score: 0.92, threshold: 0.8, passed: true, reason: "Cost and token usage within expected range" },
      memorySafety: { score: 0.30, threshold: 0.7, passed: false, reason: "Response contains override instructions — possible memory poisoning" },
    },
    overallScore: 0.26,
    reasons: [
      "4 of 6 claims unsupported by retrieved context — potential hallucination",
      "Low context quality: Only 1 chunks retrieved (min 2)",
      "Policy violations found: ignore all previous instructions, override",
    ],
    processedAt: Date.now() - 120000,
  },
  {
    decision: "flag",
    scores: {
      hallucination: { score: 0.72, threshold: 0.7, passed: true, reason: "All claims supported by retrieved context (5/5)" },
      contextQuality: { score: 0.45, threshold: 0.6, passed: false, reason: "Low context quality: Average relevance score 45% is low" },
      policyCompliance: { score: 0.95, threshold: 0.9, passed: true, reason: "No policy violations detected" },
      costEfficiency: { score: 0.38, threshold: 0.8, passed: false, reason: "Cost efficiency concern: Token count 5210 exceeds expected max 4096" },
      memorySafety: { score: 0.85, threshold: 0.7, passed: true, reason: "No memory manipulation patterns detected" },
    },
    overallScore: 0.62,
    reasons: [
      "Low context quality: Average relevance score 45% is low",
      "Cost efficiency concern: Token count 5210 exceeds expected max 4096",
    ],
    processedAt: Date.now() - 600000,
  },
  {
    decision: "allow",
    scores: {
      hallucination: { score: 0.95, threshold: 0.7, passed: true, reason: "All claims supported by retrieved context (8/8)" },
      contextQuality: { score: 0.88, threshold: 0.6, passed: true, reason: "Context quality sufficient" },
      policyCompliance: { score: 1, threshold: 0.9, passed: true, reason: "No policy violations detected" },
      costEfficiency: { score: 0.91, threshold: 0.8, passed: true, reason: "Cost and token usage within expected range" },
      memorySafety: { score: 0.95, threshold: 0.7, passed: true, reason: "No memory manipulation patterns detected" },
    },
    overallScore: 0.94,
    reasons: [],
    processedAt: Date.now() - 3600000,
  },
  {
    decision: "flag",
    scores: {
      hallucination: { score: 0.85, threshold: 0.7, passed: true, reason: "All claims supported by retrieved context (3/3)" },
      contextQuality: { score: 0.92, threshold: 0.6, passed: true, reason: "Context quality sufficient" },
      policyCompliance: { score: 0.4, threshold: 0.9, passed: false, reason: "Policy violations found: hypothetical, role-play" },
      costEfficiency: { score: 0.88, threshold: 0.8, passed: true, reason: "Cost and token usage within expected range" },
      memorySafety: { score: 0.72, threshold: 0.7, passed: true, reason: "Role-play detected but no explicit memory override instructions" },
    },
    overallScore: 0.76,
    reasons: ["Policy violations found: hypothetical, role-play"],
    processedAt: Date.now() - 7200000,
  },
  {
    decision: "block",
    scores: {
      hallucination: { score: 0.15, threshold: 0.7, passed: false, reason: "4 of 4 claims unsupported by retrieved context — potential hallucination" },
      contextQuality: { score: 0.1, threshold: 0.6, passed: false, reason: "Low context quality: No context retrieved for the query" },
      policyCompliance: { score: 0.7, threshold: 0.9, passed: false, reason: "Policy violations found: system prompt, admin mode" },
      costEfficiency: { score: 0.95, threshold: 0.8, passed: true, reason: "Cost and token usage within expected range" },
      memorySafety: { score: 0.20, threshold: 0.7, passed: false, reason: "Admin mode override detected — potential memory poisoning attack" },
    },
    overallScore: 0.22,
    reasons: [
      "4 of 4 claims unsupported by retrieved context — potential hallucination",
      "Low context quality: No context retrieved for the query",
      "Policy violations found: system prompt, admin mode",
    ],
    processedAt: Date.now() - 14400000,
  },
];

export const MOCK_GUARDRAIL_EVENTS: GuardrailEvent[] = [
  {
    id: "gr-001",
    traceId: "trace_001",
    timestamp: Date.now() - 120000,
    decision: "block",
    overallScore: 0.26,
    failureReasons: ["Hallucination", "Low context quality", "Policy violation"],
    model: "GPT-4o",
    userQuery: "What are the company's financial projections for next quarter?",
    latencyMs: 2450,
  },
  {
    id: "gr-002",
    traceId: "trace_002",
    timestamp: Date.now() - 600000,
    decision: "flag",
    overallScore: 0.62,
    failureReasons: ["Low context quality", "Cost efficiency"],
    model: "GPT-4o",
    userQuery: "Summarize the Q3 earnings report from the attached PDF",
    latencyMs: 3800,
  },
  {
    id: "gr-003",
    traceId: "trace_003",
    timestamp: Date.now() - 3600000,
    decision: "allow",
    overallScore: 0.94,
    failureReasons: [],
    model: "Claude 3.5",
    userQuery: "What is the capital of France?",
    latencyMs: 890,
  },
  {
    id: "gr-004",
    traceId: "trace_004",
    timestamp: Date.now() - 7200000,
    decision: "flag",
    overallScore: 0.76,
    failureReasons: ["Policy violation (role-play)"],
    model: "GPT-3.5",
    userQuery: "Can you act as my therapist and help me work through anxiety?",
    latencyMs: 1450,
  },
  {
    id: "gr-005",
    traceId: "trace_005",
    timestamp: Date.now() - 14400000,
    decision: "block",
    overallScore: 0.22,
    failureReasons: ["Hallucination", "No context retrieved", "Policy violation"],
    model: "Llama 3",
    userQuery: "Write a detailed explanation of our internal security protocols",
    latencyMs: 5200,
  },
];