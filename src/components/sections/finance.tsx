"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  SectionHeader,
  StatCard,
  EmptyState,
  Pill,
} from "@/components/shared/ui";
import { Icon } from "@/components/icon";
import {
  api,
  formatMoney,
  formatCompactMoney,
  formatDate,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxType = "income" | "expense";
type CategoryKey =
  | "adsense"
  | "sponsorship"
  | "merch"
  | "software"
  | "freelancer"
  | "equipment"
  | "tax"
  | "other"
  | "general";

interface ChannelLite {
  id: string;
  name: string;
  color: string;
}

interface Transaction {
  id: string;
  channelId: string | null;
  channel: ChannelLite | null;
  type: TxType;
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

interface CategoryBucket {
  category: string;
  amount: number;
}

interface MonthlyBucket {
  month: string;
  income: number;
  expense: number;
  profit: number;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  incomeByCategory: CategoryBucket[];
  expenseByCategory: CategoryBucket[];
  monthly: MonthlyBucket[];
}

interface FinanceResponse {
  transactions: Transaction[];
  summary: Summary;
}

// ─── Category palette ─────────────────────────────────────────────────────────
// Hex values for recharts fills.
const CATEGORY_HEX: Record<string, string> = {
  adsense: "#10b981", // emerald-500
  sponsorship: "#f59e0b", // amber-500
  merch: "#14b8a6", // teal-500
  software: "#f43f5e", // rose-500
  freelancer: "#f97316", // orange-500
  equipment: "#14b8a6", // teal-500
  tax: "#f43f5e", // rose-500
  other: "#71717a", // zinc-500 (muted)
  general: "#71717a", // zinc-500 (muted)
};

const CATEGORY_COLOR_NAME: Record<string, string> = {
  adsense: "emerald",
  sponsorship: "amber",
  merch: "teal",
  software: "rose",
  freelancer: "orange",
  equipment: "teal",
  tax: "rose",
  other: "muted",
  general: "muted",
};

const CATEGORY_LABEL: Record<string, string> = {
  adsense: "AdSense",
  sponsorship: "Sponsorship",
  merch: "Merch",
  software: "Software",
  freelancer: "Freelancer",
  equipment: "Equipment",
  tax: "Tax",
  other: "Other",
  general: "General",
};

const CATEGORY_OPTIONS: CategoryKey[] = [
  "adsense",
  "sponsorship",
  "merch",
  "software",
  "freelancer",
  "equipment",
  "tax",
  "other",
  "general",
];

const EMERALD_HEX = "#10b981";
const AMBER_HEX = "#f59e0b";
const ROSE_HEX = "#f43f5e";
const TEAL_HEX = "#14b8a6";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

function categoryHex(c: string): string {
  return CATEGORY_HEX[c] ?? "#71717a";
}

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoDateOnly(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return todayISODate();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface EmptyForm {
  type: TxType;
  category: CategoryKey;
  amount: string;
  description: string;
  date: string;
  channelId: string;
}

function freshForm(): EmptyForm {
  return {
    type: "income",
    category: "adsense",
    amount: "",
    description: "",
    date: todayISODate(),
    channelId: "",
  };
}

// ─── Category pill (handles muted gracefully) ────────────────────────────────

function CategoryPill({ category }: { category: string }) {
  const colorName = CATEGORY_COLOR_NAME[category] ?? "muted";
  if (colorName === "muted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        {categoryLabel(category)}
      </span>
    );
  }
  return (
    <Pill color={colorName}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: categoryHex(category) }}
      />
      {categoryLabel(category)}
    </Pill>
  );
}

function TypePill({ type }: { type: TxType }) {
  if (type === "income") {
    return (
      <Pill color="emerald" icon="arrow-up-right">
        Income
      </Pill>
    );
  }
  return (
    <Pill color="rose" icon="arrow-down-right">
      Expense
    </Pill>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  money = true,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="glass-strong rounded-xl border border-border/60 px-3 py-2 shadow-xl">
      {label && (
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs tabular-nums"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-semibold text-foreground ml-auto">
              {money ? formatMoney(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Donut chart with legend ─────────────────────────────────────────────────

function CategoryDonut({
  data,
  total,
  tone,
  emptyLabel,
}: {
  data: CategoryBucket[];
  total: number;
  tone: "income" | "expense";
  emptyLabel: string;
}) {
  const accentHex = tone === "income" ? EMERALD_HEX : ROSE_HEX;
  const hasData = data.length > 0 && total > 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data : [{ category: "—", amount: 1 }]}
              dataKey="amount"
              nameKey="category"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={hasData ? 2 : 0}
              stroke="none"
            >
              {(hasData ? data : [{ category: "—", amount: 1 }]).map(
                (entry, i) => (
                  <Cell
                    key={i}
                    fill={hasData ? categoryHex(entry.category) : "#27272a"}
                  />
                ),
              )}
            </Pie>
            <RTooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {tone === "income" ? "Income" : "Expense"}
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: accentHex }}
          >
            {formatCompactMoney(total)}
          </span>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {hasData ? (
          data.slice(0, 5).map((b) => {
            const pct = total > 0 ? (b.amount / total) * 100 : 0;
            return (
              <div
                key={b.category}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: categoryHex(b.category) }}
                />
                <span className="text-muted-foreground truncate">
                  {categoryLabel(b.category)}
                </span>
                <span className="ml-auto font-semibold tabular-nums">
                  {formatMoney(b.amount)}
                </span>
                <span className="text-muted-foreground tabular-nums w-10 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
}: {
  data: { month: string; value: number }[];
  color: string;
}) {
  const id = React.useId();
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FinanceSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="shimmer h-28 rounded-2xl border border-border/60"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shimmer h-72 rounded-2xl border border-border/60 lg:col-span-1" />
        <div className="shimmer h-72 rounded-2xl border border-border/60 lg:col-span-1" />
        <div className="shimmer h-72 rounded-2xl border border-border/60 lg:col-span-1" />
      </div>
      <div className="shimmer h-12 rounded-xl border border-border/60" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shimmer h-96 rounded-2xl border border-border/60 lg:col-span-2" />
        <div className="shimmer h-96 rounded-2xl border border-border/60" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FinanceSection() {
  const [data, setData] = React.useState<FinanceResponse | null>(null);
  const [channels, setChannels] = React.useState<ChannelLite[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [filters, setFilters] = React.useState<{
    type: "all" | TxType;
    category: "all" | string;
    q: string;
  }>({ type: "all", category: "all", q: "" });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Transaction | null>(null);
  const [form, setForm] = React.useState<EmptyForm>(freshForm());
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Transaction | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<FinanceResponse>("/api/finance");
      setData(res);
    } catch (e) {
      toast.error("Failed to load finance data", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChannels = React.useCallback(async () => {
    try {
      const res = await api<{ channels: ChannelLite[] }>("/api/channels");
      setChannels(res.channels ?? []);
    } catch {
      // Non-fatal — channel select just won't show options.
      setChannels([]);
    }
  }, []);

  React.useEffect(() => {
    load();
    loadChannels();
  }, [load, loadChannels]);

  // ─── Filtered transactions for table ──────────────────────────────────────
  const filtered = React.useMemo(() => {
    if (!data) return [];
    const q = filters.q.trim().toLowerCase();
    return data.transactions.filter((t) => {
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.category !== "all" && t.category !== filters.category)
        return false;
      if (
        q &&
        !t.description.toLowerCase().includes(q) &&
        !categoryLabel(t.category).toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [data, filters]);

  const summary = data?.summary;

  // ─── Stat cards computed hints ────────────────────────────────────────────
  const monthly = summary?.monthly ?? [];
  const lastMonth = monthly[monthly.length - 1];
  const prevMonth = monthly[monthly.length - 2];
  const incomeDelta =
    lastMonth && prevMonth && prevMonth.income > 0
      ? ((lastMonth.income - prevMonth.income) / prevMonth.income) * 100
      : undefined;
  const expenseDelta =
    lastMonth && prevMonth && prevMonth.expense > 0
      ? ((lastMonth.expense - prevMonth.expense) / prevMonth.expense) * 100
      : undefined;
  const profitDelta =
    lastMonth && prevMonth && prevMonth.profit !== 0
      ? ((lastMonth.profit - prevMonth.profit) / Math.abs(prevMonth.profit)) *
        100
      : undefined;
  const margin = summary && summary.totalIncome > 0
    ? (summary.profit / summary.totalIncome) * 100
    : 0;
  const prevMargin =
    prevMonth && prevMonth.income > 0
      ? (prevMonth.profit / prevMonth.income) * 100
      : undefined;
  const marginDelta =
    prevMargin !== undefined ? margin - prevMargin : undefined;

  // ─── Current month sparkline data ─────────────────────────────────────────
  const currentMonth = monthly[monthly.length - 1];
  const monthlySpark = monthly.map((m) => ({
    month: m.month,
    value: m.income,
  }));

  // ─── Dialog helpers ───────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(freshForm());
    setDialogOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      type: t.type,
      category: (t.category as CategoryKey) ?? "general",
      amount: String(t.amount),
      description: t.description,
      date: isoDateOnly(t.date),
      channelId: t.channelId ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        type: form.type,
        category: form.category,
        amount: amt,
        description: form.description.trim(),
        date: form.date,
        channelId: form.channelId || null,
      };
      if (editing) {
        await api(`/api/finance/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Transaction updated", {
          description: `${categoryLabel(form.category)} • ${formatMoney(amt)}`,
        });
      } else {
        await api("/api/finance", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Transaction added", {
          description: `${categoryLabel(form.category)} • ${formatMoney(amt)}`,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(freshForm());
      await load();
    } catch (e) {
      toast.error("Failed to save transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api(`/api/finance/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Transaction deleted", {
        description: deleteTarget.description || categoryLabel(deleteTarget.category),
      });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Failed to delete transaction", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters =
    filters.type !== "all" ||
    filters.category !== "all" ||
    filters.q.trim() !== "";

  const clearFilters = () =>
    setFilters({ type: "all", category: "all", q: "" });

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div>
        <SectionHeader
          title="Finance"
          description="Track income, expenses, and profit across your studio"
          icon="wallet"
        />
        <FinanceSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Finance"
        description="Track income, expenses, and profit across your studio"
        icon="wallet"
        actions={
          <Button onClick={openAdd} className="gap-1.5">
            <Icon name="plus" className="size-4" />
            Add Transaction
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Income"
          value={formatMoney(summary?.totalIncome ?? 0)}
          icon="arrow-up-right"
          color="emerald"
          delta={incomeDelta}
          hint={lastMonth ? `${lastMonth.month} ${formatCompactMoney(lastMonth.income)}` : undefined}
          delay={0}
        />
        <StatCard
          label="Total Expense"
          value={formatMoney(summary?.totalExpense ?? 0)}
          icon="arrow-down-right"
          color="rose"
          delta={expenseDelta}
          hint={lastMonth ? `${lastMonth.month} ${formatCompactMoney(lastMonth.expense)}` : undefined}
          delay={0.05}
        />
        <StatCard
          label="Net Profit"
          value={formatMoney(summary?.profit ?? 0)}
          icon="dollar"
          color="amber"
          delta={profitDelta}
          hint={lastMonth ? `${lastMonth.month} ${formatCompactMoney(lastMonth.profit)}` : undefined}
          delay={0.1}
        />
        <StatCard
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          icon="gauge"
          color="teal"
          delta={marginDelta}
          hint={prevMargin !== undefined ? `Prev ${prevMargin.toFixed(1)}%` : undefined}
          delay={0.15}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly P&L area chart */}
        <Card className="glass border-border/60 p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Monthly P&amp;L</h3>
              <p className="text-xs text-muted-foreground">
                Income vs expense vs profit — last 6 months
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: EMERALD_HEX }}
                />
                Income
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: ROSE_HEX }}
                />
                Expense
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: AMBER_HEX }}
                />
                Profit
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthly}
                margin={{ top: 6, right: 6, bottom: 0, left: -12 }}
              >
                <defs>
                  <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EMERALD_HEX} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={EMERALD_HEX} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROSE_HEX} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={ROSE_HEX} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AMBER_HEX} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={AMBER_HEX} stopOpacity={0} />
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
                  width={56}
                  tickFormatter={(v) => formatCompactMoney(Number(v))}
                />
                <RTooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke={EMERALD_HEX}
                  strokeWidth={2}
                  fill="url(#grad-income)"
                  isAnimationActive
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expense"
                  stroke={ROSE_HEX}
                  strokeWidth={2}
                  fill="url(#grad-expense)"
                  isAnimationActive
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke={AMBER_HEX}
                  strokeWidth={2}
                  fill="url(#grad-profit)"
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Income donut */}
        <Card className="glass border-border/60 p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Income by Category</h3>
            <p className="text-xs text-muted-foreground">Where the money comes from</p>
          </div>
          <CategoryDonut
            data={summary?.incomeByCategory ?? []}
            total={summary?.totalIncome ?? 0}
            tone="income"
            emptyLabel="No income recorded yet"
          />
        </Card>
      </div>

      {/* Second row: Expense donut + filter + table + monthly report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expense donut */}
        <Card className="glass border-border/60 p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Expense by Category</h3>
            <p className="text-xs text-muted-foreground">Where the money goes</p>
          </div>
          <CategoryDonut
            data={summary?.expenseByCategory ?? []}
            total={summary?.totalExpense ?? 0}
            tone="expense"
            emptyLabel="No expenses recorded yet"
          />
        </Card>

        {/* Monthly report card */}
        <Card className="glass border-border/60 p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 size-24 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold">This Month</h3>
                <p className="text-xs text-muted-foreground">
                  {currentMonth ? currentMonth.month : "—"} summary
                </p>
              </div>
              <div className="size-8 rounded-lg bg-amber-500/10 grid place-items-center">
                <Icon name="bar-chart-3" className="size-4 text-amber-500" />
              </div>
            </div>
            {currentMonth ? (
              <>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: EMERALD_HEX }}
                      />
                      Income
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(currentMonth.income)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: ROSE_HEX }}
                      />
                      Expense
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {formatMoney(currentMonth.expense)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: AMBER_HEX }}
                      />
                      Profit
                    </span>
                    <span className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatMoney(currentMonth.profit)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 -mx-1">
                  <Sparkline data={monthlySpark} color={TEAL_HEX} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground text-center">
                  Income trend · 6 months
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">
                No data for current month yet.
              </p>
            )}
          </div>
        </Card>

        {/* Top-tx mini bar — small accent card (kept brief, hidden on mobile) */}
        <Card className="glass border-border/60 p-4 sm:p-5 relative overflow-hidden hidden lg:block">
          <div className="absolute -top-8 -right-8 size-24 rounded-full bg-teal-500/15 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold">6-Month Trend</h3>
                <p className="text-xs text-muted-foreground">Profit per month</p>
              </div>
              <div className="size-8 rounded-lg bg-teal-500/10 grid place-items-center">
                <Icon name="trending-up" className="size-4 text-teal-500" />
              </div>
            </div>
            <div className="h-44 mt-2 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthly}
                  margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                >
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
                  <RTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="profit" name="Profit" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {monthly.map((m, i) => (
                      <Cell
                        key={i}
                        fill={m.profit >= 0 ? TEAL_HEX : ROSE_HEX}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="glass border-border/60 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="filter" className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              Filter
            </span>
          </div>
          <Tabs
            value={filters.type}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, type: v as "all" | TxType }))
            }
            className="shrink-0"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={filters.category}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, category: v }))
            }
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Icon
              name="search"
              className="size-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <Input
              value={filters.q}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              placeholder="Search description or category…"
              className="pl-8"
            />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="shrink-0 gap-1.5"
            >
              <Icon name="x" className="size-3.5" />
              Clear
            </Button>
          )}
          <div className="text-xs text-muted-foreground tabular-nums shrink-0 hidden md:block">
            {filtered.length} of {data?.transactions.length ?? 0}
          </div>
        </div>
      </Card>

      {/* Transactions table */}
      <Card className="glass border-border/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/60">
          <div>
            <h3 className="text-sm font-semibold">Transactions</h3>
            <p className="text-xs text-muted-foreground">
              Click a row to edit · use the menu to delete
            </p>
          </div>
          <BadgeCount count={filtered.length} />
        </div>
        <ScrollArea className="max-h-[28rem]">
          {filtered.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={
                data && data.transactions.length > 0
                  ? "No transactions match your filters"
                  : "No transactions yet"
              }
              description={
                data && data.transactions.length > 0
                  ? "Try adjusting the filters or clearing them."
                  : "Add your first income or expense to start tracking."
              }
              action={
                <Button onClick={openAdd} className="gap-1.5">
                  <Icon name="plus" className="size-4" />
                  Add Transaction
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 sm:pl-5 text-xs uppercase tracking-wide text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">
                    Channel
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-muted-foreground text-right">
                    Amount
                  </TableHead>
                  <TableHead className="pr-4 sm:pr-5 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filtered.map((t, i) => (
                    <motion.tr
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, delay: Math.min(i * 0.01, 0.1) }}
                      className="group cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/40"
                      onClick={() => openEdit(t)}
                    >
                      <TableCell className="pl-4 sm:pl-5 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(t.date)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-sm font-medium truncate block max-w-[14rem] sm:max-w-[20rem]">
                          {t.description || (
                            <span className="text-muted-foreground italic">
                              {categoryLabel(t.category)}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <CategoryPill category={t.category} />
                      </TableCell>
                      <TableCell className="py-2.5 hidden md:table-cell">
                        {t.channel ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      CATEGORY_HEX[t.channel.color] ??
                                      "#10b981",
                                  }}
                                />
                                <span className="truncate max-w-[8rem]">
                                  {t.channel.name}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Linked to {t.channel.name}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <TypePill type={t.type} />
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-5 py-2.5 text-right">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            t.type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {t.type === "income" ? "+" : "−"}
                          {formatMoney(t.amount)}
                        </span>
                      </TableCell>
                      <TableCell
                        className="pr-4 sm:pr-5 py-2.5 w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
                              aria-label="Transaction actions"
                            >
                              <Icon name="more-horizontal" className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(t)}>
                              <Icon name="edit" className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(t)}
                              className="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300"
                            >
                              <Icon name="trash" className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setForm(freshForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Transaction" : "Add Transaction"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this transaction."
                : "Record a new income or expense entry."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Type selector — pill-style */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: "income" }))}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  form.type === "income"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border/60 bg-transparent text-muted-foreground hover:bg-muted/40",
                )}
              >
                <Icon name="arrow-up-right" className="size-4" />
                Income
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                  form.type === "expense"
                    ? "border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "border-border/60 bg-transparent text-muted-foreground hover:bg-muted/40",
                )}
              >
                <Icon name="arrow-down-right" className="size-4" />
                Expense
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tx-amount">
                  Amount <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="tx-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="pl-7 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tx-date">Date</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tx-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as CategoryKey }))
                }
              >
                <SelectTrigger id="tx-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: categoryHex(c) }}
                        />
                        {categoryLabel(c)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tx-desc">Description</Label>
              <Textarea
                id="tx-desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="e.g. AdSense payout for June, Adobe Creative Cloud subscription…"
                className="resize-none"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tx-channel">Channel (optional)</Label>
              <Select
                value={form.channelId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    channelId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger id="tx-channel">
                  <SelectValue placeholder="No channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No channel</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_HEX[c.color] ?? "#10b981",
                          }}
                        />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {editing && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (editing) setDeleteTarget(editing);
                }}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 mr-auto"
              >
                <Icon name="trash" className="size-4" />
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
                setForm(freshForm());
              }}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-1.5">
              {saving && (
                <Icon name="refresh" className="size-4 animate-spin" />
              )}
              {editing ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This will permanently delete{" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.description || categoryLabel(deleteTarget.category)}
                  </span>{" "}
                  ({deleteTarget.type === "income" ? "+" : "−"}
                  {formatMoney(deleteTarget.amount)}). This action cannot be
                  undone.
                </>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 gap-1.5"
            >
              {deleting && (
                <Icon name="refresh" className="size-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Small badge for count ────────────────────────────────────────────────────

function BadgeCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums">
      <Icon name="list-checks" className="size-3" />
      {count} {count === 1 ? "transaction" : "transactions"}
    </span>
  );
}
