import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const ALLOWED_TYPES = ["income", "expense"];
const ALLOWED_CATEGORIES = [
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

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short" });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

/** GET /api/finance — all transactions + computed summary. */
export async function GET() {
  try {
    const transactions = await db.transaction.findMany({
      include: {
        channel: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeByCat = new Map<string, number>();
    const expenseByCat = new Map<string, number>();

    // Build last 6 months buckets (including current month).
    const now = new Date();
    const monthlyMap = new Map<
      string,
      { month: string; income: number; expense: number; profit: number }
    >();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(monthKey(d), {
        month: monthLabel(d),
        income: 0,
        expense: 0,
        profit: 0,
      });
    }

    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      const isIncome = t.type === "income";
      if (isIncome) {
        totalIncome += amt;
        incomeByCat.set(
          t.category,
          (incomeByCat.get(t.category) ?? 0) + amt,
        );
      } else {
        totalExpense += amt;
        expenseByCat.set(
          t.category,
          (expenseByCat.get(t.category) ?? 0) + amt,
        );
      }

      const d =
        t.date instanceof Date ? t.date : new Date(t.date as unknown as string);
      const m = monthlyMap.get(monthKey(d));
      if (m) {
        if (isIncome) m.income += amt;
        else m.expense += amt;
        m.profit = m.income - m.expense;
      }
    }

    const incomeByCategory = [...incomeByCat.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);
    const expenseByCategory = [...expenseByCat.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        ...t,
        date: t.date.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      summary: {
        totalIncome: round2(totalIncome),
        totalExpense: round2(totalExpense),
        profit: round2(totalIncome - totalExpense),
        incomeByCategory,
        expenseByCategory,
        monthly: [...monthlyMap.values()],
      },
    });
  } catch (e) {
    console.error("[finance] GET error", e);
    return NextResponse.json(
      { error: "Failed to load finance data" },
      { status: 500 },
    );
  }
}

/** POST /api/finance — create a transaction. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const type = ALLOWED_TYPES.includes(body.type as string)
      ? (body.type as string)
      : "income";
    const category = ALLOWED_CATEGORIES.includes(body.category as string)
      ? (body.category as string)
      : "general";

    const rawAmount =
      typeof body.amount === "number" ? body.amount : Number(body.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 },
      );
    }
    const amount = round2(rawAmount);

    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const date = toDate(body.date, new Date());

    let channelId: string | null = null;
    if (typeof body.channelId === "string" && body.channelId.trim()) {
      const ch = await db.channel.findUnique({
        where: { id: body.channelId },
      });
      if (!ch) {
        return NextResponse.json(
          { error: "Channel not found" },
          { status: 400 },
        );
      }
      channelId = body.channelId;
    }

    const tx = await db.transaction.create({
      data: { type, category, amount, description, date, channelId },
      include: {
        channel: { select: { id: true, name: true, color: true } },
      },
    });

    return NextResponse.json(
      {
        transaction: {
          ...tx,
          date: tx.date.toISOString(),
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("[finance] POST error", e);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}
