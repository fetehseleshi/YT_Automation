# Task 10-a — Analytics Section Builder

## Task
Build the ANALYTICS section (`AnalyticsSection` → `src/components/sections/analytics.tsx`, overwrite stub) + REST API at `/api/analytics` (GET, aggregates Channel + Video into a single analytics payload).

## Files Created (only these 2 — no shared files edited)
- `src/app/api/analytics/route.ts` — GET aggregator with optional `?channelId=` filter
- `src/components/sections/analytics.tsx` — `AnalyticsSection` named export, `"use client"`

## Key Implementation Details

### API (`/api/analytics`)
- Reads `?channelId=` from `req.nextUrl.searchParams`. When present, scopes both the `Channel.findMany({ where: { id } })` and `Video.findMany({ where: { channelId } })` queries (single channel filter); otherwise fetches everything.
- Parallel `Promise.all([channels, videos])` — single round-trip, no N+1.
- Selects only the fields needed from Channel (id, name, niche, color, subscribers, views, watchHours, revenue, rpm) and includes `channel: { select: { id, name, color, niche } }` on Video.
- Computes everything in JS over the fetched rows:
  - **KPIs**: `totalViews`, `totalSubscribers`, `totalRevenue`, `totalWatchTime` (sums); `avgCTR`/`avgRetention` (mean across published videos with `views > 0`); `avgRPM = totalRevenue / totalViews * 1000`; `growthPct` derived from the views trend (last vs prev month, clamped to 3–30%).
  - **viewsTrend** (last 6 months, oldest → newest): buckets real video views by publish-month; distributes the residual `totalViews − Σvideo.views` across the 6-month window using ascending weights `[0.07, 0.09, 0.12, 0.15, 0.21, 0.36]` (most recent month gets the largest share — reflects ongoing distribution).
  - **subscribersTrend** (cumulative): most recent month = `totalSubscribers`; walk back applying the computed `growthRate` (`subs / (1+rate)^monthsBack`) — produces a smooth cumulative curve.
  - **revenueByChannel**: `[{name, color, revenue, subscribers}]` sorted desc by revenue.
  - **topVideos**: top 8 published videos by views with channel name + color + ctr + retention + revenue.
  - **worstVideos**: bottom 5 published videos with `views > 0` (excludes drafts and zero-view videos).
  - **performanceScatter**: `[{x: ctr, y: retention, size: views, name, channel, color}]` for every published video with engagement.
  - **nicheBreakdown**: groups subscribers + revenue by `channel.niche` (empty → "Other"), sorted desc by subs.
- All numbers rounded to 1dp (CTR/Retention) or 2dp (RPM/Revenue) on the server.

### Frontend (`AnalyticsSection`)
- **SectionHeader** — title "Analytics", description "Deep performance insights across your channels", icon `bar-chart-3`. Actions: a `Select` channel filter (All + each channel with colored dot) + a "Last 6 months" Badge with clock icon.
- **KPI grid** — 8 `StatCard`s in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`: Views (emerald/eye, real MoM delta), Subscribers (teal/users, growthPct delta), Avg CTR (amber/zap), Avg Retention (rose/timer), Avg RPM (orange/dollar), Total Revenue (emerald/wallet, views delta), Watch Time (teal/clock), Growth (amber/trending-up, growthPct delta). Staggered delays 0 → 0.28s.
- **Main charts row** (2 col on `lg`):
  - **Views Trend** — large `AreaChart` (h-280) with emerald gradient fill (42% → 0 opacity), smooth `monotone` curve, custom `GlassTooltip`, subtle gridlines (`strokeOpacity 0.08`), `formatNumber` Y axis, emerald glow blur in corner.
  - **Subscriber Growth** — `AreaChart` (h-280) with teal gradient fill, same pattern, cumulative subs.
- **Second charts row** (2 col on `lg`):
  - **Revenue by Channel** — horizontal `BarChart` (layout="vertical") with each `Cell` colored by channel.color, rounded right corners (`radius={[0,6,6,0]}`), `formatCompactMoney` X axis, hover cursor highlight, amber glow.
  - **Performance Map** — `ScatterChart` (signature chart) with `XAxis` = CTR, `YAxis` = Retention, `ZAxis` = views (bubble size range 60–640). One `<Scatter>` per channel (grouped client-side via `useMemo`), each with its channel's hex color at 72% opacity. Custom `ScatterTooltip` showing video title, channel dot, CTR/Retention/Views grid. `Legend` at bottom with circle icons.
- **Niche Breakdown** — donut `PieChart` (`innerRadius 56 / outerRadius 88 / paddingAngle 2`) cycling through `[emerald, amber, rose, teal, orange]` hex. Center overlay shows "Total" + `formatNumber(totalSubscribers)` in emerald. Below: legend rows with dot, niche name, sub count, % share.
- **Top Performing Videos** — ranked list (max 8) in a `ScrollArea` (`max-h-[420px]`). Each row: rank tile (#1 = amber trophy, rest = number), title (truncate), channel Pill, then inline stats (views, CTR, ret, revenue in emerald). `Progress` bar below each row sized by `views / maxTopViews * 100`, colored amber for #1 or by channel color otherwise. Staggered framer-motion entrance.
- **Needs Attention** (worst 5) — `grid-cols-1 sm:2 lg:5` of rose-tinted cards (`border-rose-500/20 bg-rose-500/5`). Each card: "Attention" Pill (rose), title (line-clamp-2), channel dot + name, big rose views number, separator, CTR + Retention footer.
- **Loading state** — `AnalyticsSkeleton` with `.shimmer` placeholders matching each section's layout (8 stat cards, 2×2 chart cards, niche + top-videos card).
- **Empty states** — `ChartEmpty` helper (icon tile + muted message) for charts with no data (e.g., filtered to a channel with no published videos).

### State
- `data: AnalyticsResponse | null`, `channels: ChannelLite[]`, `loading: boolean`, `channelFilter: string ("all" | channelId)`.
- `load()` re-fetches `/api/analytics` (with `?channelId=` when filter is set) — fires on mount and whenever `channelFilter` changes via `useCallback` + `useEffect`.
- `scatterGroups` `useMemo` groups scatter points by `channel__color` key so each channel becomes its own colored `<Scatter>` series (preserves the legend).
- `viewsDelta` `useMemo` computes MoM views % change from `viewsTrend` (last vs prev month).

### Palette discipline
- Strictly emerald/amber/rose/teal/orange — NO blue/indigo. Confirmed in `COLOR_HEX`, `NICHE_HEX`, all `Pill`/`StatCard` color props, and gradient stops.
- Dark-first glassmorphism via `glass` Card + accent blur corners. Framer-motion staggered entrance on KPIs + top-video rows. All numbers `tabular-nums`.

## Verification
- `bun run lint` → zero errors/warnings.
- `npx tsc --noEmit --skipLibCheck` → zero errors in the 2 new files (pre-existing errors in unrelated files untouched).
- `curl /api/analytics` → 200 in ~15ms with full payload: 4 channels aggregated, `kpis.totalViews 14.86M`, `kpis.totalSubscribers 454K`, `kpis.avgCTR 6.9%`, `kpis.avgRetention 48.0%`, `kpis.avgRPM $3.15`, `kpis.totalRevenue $46.85K`, `kpis.growthPct 30%`. `viewsTrend` returns 6 months Jan→Jun ascending (last month peaks at 7.99M from real video views). `subscribersTrend` cumulative 122K→454K. `revenueByChannel` sorted desc (Wealth Wire $22K → Calm Crafts $0). `topVideos` 8 entries with channel names + colors. `worstVideos` 5 entries (lowest 59K views). `performanceScatter` 16 published videos. `nicheBreakdown` 4 niches (Self Improvement 248K, Personal Finance 132K, Technology 64K, DIY & Crafts 9K).
- `curl /api/analytics?channelId=<real-id>` → 200 in ~12ms, correctly scoped to just Mindful Momentum (8.4M views, 248K subs, $18.4K revenue, 4 top videos, 1 niche).
- `curl /api/analytics?channelId=<fake-id>` → 200 with all-zero KPIs and empty arrays (graceful empty-state path).
- Dev log: `GET /api/analytics 200 in 15ms (compile: 7ms, render: 8ms)` — clean compile, no warnings.
- Browser automation (agent-browser): navigated to `/`, clicked "Analytics" in sidebar → all 7 chart sections render with no console errors or page errors. Channel Select dropdown shows "All channels" + 4 channel options with colored dots. Selecting "Mindful Momentum" updates the combobox + re-renders all charts (filter works end-to-end).

## Stage Summary
- Analytics section is fully functional end-to-end: a premium YouTube Studio + Stripe-style analytics dashboard with 8 KPI cards (real deltas where computable), 4 large charts (Views Area, Subscribers Area, Revenue-by-Channel horizontal Bar, Performance Scatter with per-channel colored bubbles), Niche Breakdown donut with center total + legend, ranked Top-8 videos list with Progress bars + trophy highlight, and rose-tinted "Needs Attention" worst-5 grid.
- Signature visual: the **Performance Map scatter** — bubble chart where each channel gets its own colored `<Scatter>` series (so the legend maps channels → colors naturally), bubble size encodes views, and a custom glass tooltip shows video title + channel + CTR/Retention/Views grid.
- API: single `GET /api/analytics[?channelId=]` endpoint aggregates Channel + Video in one parallel `Promise.all`, computes 7 derived datasets server-side in JS, returns in ~12–15ms warm.
- 2 new files created. No shared files modified (only `analytics.tsx` stub overwritten).
- Palette strictly emerald/amber/rose/teal/orange (NO blue/indigo). Dark-first glassmorphism consistent with the rest of the dashboard.
- Ready for orchestrator; already imported as `AnalyticsSection` in `page.tsx` (line 23 + 41).
