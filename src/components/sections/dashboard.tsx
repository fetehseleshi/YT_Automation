"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { SectionHeader, StatCard, Pill, Progress } from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import {
  api,
  formatNumber,
  formatMoney,
  formatCompactMoney,
  relativeTime,
  colorFor,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUI } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Totals {
  totalChannels: number;
  totalVideos: number;
  totalVideosPublished: number;
  videosScheduled: number;
  draftVideos: number;
  monthlyRevenue: number;
  estimatedRPM: number;
  totalSubscribers: number;
  totalViews: number;
  watchTimeHours: number;
  monetizedChannels: number;
  tasksCompleted: number;
  pendingTasks: number;
  calendarEvents: number;
}
interface SeriesPoint {
  month: string;
  income?: number;
  expense?: number;
  profit?: number;
  views?: number;
  subs?: number;
}
interface ActivityItem {
  id: string;
  type: string;
  message: string;
  section: string;
  createdAt: string;
}
interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  category: string;
  progress: number;
  dueDate: string | null;
}
interface GoalItem {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  color: string;
}
interface ChannelBreakdownItem {
  name: string;
  color: string;
  subscribers: number;
  revenue: number;
  views: number;
}
interface TopVideo {
  id: string;
  title: string;
  views: number;
  revenue: number;
  ctr: number;
  channelName: string;
  channelColor: string;
}
interface DashboardData {
  totals: Totals;
  channelHealth: number;
  revenueSeries: { month: string; income: number; expense: number; profit: number }[];
  viewsSeries: { month: string; views: number }[];
  subscriberGrowth: { month: string; subs: number }[];
  recentActivity: ActivityItem[];
  upcomingTasks: TaskItem[];
  dailyGoals: GoalItem[];
  weeklyGoals: GoalItem[];
  channelBreakdown: ChannelBreakdownItem[];
  topVideos: TopVideo[];
  scheduledDates: string[];
}

// ─── Static config ────────────────────────────────────────────────────────────
const QUOTES = [
  "Consistency compounds. Ship one video today.",
  "The algorithm rewards momentum — keep moving.",
  "Your next breakthrough is one upload away.",
  "Done is better than perfect. Publish and learn.",
  "Small daily uploads build legendary channels.",
  "Focus on the viewer; the views will follow.",
  "Today's script is tomorrow's revenue.",
  "Build the system, then trust the system.",
];

const CHART_HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  teal: "#14b8a6",
  orange: "#f97316",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "rose",
  high: "amber",
  medium: "teal",
  low: "emerald",
};

const ACTIVITY_ICON: Record<string, { icon: string; color: string }> = {
  success: { icon: "check-circle", color: "emerald" },
  info: { icon: "info", color: "teal" },
  warning: { icon: "alert-triangle", color: "amber" },
  error: { icon: "alert-triangle", color: "rose" },
};

// ─── Section component ────────────────────────────────────────────────────────
export function DashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api<DashboardData>("/api/dashboard")
      .then((d) => {
        if (!alive) return;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        toast.error("Failed to load dashboard data");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      <GreetingHero monetizedChannels={data.totals.monetizedChannels} />
      <StatGrid totals={data.totals} />
      <ChartsRow
        revenueSeries={data.revenueSeries}
        subscriberGrowth={data.subscriberGrowth}
      />
      <HealthAndBreakdown
        channelHealth={data.channelHealth}
        channelBreakdown={data.channelBreakdown}
      />
      <ThreeColumnRow
        activity={data.recentActivity}
        tasks={data.upcomingTasks}
        dailyGoals={data.dailyGoals}
        weeklyGoals={data.weeklyGoals}
        tasksCompleted={data.totals.tasksCompleted}
        pendingTasks={data.totals.pendingTasks}
        calendarEvents={data.totals.calendarEvents}
      />
      <CalendarPreview scheduledDates={data.scheduledDates} />
      <TopVideos topVideos={data.topVideos} />
    </div>
  );
}

// ─── Greeting hero ────────────────────────────────────────────────────────────
function GreetingHero({ monetizedChannels }: { monetizedChannels: number }) {
  const { greeting, dateStr } = useMemo(() => {
    const h = new Date().getHours();
    const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const d = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return { greeting: g, dateStr: d };
  }, []);

  const quote = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return QUOTES[dayOfYear % QUOTES.length];
  }, []);

  const { setSection } = useUI();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="relative overflow-hidden border-border/60 p-6 sm:p-8 glass">
        {/* gradient blurs */}
        <div className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 size-40 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Pill color="emerald" icon="sparkles">
                Studio Overview
              </Pill>
              <span className="text-xs text-muted-foreground tabular-nums">{dateStr}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              {greeting},{" "}
              <span className="text-gradient">Creator</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground italic max-w-xl">
              &ldquo;{quote}&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                size="sm"
                className="gap-2 rounded-lg"
                onClick={() => setSection("ai")}
              >
                <Icon name="brain" className="size-4" />
                Open AI Assistant
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {monetizedChannels} monetized channels live
              </div>
            </div>
          </div>

          {/* mini sparkline decoration */}
          <div className="hidden lg:block w-64 h-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={generateMiniSpark()} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_HEX.emerald} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={CHART_HEX.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={CHART_HEX.emerald}
                  strokeWidth={2.5}
                  fill="url(#heroSpark)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function generateMiniSpark() {
  return Array.from({ length: 18 }, (_, i) => ({
    v: Math.round(40 + Math.sin(i / 2) * 18 + i * 1.6 + Math.random() * 6),
  }));
}

// ─── Stat grid ────────────────────────────────────────────────────────────────
function StatGrid({ totals }: { totals: Totals }) {
  const stats = [
    {
      label: "Total Channels",
      value: formatNumber(totals.totalChannels),
      icon: "youtube",
      color: "emerald",
      delta: 0,
      hint: `${totals.monetizedChannels} monetized`,
    },
    {
      label: "Total Videos",
      value: formatNumber(totals.totalVideos),
      icon: "film",
      color: "teal",
      delta: 12,
      hint: "all time",
    },
    {
      label: "Videos Published",
      value: formatNumber(totals.totalVideosPublished),
      icon: "check-circle",
      color: "emerald",
      delta: 9,
      hint: "live now",
    },
    {
      label: "Videos Scheduled",
      value: formatNumber(totals.videosScheduled),
      icon: "calendar-days",
      color: "amber",
      delta: 8,
      hint: "in pipeline",
    },
    {
      label: "Draft Videos",
      value: formatNumber(totals.draftVideos),
      icon: "file-text",
      color: "orange",
      delta: 4,
      hint: "in progress",
    },
    {
      label: "Monthly Revenue",
      value: formatCompactMoney(totals.monthlyRevenue),
      icon: "dollar",
      color: "emerald",
      delta: 18,
      hint: "this month",
    },
    {
      label: "Est. RPM",
      value: `$${totals.estimatedRPM.toFixed(2)}`,
      icon: "gauge",
      color: "orange",
      delta: 4,
      hint: "weighted avg",
    },
    {
      label: "Total Subscribers",
      value: formatNumber(totals.totalSubscribers),
      icon: "users",
      color: "rose",
      delta: 9,
      hint: "across channels",
    },
    {
      label: "Total Views",
      value: formatNumber(totals.totalViews),
      icon: "eye",
      color: "teal",
      delta: 15,
      hint: "all time",
    },
    {
      label: "Watch Time",
      value: `${formatNumber(totals.watchTimeHours)}h`,
      icon: "clock",
      color: "amber",
      delta: 11,
      hint: "lifetime",
    },
    {
      label: "Tasks Completed",
      value: formatNumber(totals.tasksCompleted),
      icon: "list-checks",
      color: "emerald",
      delta: 0,
      hint: `${totals.pendingTasks} pending`,
    },
    {
      label: "Pending Tasks",
      value: formatNumber(totals.pendingTasks),
      icon: "alert-triangle",
      color: "rose",
      delta: 0,
      hint: "needs action",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s, i) => (
        <StatCard
          key={s.label}
          label={s.label}
          value={s.value}
          icon={s.icon}
          color={s.color}
          delta={s.delta}
          hint={s.hint}
          delay={i * 0.03}
        />
      ))}
    </div>
  );
}

// ─── Charts row (revenue + subscriber growth) ────────────────────────────────
function ChartsRow({
  revenueSeries,
  subscriberGrowth,
}: {
  revenueSeries: { month: string; income: number; expense: number; profit: number }[];
  subscriberGrowth: { month: string; subs: number }[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        title="Revenue Overview"
        subtitle="Income vs expense · last 6 months"
        icon="wallet"
        delay={0.05}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="revIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_HEX.emerald} stopOpacity={0.55} />
                <stop offset="100%" stopColor={CHART_HEX.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_HEX.amber} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_HEX.amber} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_HEX.rose} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_HEX.rose} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactMoney(Number(v))} />
            <Tooltip content={<ChartTooltip formatter={(v) => formatMoney(Number(v))} />} />
            <Area type="monotone" dataKey="income" stroke={CHART_HEX.emerald} strokeWidth={2.5} fill="url(#revIncome)" name="Income" />
            <Area type="monotone" dataKey="profit" stroke={CHART_HEX.amber} strokeWidth={2} fill="url(#revProfit)" name="Profit" />
            <Area type="monotone" dataKey="expense" stroke={CHART_HEX.rose} strokeWidth={2} fill="url(#revExpense)" name="Expense" />
          </AreaChart>
        </ResponsiveContainer>
        <ChartLegend
          items={[
            { label: "Income", color: "emerald" },
            { label: "Profit", color: "amber" },
            { label: "Expense", color: "rose" },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Subscriber Growth"
        subtitle="Cumulative subscribers · last 6 months"
        icon="trending-up"
        delay={0.1}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={subscriberGrowth} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="subGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_HEX.teal} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART_HEX.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} />
            <Tooltip content={<ChartTooltip formatter={(v) => formatNumber(Number(v)) + " subs"} />} />
            <Area type="monotone" dataKey="subs" stroke={CHART_HEX.teal} strokeWidth={2.5} fill="url(#subGrowth)" name="Subscribers" />
          </AreaChart>
        </ResponsiveContainer>
        <ChartLegend items={[{ label: "Subscribers", color: "teal" }]} />
      </ChartCard>
    </div>
  );
}

// ─── Channel health + breakdown ───────────────────────────────────────────────
function HealthAndBreakdown({
  channelHealth,
  channelBreakdown,
}: {
  channelHealth: number;
  channelBreakdown: ChannelBreakdownItem[];
}) {
  const healthColor =
    channelHealth >= 85 ? "emerald" : channelHealth >= 70 ? "amber" : "rose";
  const healthHex = CHART_HEX[healthColor];
  const healthData = [
    { name: "Health", value: channelHealth },
    { name: "Remaining", value: 100 - channelHealth },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Health gauge */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="lg:col-span-1"
      >
        <Card className="relative overflow-hidden border-border/60 p-5 h-full glass">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="gauge" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Channel Health</p>
              <p className="text-xs text-muted-foreground">Average across all channels</p>
            </div>
          </div>
          <div className="relative h-[200px] grid place-items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  dataKey="value"
                  innerRadius={62}
                  outerRadius={88}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="none"
                >
                  <Cell fill={healthHex} />
                  <Cell fill="currentColor" fillOpacity={0.08} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <p className="text-4xl font-bold tabular-nums">{channelHealth}</p>
                <p className="text-xs text-muted-foreground mt-0.5">out of 100</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Pill color={healthColor} icon="activity">
              {channelHealth >= 85 ? "Excellent" : channelHealth >= 70 ? "Good" : "Needs attention"}
            </Pill>
          </div>
        </Card>
      </motion.div>

      {/* Channel breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        className="lg:col-span-2"
      >
        <Card className="relative overflow-hidden border-border/60 p-5 h-full glass">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
                <Icon name="bar-chart-3" className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Channel Breakdown</p>
                <p className="text-xs text-muted-foreground">Subscribers per channel</p>
              </div>
            </div>
            <Pill color="emerald">{channelBreakdown.length} channels</Pill>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelBreakdown} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(Number(v))} />
              <Tooltip content={<ChartTooltip formatter={(v) => formatNumber(Number(v)) + " subs"} />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
              <Bar dataKey="subscribers" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {channelBreakdown.map((c) => (
                  <Cell key={c.name} fill={CHART_HEX[c.color] ?? CHART_HEX.emerald} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
            {channelBreakdown.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2 rounded-full"
                  style={{ background: CHART_HEX[c.color] ?? CHART_HEX.emerald }}
                />
                <span className="text-muted-foreground">{c.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Three column row (activity / tasks / goals) ─────────────────────────────
function ThreeColumnRow({
  activity,
  tasks,
  dailyGoals,
  weeklyGoals,
  tasksCompleted,
  pendingTasks,
  calendarEvents,
}: {
  activity: ActivityItem[];
  tasks: TaskItem[];
  dailyGoals: GoalItem[];
  weeklyGoals: GoalItem[];
  tasksCompleted: number;
  pendingTasks: number;
  calendarEvents: number;
}) {
  const totalTasks = tasksCompleted + pendingTasks;
  const tasksPct = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Card className="border-border/60 p-5 h-full glass">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="activity" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Recent Activity</p>
              <p className="text-xs text-muted-foreground">Latest studio events</p>
            </div>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {activity.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent activity.</p>
            )}
            {activity.map((a) => {
              const cfg = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.info;
              const c = colorFor(cfg.color);
              return (
                <div key={a.id} className="flex items-start gap-3 group">
                  <div className="relative flex flex-col items-center pt-0.5">
                    <span className={cn("size-2.5 rounded-full ring-4", c.bg, c.ring)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      {relativeTime(a.createdAt)} · {a.section}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Calendar events (next 30 days) mini-card */}
          <div className="mt-3 rounded-lg border border-border/50 bg-accent/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-7 rounded-md bg-teal-500/10 grid place-items-center shrink-0">
                  <Icon name="calendar-days" className="size-3.5 text-teal-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">Calendar Events</p>
                  <p className="text-[11px] text-muted-foreground">next 30 days</p>
                </div>
              </div>
              <Pill color="teal" icon="clock">
                {calendarEvents} upcoming
              </Pill>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Upcoming tasks */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Card className="border-border/60 p-5 h-full glass">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="list-checks" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Upcoming Tasks</p>
              <p className="text-xs text-muted-foreground">Next on your plate</p>
            </div>
          </div>
          {/* Tasks: X completed / Y pending mini-progress */}
          <div className="mb-3 rounded-lg border border-border/50 bg-accent/30 p-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Tasks progress</span>
              <span className="tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{tasksCompleted}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">{pendingTasks}</span>
                <span className="text-muted-foreground"> pending</span>
              </span>
            </div>
            <Progress value={tasksPct} color={tasksPct >= 70 ? "emerald" : tasksPct >= 40 ? "amber" : "rose"} />
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">All caught up!</p>
            )}
            {tasks.map((t) => {
              const pColor = PRIORITY_COLOR[t.priority] ?? "emerald";
              const due = t.dueDate ? new Date(t.dueDate) : null;
              const overdue = due && due.getTime() < Date.now();
              return (
                <div key={t.id} className="rounded-lg border border-border/50 p-2.5 hover:bg-accent/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug line-clamp-2">{t.title}</p>
                    <Pill color={pColor}>{t.priority}</Pill>
                  </div>
                  <div className="flex items-center justify-between mt-2 mb-1.5">
                    <span className="text-xs text-muted-foreground">{t.category}</span>
                    {due && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs tabular-nums",
                          overdue ? "text-rose-500" : "text-muted-foreground"
                        )}
                      >
                        <Icon name="clock" className="size-3" />
                        {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  {t.progress > 0 && (
                    <div className="flex items-center gap-2">
                      <Progress value={t.progress} color={pColor} />
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{t.progress}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Daily / weekly goals */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Card className="border-border/60 p-5 h-full glass">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="target" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Goals & Habits</p>
              <p className="text-xs text-muted-foreground">Daily & weekly progress</p>
            </div>
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Daily Habits</p>
              <div className="space-y-2.5">
                {dailyGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground">No daily habits set.</p>
                )}
                {dailyGoals.map((g) => (
                  <GoalRow key={g.id} goal={g} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Weekly Goals</p>
              <div className="space-y-2.5">
                {weeklyGoals.length === 0 && (
                  <p className="text-xs text-muted-foreground">No weekly goals set.</p>
                )}
                {weeklyGoals.map((g) => (
                  <GoalRow key={g.id} goal={g} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

function GoalRow({ goal }: { goal: GoalItem }) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const c = colorFor(goal.color);
  const size = 42;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const done = pct >= 100;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke={CHART_HEX[goal.color] ?? CHART_HEX.emerald}
            strokeDasharray={circ}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {done ? (
            <Icon name="check" className="size-4" style={{ color: CHART_HEX[goal.color] }} />
          ) : (
            <span className="text-[10px] font-semibold tabular-nums">{pct}%</span>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{goal.title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          <span className={c.text}>{formatNumber(goal.current)}</span> / {formatNumber(goal.target)} {goal.unit}
        </p>
      </div>
    </div>
  );
}

// ─── Content calendar preview ────────────────────────────────────────────────
function CalendarPreview({ scheduledDates }: { scheduledDates: string[] }) {
  const { weeks, monthLabel, todayStr } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { weeks, monthLabel, todayStr };
  }, []);

  const dateSet = useMemo(() => new Set(scheduledDates), [scheduledDates]);

  const dayKey = (day: number) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const scheduledThisMonth = weeks
    .flat()
    .filter((d): d is number => d !== null)
    .filter((d) => dateSet.has(dayKey(d))).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="border-border/60 p-5 glass">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="calendar-days" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{monthLabel}</p>
              <p className="text-xs text-muted-foreground">{scheduledThisMonth} scheduled items</p>
            </div>
          </div>
          <Pill color="teal" icon="clock">
            This month
          </Pill>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekdayLabels.map((w, i) => (
            <div key={i} className="text-[11px] font-semibold text-muted-foreground py-1">
              {w}
            </div>
          ))}
          {weeks.flat().map((day, i) => {
            if (day === null) {
              return <div key={i} className="aspect-square" />;
            }
            const key = dayKey(day);
            const isToday = key === todayStr;
            const hasScheduled = dateSet.has(key);
            return (
              <div
                key={i}
                className={cn(
                  "relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors",
                  isToday
                    ? "bg-primary text-primary-foreground font-semibold"
                    : hasScheduled
                    ? "bg-accent/60 hover:bg-accent"
                    : "hover:bg-accent/40"
                )}
              >
                <span className="tabular-nums">{day}</span>
                {hasScheduled && (
                  <span
                    className={cn(
                      "absolute bottom-1 size-1.5 rounded-full",
                      isToday ? "bg-primary-foreground" : "bg-emerald-500"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Top performing videos ───────────────────────────────────────────────────
function TopVideos({ topVideos }: { topVideos: TopVideo[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="border-border/60 p-5 glass">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name="trophy" className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Top Performing Videos</p>
              <p className="text-xs text-muted-foreground">Best by views across all channels</p>
            </div>
          </div>
          <Pill color="amber" icon="star">
            Top {topVideos.length}
          </Pill>
        </div>

        {topVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No video performance data yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {topVideos.map((v, i) => {
              const c = colorFor(v.channelColor);
              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
                  className="lift"
                >
                  <div className="rounded-xl border border-border/60 p-3.5 h-full flex flex-col gap-2 bg-card/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("size-7 rounded-lg grid place-items-center text-xs font-bold shrink-0", c.soft)}>
                        {i + 1}
                      </div>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", c.soft)}>
                        {v.channelName}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">
                      {v.title}
                    </p>
                    <div className="mt-auto grid grid-cols-3 gap-1 pt-1">
                      <Metric label="Views" value={formatNumber(v.views)} icon="eye" color="teal" />
                      <Metric label="Rev" value={formatCompactMoney(v.revenue)} icon="dollar" color="emerald" />
                      <Metric label="CTR" value={`${v.ctr.toFixed(1)}%`} icon="trending-up" color="amber" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  const c = colorFor(color);
  return (
    <div className="text-center rounded-md bg-muted/40 py-1.5 px-1">
      <Icon name={icon} className={cn("size-3 mx-auto mb-0.5", c.text)} />
      <p className="text-xs font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  icon,
  children,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card className="relative overflow-hidden border-border/60 p-5 h-full glass">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Icon name={icon} className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
      {items.map((it) => {
        const c = colorFor(it.color);
        return (
          <div key={it.label} className="flex items-center gap-1.5 text-xs">
            <span className={cn("size-2 rounded-full", c.bg)} />
            <span className="text-muted-foreground">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string;
  formatter?: (v: number | string | undefined) => string;
}

function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 backdrop-blur-md px-3 py-2 shadow-lg">
      {label && <p className="text-xs font-semibold mb-1">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name ?? p.dataKey}:</span>
            <span className="font-semibold tabular-nums">{formatter ? formatter(p.value) : String(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* hero skeleton */}
      <div className="shimmer rounded-2xl h-40 border border-border/60 bg-card/40" />
      {/* stat grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="shimmer rounded-xl h-28 border border-border/60 bg-card/40" />
        ))}
      </div>
      {/* charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="shimmer rounded-2xl h-72 border border-border/60 bg-card/40" />
        <div className="shimmer rounded-2xl h-72 border border-border/60 bg-card/40" />
      </div>
      {/* health + breakdown skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shimmer rounded-2xl h-72 border border-border/60 bg-card/40" />
        <div className="shimmer rounded-2xl h-72 lg:col-span-2 border border-border/60 bg-card/40" />
      </div>
      {/* three column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer rounded-2xl h-80 border border-border/60 bg-card/40" />
        ))}
      </div>
      {/* calendar skeleton */}
      <div className="shimmer rounded-2xl h-64 border border-border/60 bg-card/40" />
      {/* top videos skeleton */}
      <div className="shimmer rounded-2xl h-48 border border-border/60 bg-card/40" />
    </div>
  );
}
