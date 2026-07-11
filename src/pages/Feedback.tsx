import { AppShell } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { StatCard } from "../components/ui/StatCard";
import { EmptyState } from "../components/ui/EmptyState";
import { chartTooltip } from "../utils/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Star, MessageSquare } from "lucide-react";
import { useConvexQuery } from "../hooks/useConvexQuery";
import { isConvexConfigured } from "../lib/convex";
import { CONFIG } from "../constants/config";

const MOCK_DISTRIBUTION = [
  { rating: 1, count: 23, percentage: 8 },
  { rating: 2, count: 45, percentage: 15 },
  { rating: 3, count: 67, percentage: 22 },
  { rating: 4, count: 89, percentage: 30 },
  { rating: 5, count: 76, percentage: 25 },
];

const MOCK_FEEDBACK = [
  { _id: "fb1", traceId: "trace_mno_001", rating: 5, comment: "Perfectly understood what I needed!", createdAt: Date.now() - 3600000 },
  { _id: "fb2", traceId: "trace_mno_002", rating: 2, comment: "The answer was partially wrong, it missed key details about dosage.", createdAt: Date.now() - 7200000 },
  { _id: "fb3", traceId: "trace_mno_003", rating: 4, comment: "Good answer but could have been more concise.", createdAt: Date.now() - 14400000 },
  { _id: "fb4", traceId: "trace_mno_004", rating: 1, comment: "Completely incorrect information about drug interactions.", createdAt: Date.now() - 28800000 },
  { _id: "fb5", traceId: "trace_mno_005", rating: 3, comment: "Decent but didn't cite sources.", createdAt: Date.now() - 57600000 },
];

type FeedbackEntry = {
  _id: string;
  traceId: string;
  rating: number;
  comment?: string;
  createdAt: number;
};

export default function Feedback() {
  const configured = isConvexConfigured();

  const { data: realFeedback } = useConvexQuery<FeedbackEntry[]>(
    configured ? "feedback:list" : null,
    { projectId: CONFIG.projectId },
  );

  const { data: realStats } = useConvexQuery<{
    distribution: Array<{ rating: number; count: number; percentage: number }>;
    totalFeedback: number;
    avgRating: number;
    positivePct: number;
    negativePct: number;
  }>(configured ? "feedback:getStats" : null, { projectId: CONFIG.projectId });

  const feedback = realFeedback ?? MOCK_FEEDBACK;
  const distribution = realStats?.distribution ?? MOCK_DISTRIBUTION;
  const avgRating = realStats?.avgRating ?? 3.4;
  const totalFeedback = realStats?.totalFeedback ?? feedback.length;
  const positivePct = realStats?.positivePct ?? 55;
  const negativePct = realStats?.negativePct ?? 22;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">User Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregate ratings from thumbs up/down — track satisfaction trends
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Average Rating"
          value={avgRating.toFixed(1)}
          subValue="Out of 5.0"
          icon={<Star className="w-4 h-4" />}
        />
        <StatCard
          label="Total Feedback"
          value={totalFeedback}
          subValue="All time"
          icon={<MessageSquare className="w-4 h-4" />}
        />
        <StatCard
          label="Positive"
          value={`${positivePct}%`}
          subValue="Rating 4-5"
          trend={{ value: 5, positive: true }}
          icon={<Star className="w-4 h-4" />}
        />
        <StatCard
          label="Negative"
          value={`${negativePct}%`}
          subValue="Rating 1-2"
          trend={{ value: 3, positive: false }}
          icon={<Star className="w-4 h-4" />}
        />
      </div>

      {/* Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Rating Distribution" subtitle="1-5 star breakdown" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="rating" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                  <Tooltip contentStyle={chartTooltip()} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="space-y-3">
          {distribution.map((d) => (
            <Card key={d.rating}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {Array.from({ length: d.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-warning text-warning" />
                  ))}
                  {Array.from({ length: 5 - d.rating }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-muted" />
                  ))}
                </div>
                <Badge variant={d.rating >= 4 ? "success" : d.rating <= 2 ? "destructive" : "neutral"}>
                  {d.percentage}%
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Feedback List */}
      <Card>
        <CardHeader title="Recent Feedback" subtitle={`${feedback.length} entries`} />
        {feedback.length === 0 ? (
          <EmptyState
            icon={<Star className="w-12 h-12" />}
            title="No feedback yet"
            description="User feedback will appear here once traces are rated."
          />
        ) : (
          <div className="space-y-3">
            {feedback.map((fb) => (
              <div key={fb._id} className="flex items-start gap-3 p-4 bg-background/50 rounded-lg border border-border">
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < fb.rating ? "fill-warning text-warning" : "text-muted"}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{fb.comment || "No comment provided"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] text-primary">{fb.traceId.slice(0, 12)}...</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.floor((Date.now() - fb.createdAt) / 3600000)}h ago
                    </span>
                  </div>
                </div>
                <Badge variant={fb.rating >= 4 ? "success" : fb.rating <= 2 ? "destructive" : "neutral"}>
                  {fb.rating}/5
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}