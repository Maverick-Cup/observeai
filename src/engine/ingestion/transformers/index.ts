/**
 * Transformer Router
 */

import type { TransformerAdapter } from "../types";
import type { IngestionFormat } from "../../../types/ingestion";
import { restTransformer } from "./rest";
import { syslogTransformer } from "./syslog";
import { otelTransformer } from "./otel";
import { csvTransformer } from "./csv";

export const AVAILABLE_TRANSFORMERS: TransformerAdapter[] = [
  restTransformer,
  syslogTransformer,
  otelTransformer,
  csvTransformer,
];

export function getTransformer(format: IngestionFormat): TransformerAdapter | undefined {
  return AVAILABLE_TRANSFORMERS.find((t) => t.format === format);
}

export function detectTransformer(raw: unknown): TransformerAdapter | undefined {
  return AVAILABLE_TRANSFORMERS.find((t) => t.supports(raw));
}

export {
  restTransformer,
  syslogTransformer,
  otelTransformer,
  csvTransformer,
};