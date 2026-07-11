/**
 * Syslog / RFC 5424 Transformer
 *
 * Parses syslog messages and converts to ObserveAI trace events.
 * Supports RFC 5424, RFC 3164 (BSD), and common JSON-syslog formats.
 */

import type { TransformerAdapter } from "../types";
import type { TransformationResult } from "../../../types/ingestion";

interface SyslogParsed {
  timestamp?: number;
  hostname?: string;
  appName?: string;
  procId?: string;
  msgId?: string;
  message: string;
  facility?: number;
  severity?: number;
  structuredData?: Record<string, string>;
}

// ── RFC 5424 regex ─────────────────────────────────────────────
// <PRI>VERSION TIMESTAMP HOSTNAME APPNAME PROCID MSGID STRUCTURED-DATA MSG
const RFC5424_RE =
  /^<(\d{1,3})>(\d)\s(\S+)\s(\S+)\s(\S+)\s(\S+)\s(\S+)\s(\S+)\s?(.*)?$/;

// ── RFC 3164 (BSD) regex ───────────────────────────────────────
const RFC3164_RE =
  /^<(\d{1,3})>?(\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s(\S+)\s(\S+)\s?(.*)?$/;

function parsePriority(pri: number): { facility: number; severity: number } {
  return { facility: Math.floor(pri / 8), severity: pri % 8 };
}

function parseRfc5424(raw: string): SyslogParsed | null {
  const m = raw.match(RFC5424_RE);
  if (!m) return null;
  const pri = parseInt(m[1], 10);
  const { facility, severity } = parsePriority(pri);
  return {
    timestamp: new Date(m[3]).getTime() || Date.now(),
    hostname: m[4],
    appName: m[5],
    procId: m[6],
    msgId: m[7],
    message: m[9] || "",
    facility,
    severity,
  };
}

function parseRfc3164(raw: string): SyslogParsed | null {
  const m = raw.match(RFC3164_RE);
  if (!m) return null;
  const pri = parseInt(m[1], 10);
  const { facility, severity } = parsePriority(pri);
  return {
    timestamp: new Date(`${m[2]} UTC`).getTime() || Date.now(),
    hostname: m[3],
    appName: m[4],
    message: m[5] || "",
    facility,
    severity,
  };
}

function parseJsonSyslog(raw: string): SyslogParsed | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.message === "string") {
      return {
        timestamp: obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now(),
        hostname: obj.hostname || obj.host || "unknown",
        appName: obj.appName || obj.app_name || obj.application || "unknown",
        message: obj.message,
        facility: obj.facility,
        severity: obj.severity,
        structuredData: obj.structured_data || obj.structuredData,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseSyslog(raw: string): SyslogParsed | null {
  return parseRfc5424(raw) ?? parseRfc3164(raw) ?? parseJsonSyslog(raw);
}

// ── Transformer ─────────────────────────────────────────────────

export const syslogTransformer: TransformerAdapter = {
  name: "syslog",
  format: "syslog",

  supports(raw: unknown): boolean {
    if (typeof raw !== "string") return false;
    // Check if it starts with a syslog PRI or looks like JSON syslog
    return /^<\d{1,3}>/.test(raw) || /^{.*"message".*}/.test(raw);
  },

  async transform(raw: unknown): Promise<TransformationResult> {
    try {
      if (typeof raw !== "string") {
        return { success: false, errorMessage: "Syslog input must be a string" };
      }

      const parsed = parseSyslog(raw);
      if (!parsed) {
        return { success: false, errorMessage: "Could not parse syslog message" };
      }

      const severityLabels = ["emerg", "alert", "crit", "error", "warning", "notice", "info", "debug"];
      const sevLabel = severityLabels[parsed.severity ?? 7] ?? "unknown";

      return {
        success: true,
        traceId: `syslog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        spans: [
          {
            name: `syslog.${parsed.hostname}.${parsed.appName}`,
            durationMs: 0,
            metadata: {
              source: "syslog",
              hostname: parsed.hostname,
              appName: parsed.appName,
              facility: parsed.facility,
              severity: sevLabel,
              message: parsed.message.slice(0, 2000),
              structuredData: parsed.structuredData,
              raw: raw.slice(0, 500),
            },
          },
        ],
      };
    } catch (err) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : "Syslog transform failed",
      };
    }
  },
};