import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000);

async function main() {
  console.log("🌱 Seeding auth + new tables...");

  // ─── Default user ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("studio123", 10);
  const user = await db.user.upsert({
    where: { email: "creator@studio.io" },
    update: {},
    create: {
      email: "creator@studio.io",
      name: "Creator",
      passwordHash,
      image: "",
    },
  });
  console.log(`   User: ${user.email} (password: studio123)`);

  // ─── Scripts ────────────────────────────────────────────────────────────
  await db.script.deleteMany();
  const channels = await db.channel.findMany({ take: 4 });
  const scripts = [
    {
      title: "5 Morning Habits That Changed My Life — Script",
      content:
        "HOOK: What if the first 10 minutes of your day decided whether you succeed?\n\nINTRO: I tried 5 morning habits for 90 days. Here's what actually happened.\n\nPOINT 1: Hydrate before caffeinate...\nPOINT 2: 2-minute sunlight walk...\nPOINT 3: Write tomorrow's top 3...\nPOINT 4: Move your body for 5 minutes...\nPOINT 5: No phone for the first hour...\n\nCTA: Subscribe for daily self-improvement videos that actually work.",
      hook: "What if the first 10 minutes of your day decided whether you succeed?",
      cta: "Subscribe for daily self-improvement videos that actually work.",
      tags: "morning routine, habits, productivity",
      folder: "Mindful Momentum",
      status: "final",
    },
    {
      title: "Passive Income Myths Debunked — Script",
      content:
        "HOOK: Everyone says passive income is easy. Everyone is lying.\n\nINTRO: Let's break down the 4 biggest myths.\n\nMYTH 1: 'Set it and forget it'...\nMYTH 2: 'You need no skills'...\nMYTH 3: 'It's fast'...\nMYTH 4: 'Anyone can do it'...\n\nCTA: Subscribe for real money talk, no fluff.",
      hook: "Everyone says passive income is easy. Everyone is lying.",
      cta: "Subscribe for real money talk, no fluff.",
      tags: "passive income, finance, money",
      folder: "Wealth Wire",
      status: "review",
    },
    {
      title: "Best AI Tools for Productivity 2025 — Script",
      content: "HOOK: These 7 AI tools saved me 20 hours a week...\n\n[Full script body]",
      hook: "These 7 AI tools saved me 20 hours a week.",
      cta: "Hit subscribe for weekly tech tips.",
      tags: "ai, productivity, tools",
      folder: "Tech Tidbits",
      status: "draft",
    },
  ];
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    await db.script.create({
      data: {
        ...s,
        channelId: channels[i % channels.length]?.id ?? null,
        wordCount: s.content.split(/\s+/).length,
      },
    });
  }

  // ─── Calendar Events ────────────────────────────────────────────────────
  await db.calendarEvent.deleteMany();
  const events: any[] = [];
  // Upcoming publishes
  for (let i = 0; i < 6; i++) {
    events.push({
      title: `Publish: ${["Morning Habits", "Passive Income Myths", "AI Tools Review", "Discipline Video", "Budget Tips", "Minimalist Desk"][i]}`,
      description: "Scheduled video publish.",
      date: daysAhead(i + 1),
      type: "publish",
      channelId: channels[i % channels.length]?.id ?? null,
      color: ["emerald", "amber", "rose", "teal", "orange", "emerald"][i],
      reminder: daysAhead(i + 1),
    });
  }
  // Meetings
  events.push({
    title: "Weekly team sync",
    description: "Review pipeline + assign tasks.",
    date: daysAhead(2),
    type: "meeting",
    color: "teal",
  });
  events.push({
    title: "Thumbnail review with Priya",
    description: "Go over 3 thumbnail concepts.",
    date: daysAhead(4),
    type: "meeting",
    color: "amber",
  });
  // Deadlines
  events.push({
    title: "Q1 taxes due",
    description: "File estimated quarterly taxes.",
    date: daysAhead(7),
    type: "deadline",
    color: "rose",
  });
  // Past events (done)
  for (let i = 0; i < 3; i++) {
    events.push({
      title: `Published: Video ${i + 1}`,
      date: daysAgo(i * 3 + 2),
      type: "publish",
      color: "emerald",
      done: true,
    });
  }
  await db.calendarEvent.createMany({ data: events });

  // ─── Notifications ───────────────────────────────────────────────────────
  await db.notification.deleteMany();
  const notifs: any[] = [
    { title: "Video published", message: '"5 Morning Habits" is now live on Mindful Momentum.', type: "success", section: "videos", read: false },
    { title: "Milestone reached", message: "Mindful Momentum passed 248K subscribers!", type: "success", section: "channels", read: false },
    { title: "Task due soon", message: '"Write script for Discipline video" is due tomorrow.', type: "warning", section: "tasks", read: false },
    { title: "New AI history", message: "Generated 8 video ideas — saved to AI History.", type: "info", section: "ai", read: false },
    { title: "Calm Crafts needs attention", message: "Still below monetization threshold (2,400 / 3,000 hours).", type: "warning", section: "channels", read: true },
    { title: "AdSense payment", message: "Received $3,240 from AdSense.", type: "success", section: "finance", read: true },
    { title: "Weekly report ready", message: "Your weekly performance summary is available in Analytics.", type: "info", section: "analytics", read: true },
  ];
  await db.notification.createMany({ data: notifs });

  // ─── Settings (defaults) ────────────────────────────────────────────────
  await db.setting.deleteMany();
  const settings = [
    { key: "theme", value: "dark" },
    { key: "language", value: "English" },
    { key: "accentColor", value: "emerald" },
    { key: "density", value: "comfortable" },
    { key: "notifications.email", value: "true" },
    { key: "notifications.taskReminders", value: "true" },
    { key: "notifications.publishReminders", value: "true" },
    { key: "notifications.weeklyReports", value: "true" },
    { key: "notifications.trendAlerts", value: "false" },
    { key: "security.twoFactor", value: "false" },
    { key: "ai.model", value: "zai" },
    { key: "ai.voice", value: "default" },
  ];
  for (const s of settings) {
    await db.setting.create({ data: { ...s, userId: "local" } });
  }

  // ─── AI History (sample entries) ────────────────────────────────────────
  await db.aIHistory.deleteMany();
  const aiEntries: any[] = [
    {
      tool: "ideas",
      category: "text",
      prompt: "Video ideas about productivity for beginners",
      response: "1. The 2-Minute Rule That Beats Procrastination\n2. Why Your To-Do List Is Failing You\n3. The 80/20 Rule for Daily Output...",
      model: "zai",
      favorite: true,
    },
    {
      tool: "titles",
      category: "text",
      prompt: "Title for a video about morning routines",
      response: "1. I Tried 5 Morning Habits For 90 Days (Here's What Changed)\n2. The 10-Minute Morning Routine That Actually Works...",
      model: "zai",
      favorite: false,
    },
    {
      tool: "scripts",
      category: "text",
      prompt: "Script about building discipline in 30 days",
      response: "HOOK: Discipline isn't motivation. It's a system.\n\nINTRO: Here's how to build it in 30 days...\n\n[Full script]",
      model: "zai",
      favorite: true,
    },
    {
      tool: "thumbnails",
      category: "image",
      prompt: "Thumbnail concept: morning routine video",
      response: "Concept 1: Split-screen showing chaotic morning vs calm morning...",
      model: "zai-image",
      favorite: false,
      meta: "{}",
    },
  ];
  await db.aIHistory.createMany({ data: aiEntries });

  console.log("✅ Auth + new tables seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
