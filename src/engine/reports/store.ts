/**
 * Report History — in-memory store for generated reports.
 * Will be backed by Convex / Supabase in production.
 */

import { type ReportData } from "../../types/reports";
import { generateWeeklyReport } from "./weekly";

// In-memory store
let reports: ReportData[] = [];

export function getReports(): ReportData[] {
  return [...reports];
}

export function generateAndStoreReport(): ReportData {
  const report = generateWeeklyReport(reports);
  reports.push(report);
  return report;
}

export function updateReportStatus(
  id: string,
  status: ReportData["status"],
  deliveredAt?: number,
): ReportData | null {
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  reports[idx] = {
    ...reports[idx],
    status,
    ...(deliveredAt ? { deliveredAt } : {}),
  };
  return reports[idx];
}

export function getLatestReport(): ReportData | null {
  if (reports.length === 0) return null;
  return reports[reports.length - 1];
}

// Seed with one generated report
if (reports.length === 0) {
  generateAndStoreReport();
}