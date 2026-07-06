"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/icon";
import { cn, colorFor } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/** Animated page transition wrapper for sections. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
            <Icon name={icon} className="size-5 text-primary" />
          </div>
        )}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  delta?: number;
  hint?: string;
  delay?: number;
}

export function StatCard({ label, value, icon, color = "emerald", delta, hint, delay = 0 }: StatCardProps) {
  const c = colorFor(color);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className="lift"
    >
      <Card className="relative overflow-hidden p-4 sm:p-5 border-border/60">
        <div className={cn("absolute -top-8 -right-8 size-24 rounded-full blur-2xl opacity-20", c.bg)} />
        <div className="flex items-start justify-between gap-2 relative">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          </div>
          <div className={cn("size-9 rounded-lg grid place-items-center shrink-0", c.soft)}>
            <Icon name={icon} className="size-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 relative">
          {typeof delta === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              <Icon name={delta >= 0 ? "arrow-up-right" : "arrow-down-right"} className="size-3.5" />
              {Math.abs(delta)}%
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground truncate">{hint}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

export function EmptyState({
  icon = "sparkles",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="size-14 rounded-2xl bg-accent grid place-items-center mb-4">
        <Icon name={icon} className="size-7 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pill({
  children,
  color = "emerald",
  icon,
}: {
  children: React.ReactNode;
  color?: string;
  icon?: string;
}) {
  const c = colorFor(color);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", c.soft)}>
      {icon && <Icon name={icon} className="size-3" />}
      {children}
    </span>
  );
}

export function Progress({ value, color = "emerald" }: { value: number; color?: string }) {
  const c = colorFor(color);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", c.bg)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/** Re-export for convenience */
export { cn };
