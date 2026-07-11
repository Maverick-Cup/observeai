import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Shield,
  BarChart3,
  Download,
  Send,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { useState, useMemo } from "react";
import { generateAndStoreReport, getReports } from "../engine/reports/store";
import type { ReportData } from "../types/reports";

function DimensionBar({ name, score, change, status }: { name: string; score: number; change: number; status: ReportData["dimensions"][0]["status"] }) {
  const statusColor = status === "healthy" ? "bg-success" : status === "at_risk" ? "bg-warning" : "bg-destructive";
  const statusLabel = status === "healthy" ? "Chill" : status === "at_risk" ? "Sweating" : "On Fire";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 flex-shrink-0">
        <span className="text-xs font-medium text-foreground">{name}</span>
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${statusColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="w-12 text-right">
        <span className="text-xs font-mono text-foreground">{score}</span>
      </div>
      <div className="w-16 flex items-center gap-1">
        {change > 0 ? (
          <TrendingUp className="w-3 h-3 text-success" />
        ) : change < 0 ? (
          <TrendingDown className="w-3 h-3 text-destructive" />
        ) : null}
        <span className={`text-xs font-mono ${change > 0 ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {change > 0 ? "+" : ""}{change.toFixed(1)}
        </span>
      </div>
      <Badge variant={status === "healthy" ? "success" : status === "at_risk" ? "warning" : "error"}>
        {statusLabel}
      </Badge>
    </div>
  );
}

function ReportCard({ report }: { report: ReportData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hatched {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                <span className="mx-1">•</span>
                {report.totalTraces.toLocaleString()} traces peeked at
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={report.status === "delivered" ? "success" : report.status === "draft" ? "neutral" : "error"}>
              {report.status === "delivered" ? "Delivered ✔️" : report.status === "draft" ? "Draft (slacker)" : "Failed 💀"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Less Chat" : "Spill the Tea"}
            </Button>
          </div>
        </div>

        {/* Summary metrics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Vibe Check (Reliability Score)</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-lg font-bold font-heading text-foreground">{report.overallScore}</span>
              <span className={`text-xs ${report.scoreChange >= 0 ? "text-success" : "text-destructive"}`}>
                {report.scoreChange >= 0 ? "↑" : "↓"}{Math.abs(report.scoreChange).toFixed(1)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telling the Truth (Accuracy)</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-lg font-bold font-heading text-foreground">{report.accuracyPercent.toFixed(1)}%</span>
              <span className={`text-xs ${report.accuracyChange >= 0 ? "text-success" : "text-destructive"}`}>
                {report.accuracyChange >= 0 ? "+" : ""}{report.accuracyChange.toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Broke per Good Response</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-lg font-bold font-heading text-foreground">${report.costPerGoodResponse.toFixed(4)}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Guardrail Drama</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-lg font-bold font-heading text-foreground">{report.totalGuardrailEvents}</span>
              <span className="text-xs text-muted-foreground">
                ({report.blockCount} blocked, {report.flagCount} side-eyed)
              </span>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Dimensions */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">The 7 Pillars of (Un)Reliability</h4>
              <div className="space-y-0">
                {report.dimensions.map((d) => (
                  <DimensionBar key={d.name} name={d.name} score={d.score} change={d.change} status={d.status} />
                ))}
              </div>
            </div>

            {/* Regressions */}
            {report.regressions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Things That Got Worse (Yikes)</h4>
                <div className="space-y-1.5">
                  {report.regressions.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingDown className="w-3 h-3 text-destructive" />
                      <span><span className="font-medium text-foreground">{r.dimension}</span> went from {r.previousScore.toFixed(0)} → {r.currentScore.toFixed(0)} — that's a {r.delta.toFixed(1)}-point oof</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Fixes */}
            {report.topFixes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Stop Doing Dumb Stuff (Recommended Fixes)</h4>
                <div className="space-y-1.5">
                  {report.topFixes.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Shield className="w-3 h-3 text-primary mt-0.5" />
                      <div>
                        <span className="text-foreground font-medium">{f.dimension}:</span>{" "}
                        <span className="text-muted-foreground">{f.suggestion}</span>
                        <Badge variant={f.impact === "high" ? "error" : f.impact === "medium" ? "warning" : "neutral"} additionalClass="ml-1">
                          {f.impact === "high" ? "Do This Now" : f.impact === "medium" ? "Meh, Soon-ish" : "Eventually"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Where Your Money Disappeared (Cost by Model)</h4>
              <div className="space-y-1.5">
                {report.costByModel.map((cm) => (
                  <div key={cm.model} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{cm.model}</span>
                    <span className="text-foreground font-mono">${cm.cost.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                  <span className="text-foreground font-medium">Total Burn Rate</span>
                  <span className="text-foreground font-mono font-bold">${report.totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4" /> Save to Brag About Later
              </Button>
              <Button variant="outline" size="sm">
                <Send className="w-4 h-4" /> Blame the Team
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Reports() {
  const [reports, setReports] = useState<ReportData[]>(() => getReports());
  const [generating, setGenerating] = useState(false);

  const latestReport = useMemo(() => {
    if (reports.length === 0) return null;
    return reports[reports.length - 1];
  }, [reports]);

  const generateNew = () => {
    setGenerating(true);
    setTimeout(() => {
      const report = generateAndStoreReport();
      setReports(getReports());
      setGenerating(false);
    }, 1200);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">The Weekly Roast</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated weekly gossip on how your AI is (not) holding it together — reliability, cost, and who's slacking
          </p>
        </div>
        <Button onClick={generateNew} disabled={generating}>
          <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Summoning the Data Spirits..." : "Generate Roast"}
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No tea to spill yet"
          description="You haven't generated any reports, which means either everything is perfect (doubtful) or you've been procrastinating (likely). Click the button above to get roasted."
          action={{
            label: "Generate My First Roast",
            onClick: generateNew,
          }}
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </AppShell>
  );
}