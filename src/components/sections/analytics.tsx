"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  SectionHeader,
  StatCard,
  Pill,
  Progress,
} from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import {
  api,
  formatNumber,
  formatMoney,
  formatCompactMoney,
  colorFor,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChannelLite {
  id: string;
  name: string;
  color: string;
}

interface KPIs {
  totalViews: number;
  totalSubscribers: number;
  avgCTR: number;
  avgRetention: number;
  avgRPM: number;
  totalRevenue: number;
  totalWatchTime: number;
  growthPct: number;
}

interface RevenueByChannel {
  name: string;
  color: string;
  revenue: number;
  subscribers: number;
}

interface TopVideo {
  id: string;
  title: string;
  channel: string;
  channelColor: string;
  views: number;
  ctr: number;
  retention: number;
  revenue: number;
}

interface WorstVideo {
  id: string;
  title: string;
  channel: string;
  channelColor: string;
  views: number;
  ctr: number;
  retention: number;
}

interface ScatterPoint {
  x: number;
  y: number;
  size: number;
  name: string;
  channel: string;
  color: string;
}

interface NicheBucket {
  niche: string;
  subs: number;
  revenue: number;
}

interface TrendPoint {
  month: string;
  views: number;
  revenue?: number;
}

interface AnalyticsResponse {
  kpis: KPIs;
  period?: string;
  viewsTrend: TrendPoint[];
  subscribersTrend: { month: string; subs: number }[];
  revenueByChannel: RevenueByChannel[];
  topVideos: TopVideo[];
  worstVideos: WorstVideo[];
  performanceScatter: ScatterPoint[];
  nicheBreakdown: NicheBucket[];
}

type Period = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Last 30 days",
  weekly: "Last 12 weeks",
  monthly: "Last 12 months",
  yearly: "Last 5 years",
};

// ─── Palette (strictly emerald/amber/rose/teal/orange — NO blue/indigo) ───────

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  teal: "#14b8a6",
  orange: "#f97316",
};

// Cycle through the palette for niche slices (when >5 niches, repeats).
const NICHE_HEX = ["#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#f97316"];

function hexFor(c: string): string {
  return COLOR_HEX[c] ?? "#10b981";
}

// ─── Glass chart tooltip ──────────────────────────────────────────────────────

interface TipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function GlassTooltip({
  active,
  payload,
  label,
  formatter,
  fallbackName,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  formatter?: (v: number | string | undefined) => string;
  fallbackName?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-xl border border-border/60 px-3 py-2 shadow-xl min-w-[140px]">
      {label !== undefined && label !== "" && (
        <p className="text-xs font-semibold text-foreground mb-1.5">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((e, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs tabular-nums"
          >
            {e.color && (
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: e.color }}
              />
            )}
            <span className="text-muted-foreground">
              {e.name ?? fallbackName}
            </span>
            <span className="font-semibold text-foreground ml-auto">
              {formatter ? formatter(e.value) : String(e.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scatter tooltip ──────────────────────────────────────────────────────────

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="glass-strong rounded-xl border border-border/60 px-3 py-2 shadow-xl max-w-[240px]">
      <p className="text-xs font-semibold text-foreground truncate">
        {p.name}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: hexFor(p.color) }}
        />
        <span className="text-muted-foreground truncate">{p.channel}</span>
      </div>
      <Separator className="my-1.5" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs tabular-nums">
        <span className="text-muted-foreground">CTR</span>
        <span className="font-semibold text-right">{p.x.toFixed(1)}%</span>
        <span className="text-muted-foreground">Retention</span>
        <span className="font-semibold text-right">{p.y.toFixed(1)}%</span>
        <span className="text-muted-foreground">Views</span>
        <span className="font-semibold text-right">
          {formatNumber(p.size)}
        </span>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="shimmer h-24 rounded-2xl border border-border/60"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shimmer h-[300px] rounded-2xl border border-border/60" />
        <div className="shimmer h-[300px] rounded-2xl border border-border/60 lg:col-span-2" />
      </div>
    </div>
  );
}

// ─── Empty state (no published videos / no data) ──────────────────────────────

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-[260px] grid place-items-center text-center">
      <div>
        <div className="size-10 rounded-xl bg-accent grid place-items-center mb-2 mx-auto">
          <Icon name="bar-chart-3" className="size-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground max-w-[220px]">{message}</p>
      </div>
    </div>
  );
}

// ─── Card header helper ───────────────────────────────────────────────────────

function ChartCardHeader({
  title,
  subtitle,
  pillColor,
  pillLabel,
  pillIcon,
  trailing,
}: {
  title: React.ReactNode;
  subtitle?: string;
  pillColor: string;
  pillLabel: string;
  pillIcon?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {trailing}
        <Pill color={pillColor} icon={pillIcon}>
          {pillLabel}
        </Pill>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsSection() {
  const [data, setData] = React.useState<AnalyticsResponse | null>(null);
  const [channels, setChannels] = React.useState<ChannelLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [channelFilter, setChannelFilter] = React.useState<string>("all");
  const [period, setPeriod] = React.useState<Period>("monthly");

  // Load channel list for the filter dropdown (non-fatal if it fails).
  React.useEffect(() => {
    api<{ channels: ChannelLite[] }>("/api/channels")
      .then((r) =>
        setChannels(
          r.channels.map((c) => ({ id: c.id, name: c.name, color: c.color })),
        ),
      )
      .catch(() => {
        /* non-fatal — filter stays as "all" */
      });
  }, []);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (channelFilter !== "all") params.set("channelId", channelFilter);
      params.set("period", period);
      const qs = params.toString();
      const path = `/api/analytics${qs ? `?${qs}` : ""}`;
      const res = await api<AnalyticsResponse>(path);
      setData(res);
    } catch (e) {
      toast.error("Failed to load analytics", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [channelFilter, period]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Group scatter points by channel (each becomes its own colored <Scatter>).
  const scatterGroups = React.useMemo(() => {
    const map = new Map<string, { channel: string; color: string; points: ScatterPoint[] }>();
    (data?.performanceScatter ?? []).forEach((p) => {
      const key = `${p.channel}__${p.color}`;
      if (!map.has(key)) {
        map.set(key, { channel: p.channel, color: p.color, points: [] });
      }
      map.get(key)!.points.push(p);
    });
    return Array.from(map.values());
  }, [data]);

  // MoM views delta (last vs prev month).
  const viewsDelta = React.useMemo(() => {
    if (!data || data.viewsTrend.length < 2) return 0;
    const last = data.viewsTrend[data.viewsTrend.length - 1].views;
    const prev = data.viewsTrend[data.viewsTrend.length - 2].views;
    if (prev <= 0) return 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [data]);

  const maxTopViews = data?.topVideos?.[0]?.views ?? 1;
  const hasTop = (data?.topVideos?.length ?? 0) > 0;
  const hasScatter = (data?.performanceScatter?.length ?? 0) > 0;
  const hasNiche = (data?.nicheBreakdown?.length ?? 0) > 0;
  const hasWorst = (data?.worstVideos?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Analytics"
        description="Deep performance insights across your channels"
        icon="bar-chart-3"
        actions={
          <>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          colorFor(c.color).dot,
                        )}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="h-9">
                <TabsTrigger value="daily" className="text-xs px-2.5">Daily</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-2.5">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-2.5">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs px-2.5">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />

      {loading && !data ? (
        <AnalyticsSkeleton />
      ) : !data ? (
        <AnalyticsSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn("space-y-5 relative transition-opacity", loading && "opacity-50 pointer-events-none")}
        >
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center">
              <div className="size-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          )}
          {/* ─── KPI grid ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard
              label="Total Views"
              value={formatNumber(data.kpis.totalViews)}
              icon="eye"
              color="emerald"
              delta={viewsDelta}
              hint="vs last month"
              delay={0}
            />
            <StatCard
              label="Subscribers"
              value={formatNumber(data.kpis.totalSubscribers)}
              icon="users"
              color="teal"
              delta={data.kpis.growthPct}
              hint="all channels"
              delay={0.04}
            />
            <StatCard
              label="Avg CTR"
              value={`${data.kpis.avgCTR.toFixed(1)}%`}
              icon="zap"
              color="amber"
              hint="across videos"
              delay={0.08}
            />
            <StatCard
              label="Avg Retention"
              value={`${data.kpis.avgRetention.toFixed(1)}%`}
              icon="timer"
              color="rose"
              hint="avg watch %"
              delay={0.12}
            />
            <StatCard
              label="Avg RPM"
              value={formatMoney(data.kpis.avgRPM)}
              icon="dollar"
              color="orange"
              hint="per 1K views"
              delay={0.16}
            />
            <StatCard
              label="Total Revenue"
              value={formatCompactMoney(data.kpis.totalRevenue)}
              icon="wallet"
              color="emerald"
              delta={viewsDelta}
              hint="all time"
              delay={0.2}
            />
            <StatCard
              label="Watch Time"
              value={`${formatNumber(data.kpis.totalWatchTime)}h`}
              icon="clock"
              color="teal"
              hint="hours"
              delay={0.24}
            />
            <StatCard
              label="Growth"
              value={`${data.kpis.growthPct}%`}
              icon="trending-up"
              color="amber"
              delta={data.kpis.growthPct}
              hint="subscribers MoM"
              delay={0.28}
            />
          </div>

          {/* ─── Main charts row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Views trend */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Views Trend"
                subtitle={PERIOD_LABELS[period]}
                pillColor="emerald"
                pillLabel="Views"
                pillIcon="trending-up"
              />
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data.viewsTrend}
                  margin={{ top: 10, right: 12, bottom: 0, left: -8 }}
                >
                  <defs>
                    <linearGradient id="g-views" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => formatNumber(Number(v))}
                  />
                  <RTooltip
                    content={
                      <GlassTooltip
                        formatter={(v) => formatNumber(Number(v))}
                        fallbackName="Views"
                      />
                    }
                    cursor={{
                      stroke: "#10b981",
                      strokeOpacity: 0.3,
                      strokeWidth: 1,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Views"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#g-views)"
                    dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "#10b981",
                      stroke: "#022c22",
                      strokeWidth: 2,
                    }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Revenue trend */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Revenue Trend"
                subtitle={PERIOD_LABELS[period]}
                pillColor="amber"
                pillLabel="Revenue"
                pillIcon="dollar"
              />
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data.viewsTrend}
                  margin={{ top: 10, right: 12, bottom: 0, left: -8 }}
                >
                  <defs>
                    <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => formatCompactMoney(Number(v))}
                  />
                  <RTooltip
                    content={
                      <GlassTooltip
                        formatter={(v) => formatMoney(Number(v))}
                        fallbackName="Revenue"
                      />
                    }
                    cursor={{
                      stroke: "#f59e0b",
                      strokeOpacity: 0.3,
                      strokeWidth: 1,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fill="url(#g-rev)"
                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "#f59e0b",
                      stroke: "#422006",
                      strokeWidth: 2,
                    }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Subscriber growth */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Subscriber Growth"
                subtitle={`Cumulative · ${PERIOD_LABELS[period].toLowerCase()}`}
                pillColor="teal"
                pillLabel="Subs"
                pillIcon="users"
              />
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data.subscribersTrend}
                  margin={{ top: 10, right: 12, bottom: 0, left: -8 }}
                >
                  <defs>
                    <linearGradient id="g-subs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => formatNumber(Number(v))}
                  />
                  <RTooltip
                    content={
                      <GlassTooltip
                        formatter={(v) => formatNumber(Number(v))}
                        fallbackName="Subscribers"
                      />
                    }
                    cursor={{
                      stroke: "#14b8a6",
                      strokeOpacity: 0.3,
                      strokeWidth: 1,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="subs"
                    name="Subscribers"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    fill="url(#g-subs)"
                    dot={{ r: 3, fill: "#14b8a6", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "#14b8a6",
                      stroke: "#042f2e",
                      strokeWidth: 2,
                    }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ─── Second charts row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue by channel (horizontal bars) */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Revenue by Channel"
                subtitle={`Total · ${formatCompactMoney(data.kpis.totalRevenue)}`}
                pillColor="amber"
                pillLabel="Revenue"
                pillIcon="dollar"
              />
              {data.revenueByChannel.length === 0 ? (
                <ChartEmpty message="No monetized channels in this view." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.revenueByChannel}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      strokeOpacity={0.08}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="currentColor"
                      strokeOpacity={0.4}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactMoney(Number(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="currentColor"
                      strokeOpacity={0.6}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={108}
                    />
                    <RTooltip
                      content={
                        <GlassTooltip
                          formatter={(v) => formatMoney(Number(v))}
                          fallbackName="Revenue"
                        />
                      }
                      cursor={{
                        fill: "currentColor",
                        fillOpacity: 0.05,
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      name="Revenue"
                      radius={[0, 6, 6, 0]}
                      isAnimationActive
                    >
                      {data.revenueByChannel.map((entry, i) => (
                        <Cell key={i} fill={hexFor(entry.color)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Performance scatter */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Performance Map"
                subtitle="CTR vs Retention · bubble size = views"
                pillColor="rose"
                pillLabel="Videos"
                pillIcon="zap"
              />
              {!hasScatter ? (
                <ChartEmpty message="No published videos with engagement data yet." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart
                    margin={{ top: 12, right: 16, bottom: 8, left: -8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      strokeOpacity={0.08}
                    />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="CTR"
                      unit="%"
                      domain={[0, "dataMax + 2"]}
                      stroke="currentColor"
                      strokeOpacity={0.4}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: "CTR",
                        position: "insideBottom",
                        offset: -4,
                        fontSize: 10,
                        fill: "currentColor",
                        opacity: 0.6,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Retention"
                      unit="%"
                      domain={[0, 100]}
                      stroke="currentColor"
                      strokeOpacity={0.4}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <ZAxis
                      type="number"
                      dataKey="size"
                      range={[60, 640]}
                      name="Views"
                    />
                    <RTooltip
                      content={<ScatterTooltip />}
                      cursor={{
                        strokeDasharray: "3 3",
                        stroke: "currentColor",
                        strokeOpacity: 0.2,
                      }}
                    />
                    {scatterGroups.map((g, i) => (
                      <Scatter
                        key={i}
                        name={g.channel}
                        data={g.points}
                        fill={hexFor(g.color)}
                        fillOpacity={0.72}
                        isAnimationActive
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconType="circle"
                      iconSize={8}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* ─── Niche breakdown + Top videos ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Niche breakdown donut */}
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title="Niche Breakdown"
                subtitle="Subscribers by niche"
                pillColor="teal"
                pillLabel="Niche"
                pillIcon="globe"
              />
              {!hasNiche ? (
                <ChartEmpty message="No niche data available." />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative size-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.nicheBreakdown}
                          dataKey="subs"
                          nameKey="niche"
                          innerRadius={56}
                          outerRadius={88}
                          paddingAngle={2}
                          stroke="none"
                          isAnimationActive
                        >
                          {data.nicheBreakdown.map((_, i) => (
                            <Cell
                              key={i}
                              fill={NICHE_HEX[i % NICHE_HEX.length]}
                            />
                          ))}
                        </Pie>
                        <RTooltip
                          content={
                            <GlassTooltip
                              formatter={(v) =>
                                `${formatNumber(Number(v))} subs`
                              }
                              fallbackName="Subscribers"
                            />
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Total
                      </span>
                      <span className="text-lg font-bold tabular-nums text-emerald-500">
                        {formatNumber(data.kpis.totalSubscribers)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full space-y-1.5">
                    {data.nicheBreakdown.map((n, i) => {
                      const pct =
                        data.kpis.totalSubscribers > 0
                          ? (n.subs / data.kpis.totalSubscribers) * 100
                          : 0;
                      return (
                        <div
                          key={n.niche}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                NICHE_HEX[i % NICHE_HEX.length],
                            }}
                          />
                          <span className="text-muted-foreground truncate">
                            {n.niche || "Other"}
                          </span>
                          <span className="ml-auto font-semibold tabular-nums">
                            {formatNumber(n.subs)}
                          </span>
                          <span className="text-muted-foreground tabular-nums w-10 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Top performing videos */}
            <Card className="glass p-5 border-border/60 lg:col-span-2 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title={
                  <>
                    <Icon
                      name="trophy"
                      className="size-4 text-amber-500"
                    />
                    Top Performing Videos
                  </>
                }
                subtitle="Ranked by views"
                pillColor="emerald"
                pillLabel="Top 8"
                pillIcon="trending-up"
                trailing={
                  <Badge
                    variant="outline"
                    className="text-muted-foreground"
                  >
                    {data.topVideos.length}
                  </Badge>
                }
              />
              {!hasTop ? (
                <ChartEmpty message="No published videos to rank yet." />
              ) : (
                <ScrollArea className="max-h-[420px] pr-3">
                  <div className="space-y-2">
                    {data.topVideos.map((v, i) => {
                      const pct =
                        maxTopViews > 0 ? (v.views / maxTopViews) * 100 : 0;
                      const isTop = i === 0;
                      return (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: Math.min(i * 0.04, 0.3),
                            duration: 0.3,
                          }}
                          className={cn(
                            "relative rounded-xl border p-3 transition-colors",
                            isTop
                              ? "border-amber-500/40 bg-amber-500/5"
                              : "border-border/50 hover:bg-muted/30",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "size-7 rounded-lg grid place-items-center shrink-0 text-xs font-bold tabular-nums",
                                isTop
                                  ? "bg-amber-500/15 text-amber-500"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {isTop ? (
                                <Icon
                                  name="trophy"
                                  className="size-4 text-amber-500"
                                />
                              ) : (
                                i + 1
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {v.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <Pill color={v.channelColor}>
                                  {v.channel}
                                </Pill>
                                <span className="tabular-nums">
                                  {formatNumber(v.views)} views
                                </span>
                                <span aria-hidden>·</span>
                                <span className="tabular-nums">
                                  {v.ctr.toFixed(1)}% CTR
                                </span>
                                <span aria-hidden>·</span>
                                <span className="tabular-nums">
                                  {v.retention.toFixed(1)}% ret
                                </span>
                                <span aria-hidden>·</span>
                                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {formatMoney(v.revenue)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <Progress
                                  value={pct}
                                  color={isTop ? "amber" : v.channelColor}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </Card>
          </div>

          {/* ─── Worst performing videos ───────────────────────────────────── */}
          {hasWorst && (
            <Card className="glass p-5 border-border/60 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 size-32 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
              <ChartCardHeader
                title={
                  <>
                    <Icon
                      name="trending-down"
                      className="size-4 text-rose-500"
                    />
                    Needs Attention
                  </>
                }
                subtitle={`Bottom ${data.worstVideos.length} published videos by views`}
                pillColor="rose"
                pillLabel="Underperforming"
                pillIcon="alert-triangle"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {data.worstVideos.map((v, i) => (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex flex-col"
                  >
                    <div className="mb-2">
                      <Pill color="rose" icon="alert-triangle">
                        Attention
                      </Pill>
                    </div>
                    <p className="text-sm font-medium line-clamp-2 mb-1.5 min-h-[2.5rem]">
                      {v.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          colorFor(v.channelColor).dot,
                        )}
                      />
                      <span className="truncate">{v.channel}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums text-rose-500">
                        {formatNumber(v.views)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        views
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-xs tabular-nums text-muted-foreground mt-auto">
                      <span>CTR {v.ctr.toFixed(1)}%</span>
                      <span>Ret {v.retention.toFixed(1)}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
