import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const now = new Date()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)
const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000)

async function main() {
  console.log('🌱 Seeding database...')

  // wipe
  await db.activity.deleteMany()
  await db.chatMessage.deleteMany()
  await db.bookmark.deleteMany()
  await db.readingItem.deleteMany()
  await db.habit.deleteMany()
  await db.note.deleteMany()
  await db.workflow.deleteMany()
  await db.goal.deleteMany()
  await db.transaction.deleteMany()
  await db.fileAsset.deleteMany()
  await db.trendItem.deleteMany()
  await db.task.deleteMany()
  await db.teamMember.deleteMany()
  await db.card.deleteMany()
  await db.video.deleteMany()
  await db.channel.deleteMany()

  // ─── Channels ────────────────────────────────────────────────────────────
  const channels = await Promise.all([
    db.channel.create({
      data: {
        name: 'Mindful Momentum',
        niche: 'Self Improvement',
        language: 'English',
        country: 'United States',
        status: 'active',
        monetized: true,
        adsenseAccount: 'adsense-mindful-01',
        logoUrl: '',
        bannerUrl: '',
        description: 'Daily self-improvement videos focused on productivity, habits, and mindset.',
        keywords: 'productivity, habits, mindset, self improvement, motivation',
        socialLinks: '{"twitter":"@mindfulmom","instagram":"@mindfulmomentum"}',
        notes: 'Flagship channel. Focus on long-form 10-15 min videos.',
        goals: 'Reach 500K subscribers by Q4',
        subscribers: 248500,
        views: 8420000,
        watchHours: 412000,
        revenue: 18420.5,
        rpm: 4.2,
        healthScore: 92,
        color: 'emerald',
      },
    }),
    db.channel.create({
      data: {
        name: 'Wealth Wire',
        niche: 'Personal Finance',
        language: 'English',
        country: 'United States',
        status: 'active',
        monetized: true,
        adsenseAccount: 'adsense-wealth-02',
        description: 'Personal finance, investing basics, and side hustle ideas.',
        keywords: 'finance, investing, money, side hustle, passive income',
        socialLinks: '{"twitter":"@wealthwire"}',
        notes: 'High RPM niche. 2 uploads per week.',
        goals: 'Launch course funnel',
        subscribers: 132400,
        views: 3980000,
        watchHours: 188000,
        revenue: 22310.75,
        rpm: 8.9,
        healthScore: 88,
        color: 'amber',
      },
    }),
    db.channel.create({
      data: {
        name: 'Tech Tidbits',
        niche: 'Technology',
        language: 'English',
        country: 'United States',
        status: 'growth',
        monetized: true,
        adsenseAccount: 'adsense-tech-03',
        description: 'Short tech tips, app reviews, and gadget unboxings.',
        keywords: 'tech, gadgets, apps, reviews, tips',
        socialLinks: '{"twitter":"@techtidbits"}',
        notes: 'Mix of Shorts and long-form.',
        goals: 'Reach 100K subs',
        subscribers: 64200,
        views: 2150000,
        watchHours: 96000,
        revenue: 6120.0,
        rpm: 3.1,
        healthScore: 76,
        color: 'rose',
      },
    }),
    db.channel.create({
      data: {
        name: 'Calm Crafts',
        niche: 'DIY & Crafts',
        language: 'English',
        country: 'United Kingdom',
        status: 'active',
        monetized: false,
        adsenseAccount: '',
        description: 'Relaxing DIY craft tutorials and home decor ideas.',
        keywords: 'diy, crafts, home decor, handmade',
        socialLinks: '{}',
        notes: 'In monetization review. 1000h needed.',
        goals: 'Hit monetization threshold',
        subscribers: 8900,
        views: 312000,
        watchHours: 2400,
        revenue: 0,
        rpm: 0,
        healthScore: 64,
        color: 'teal',
      },
    }),
  ])

  // ─── Videos ──────────────────────────────────────────────────────────────
  const videoTitles = [
    '5 Morning Habits That Changed My Life', 'How to Build Discipline in 30 Days',
    'The Science of Motivation Explained', 'Why You Feel Tired All The Time',
    'Atomic Habits Summary in 12 Minutes', 'Stop Procrastinating With This Trick',
    'The 2-Minute Rule for Productivity', 'How Rich People Think Differently',
    'Passive Income Myths Debunked', 'Investing for Beginners 2025',
    'Best AI Tools for Productivity', 'I Tried 7 Note Apps So You Do not Have To',
    'Calm Desk Organizer DIY', '10-Minute Declutter Routine',
  ]
  const videoData: any[] = []
  channels.forEach((ch, ci) => {
    for (let i = 0; i < 6; i++) {
      videoData.push({
        channelId: ch.id,
        title: videoTitles[(ci * 6 + i) % videoTitles.length],
        description: 'A deep dive into the topic with actionable takeaways for viewers.',
        keywords: ch.keywords.split(', ').slice(0, 3).join(', '),
        tags: 'youtube, ' + ch.niche.toLowerCase() + ', 2025',
        script: 'Hook: Did you know that...\n\nIntro...\n\nMain points...\n\nCTA: Subscribe for more.',
        hook: 'Stop scrolling — this changes everything.',
        cta: 'Subscribe and hit the bell for daily videos!',
        editingStatus: ['done', 'done', 'in_progress', 'done'][i % 4],
        publishDate: i < 4 ? daysAgo(i * 7 + ci * 2) : null,
        seoScore: 60 + ((ci + i) * 3) % 40,
        videoUrl: i < 4 ? 'https://youtube.com/watch?v=demo' : '',
        views: i < 4 ? Math.floor(50000 + Math.random() * 400000) : 0,
        ctr: i < 4 ? +(4 + Math.random() * 6).toFixed(1) : 0,
        retention: i < 4 ? +(35 + Math.random() * 30).toFixed(1) : 0,
        watchTime: i < 4 ? +(1000 + Math.random() * 8000).toFixed(0) : 0,
        revenue: i < 4 ? +(50 + Math.random() * 800).toFixed(2) : 0,
        notes: '',
      })
    }
  })
  await db.video.createMany({ data: videoData })

  // ─── Planner cards ───────────────────────────────────────────────────────
  const stages = ['ideas', 'research', 'script', 'voiceover', 'editing', 'thumbnail', 'ready', 'scheduled', 'published', 'archive']
  const cardTitles = [
    'Why Early Risers Are Not Always More Productive', 'The Truth About Hustle Culture',
    'How to Actually Stick to a Budget', 'Index Funds Explained Simply',
    'AI vs Human Creativity', 'Minimalist Desk Setup Tour',
    '30-Day Money Challenge', 'The 1% Rule for Skill Building',
    'Underrated Productivity Apps 2025', 'How to Read a Book a Week',
  ]
  const cards: any[] = []
  cardTitles.forEach((t, i) => {
    cards.push({
      title: t,
      description: 'Working title for an upcoming video.',
      stage: stages[i % stages.length],
      priority: ['low', 'medium', 'high'][i % 3],
      position: i,
      channelId: channels[i % channels.length].id,
      dueDate: i % 2 === 0 ? daysAhead(i + 2) : null,
      tags: channels[i % channels.length].niche,
    })
  })
  await db.card.createMany({ data: cards })

  // ─── Tasks ───────────────────────────────────────────────────────────────
  const tasks: any[] = [
    { title: 'Write script for "Discipline" video', priority: 'high', status: 'in_progress', category: 'Scripting', progress: 60, dueDate: daysAhead(1), channelId: channels[0].id },
    { title: 'Record voice over — finance video', priority: 'medium', status: 'todo', category: 'Voiceover', progress: 0, dueDate: daysAhead(2), channelId: channels[1].id },
    { title: 'Edit thumbnail for tech review', priority: 'high', status: 'todo', category: 'Thumbnail', progress: 0, dueDate: daysAhead(1), channelId: channels[2].id },
    { title: 'SEO optimize last 3 uploads', priority: 'medium', status: 'done', category: 'SEO', progress: 100, dueDate: daysAgo(1), channelId: channels[0].id },
    { title: 'Reply to comments on latest video', priority: 'low', status: 'todo', category: 'Community', progress: 0, dueDate: daysAhead(0), channelId: channels[1].id },
    { title: 'Plan content calendar for next month', priority: 'high', status: 'in_progress', category: 'Planning', progress: 40, dueDate: daysAhead(3) },
    { title: 'File taxes for Q1', priority: 'urgent', status: 'todo', category: 'Finance', progress: 10, dueDate: daysAhead(7) },
    { title: 'Onboard new thumbnail designer', priority: 'medium', status: 'todo', category: 'Team', progress: 0, dueDate: daysAhead(5) },
  ]
  await db.task.createMany({ data: tasks })

  // ─── Team ────────────────────────────────────────────────────────────────
  const team = await Promise.all([
    db.teamMember.create({ data: { name: 'Alex Rivera', role: 'Script Writer', email: 'alex@studio.io', status: 'active', rate: 35, skills: 'Research, storytelling, hooks', notes: 'Strong with finance content.' } }),
    db.teamMember.create({ data: { name: 'Maya Chen', role: 'Editor', email: 'maya@studio.io', status: 'active', rate: 28, skills: 'Premiere Pro, After Effects, pacing', notes: 'Fast turnaround.' } }),
    db.teamMember.create({ data: { name: 'Jordan Lee', role: 'Voice Artist', email: 'jordan@studio.io', status: 'active', rate: 45, skills: 'Voiceover, narration, tone', notes: 'Warm, authoritative voice.' } }),
    db.teamMember.create({ data: { name: 'Priya Patel', role: 'Thumbnail Designer', email: 'priya@studio.io', status: 'active', rate: 30, skills: 'Photoshop, CTR optimization', notes: 'High CTR designs.' } }),
    db.teamMember.create({ data: { name: 'Sam Okafor', role: 'SEO', email: 'sam@studio.io', status: 'active', rate: 32, skills: 'Keyword research, tags, descriptions', notes: '' } }),
  ])

  // ─── Trends ──────────────────────────────────────────────────────────────
  const trends: any[] = [
    { topic: 'AI productivity tools 2025', competitor: 'Ali Abdaal', keyword: 'ai productivity', searchVolume: 74000, difficulty: 62, opportunity: 88, category: 'Technology', bookmarked: true, source: 'YouTube Trends' },
    { topic: 'Side hustles with AI', competitor: 'Make Money Matt', keyword: 'ai side hustle', searchVolume: 110000, difficulty: 71, opportunity: 76, category: 'Finance', bookmarked: false, source: 'Google Trends' },
    { topic: 'Morning routine science', competitor: 'Huberman Lab', keyword: 'morning routine', searchVolume: 165000, difficulty: 55, opportunity: 82, category: 'Self Improvement', bookmarked: true, source: 'YouTube Trends' },
    { topic: 'Minimalist lifestyle', competitor: 'Matt D\'Avella', keyword: 'minimalism', searchVolume: 90500, difficulty: 48, opportunity: 79, category: 'Lifestyle', bookmarked: false, source: 'VidIQ' },
    { topic: 'Notion setup tutorials', competitor: 'Thomas Frank', keyword: 'notion setup', searchVolume: 60200, difficulty: 40, opportunity: 85, category: 'Productivity', bookmarked: false, source: 'TubeBuddy' },
    { topic: 'Crypto explained simply', competitor: 'Whiteboard Crypto', keyword: 'crypto explained', searchVolume: 148000, difficulty: 77, opportunity: 61, category: 'Finance', bookmarked: false, source: 'Google Trends' },
  ]
  await db.trendItem.createMany({ data: trends })

  // ─── Files ───────────────────────────────────────────────────────────────
  const files: any[] = [
    { name: 'Discipline_Script_v3.docx', type: 'script', size: '24 KB', folder: 'Scripts', tags: 'mindful' },
    { name: 'Budget_Voiceover.mp3', type: 'voiceover', size: '18 MB', folder: 'Voice Overs', tags: 'finance' },
    { name: 'TechReview_Final.mp4', type: 'video', size: '1.2 GB', folder: 'Videos', tags: 'tech' },
    { name: 'Background_Loop_01.mp3', type: 'music', size: '4 MB', folder: 'Music', tags: 'calm' },
    { name: 'Thumb_Mindful_01.png', type: 'thumbnail', size: '820 KB', folder: 'Thumbnails', tags: 'mindful' },
    { name: 'Logo_MindfulMomentum.svg', type: 'logo', size: '12 KB', folder: 'Brand Assets', tags: 'brand' },
    { name: 'Brand_Guidelines.pdf', type: 'brand', size: '2.1 MB', folder: 'Brand Assets', tags: 'brand' },
    { name: 'Q1_Finance_Report.xlsx', type: 'document', size: '88 KB', folder: 'Documents', tags: 'finance' },
  ]
  await db.fileAsset.createMany({ data: files })

  // ─── Finance transactions ────────────────────────────────────────────────
  const txns: any[] = []
  for (let m = 5; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 5)
    channels.forEach((ch, ci) => {
      if (ch.monetized) {
        txns.push({ channelId: ch.id, type: 'income', category: 'adsense', amount: +(ch.revenue / 6 + (Math.random() - 0.5) * 400).toFixed(2), description: `AdSense ${base.toLocaleString('default', { month: 'short' })}`, date: base })
      }
    })
    if (m % 2 === 0) txns.push({ type: 'income', category: 'sponsorship', amount: 1500 + m * 100, description: 'Sponsorship deal', date: base, channelId: channels[0].id })
  }
  const expenses = [
    { type: 'expense', category: 'software', amount: 79.99, description: 'Adobe Creative Cloud', date: daysAgo(5) },
    { type: 'expense', category: 'software', amount: 12.99, description: 'VidIQ Pro', date: daysAgo(5) },
    { type: 'expense', category: 'freelancer', amount: 420, description: 'Thumbnail designer (Priya)', date: daysAgo(12) },
    { type: 'expense', category: 'freelancer', amount: 280, description: 'Editor (Maya)', date: daysAgo(9) },
    { type: 'expense', category: 'equipment', amount: 1299, description: 'Sony ZV-E10 camera', date: daysAgo(30) },
    { type: 'expense', category: 'tax', amount: 2100, description: 'Q1 estimated taxes', date: daysAgo(20) },
    { type: 'expense', category: 'software', amount: 16, description: 'Notion Plus', date: daysAgo(2) },
  ]
  await db.transaction.createMany({ data: [...txns, ...expenses] })

  // ─── Goals ───────────────────────────────────────────────────────────────
  const goals: any[] = [
    { title: 'Total subscribers', type: 'subscriber', target: 600000, current: 454000, period: '2025', unit: 'subs', color: 'emerald' },
    { title: 'Yearly revenue', type: 'revenue', target: 120000, current: 46850, period: '2025', unit: '$', color: 'amber' },
    { title: 'Videos uploaded', type: 'upload', target: 312, current: 184, period: '2025', unit: 'videos', color: 'rose' },
    { title: 'Watch hours', type: 'yearly', target: 800000, current: 698400, period: '2025', unit: 'hours', color: 'teal' },
    { title: 'Script daily', type: 'daily_habit', target: 7, current: 5, period: 'this week', unit: 'days', color: 'emerald' },
    { title: 'Read 20 min daily', type: 'daily_habit', target: 7, current: 6, period: 'this week', unit: 'days', color: 'amber' },
  ]
  await db.goal.createMany({ data: goals })

  // ─── Workflows ───────────────────────────────────────────────────────────
  const wfStages = (done: number) => JSON.stringify(
    ['Idea', 'Research', 'Script', 'Voiceover', 'Editing', 'Thumbnail', 'SEO', 'Upload', 'Publish', 'Analytics']
      .map((label, i) => ({ key: label.toLowerCase(), label, done: i < done }))
  )
  const workflows: any[] = [
    { name: 'Discipline video pipeline', videoTitle: 'How to Build Discipline', channelName: 'Mindful Momentum', stages: wfStages(6), progress: 60, status: 'active' },
    { name: 'Passive income video', videoTitle: 'Passive Income Myths', channelName: 'Wealth Wire', stages: wfStages(3), progress: 30, status: 'active' },
    { name: 'AI tools review', videoTitle: 'Best AI Tools 2025', channelName: 'Tech Tidbits', stages: wfStages(9), progress: 90, status: 'active' },
    { name: 'Declutter routine', videoTitle: '10-Minute Declutter', channelName: 'Mindful Momentum', stages: wfStages(10), progress: 100, status: 'completed' },
  ]
  await db.workflow.createMany({ data: workflows })

  // ─── Notes ───────────────────────────────────────────────────────────────
  const notes: any[] = [
    { title: 'Video idea', content: 'Interview format with founders about morning routines.', color: 'emerald', pinned: true, type: 'quick' },
    { title: 'Sponsor contacts', content: 'Reach out to Notion, Skillshare, Brilliant for Q3.', color: 'amber', pinned: false, type: 'quick' },
    { title: 'Reminder', content: 'Check analytics every Monday 9am.', color: 'rose', pinned: false, type: 'sticky' },
    { title: 'Editing tips', content: 'Use J-cuts, add b-roll every 8s, keep pacing tight.', color: 'teal', pinned: false, type: 'sticky' },
  ]
  await db.note.createMany({ data: notes })

  // ─── Habits ──────────────────────────────────────────────────────────────
  const today = new Date()
  const last7 = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10))
  const habits: any[] = [
    { name: 'Write 1 script', streak: 5, goal: 7, history: JSON.stringify(last7.slice(0, 5)), color: 'emerald' },
    { name: 'Read 20 minutes', streak: 6, goal: 7, history: JSON.stringify(last7.slice(0, 6)), color: 'amber' },
    { name: 'Review analytics', streak: 3, goal: 5, history: JSON.stringify(last7.slice(0, 3)), color: 'rose' },
    { name: 'Engage with community', streak: 7, goal: 7, history: JSON.stringify(last7), color: 'teal' },
  ]
  await db.habit.createMany({ data: habits })

  // ─── Reading list ────────────────────────────────────────────────────────
  const reading: any[] = [
    { title: 'The Almanack of Naval Ravikant', url: '', category: 'Mindset', status: 'reading', notes: 'Great on leverage.' },
    { title: 'Deep Work — Cal Newport', url: '', category: 'Productivity', status: 'done', notes: 'Apply focus blocks.' },
    { title: 'YouTube Secrets — Sean Cannell', url: '', category: 'YouTube', status: 'todo', notes: '' },
    { title: 'Atomic Habits — James Clear', url: '', category: 'Mindset', status: 'done', notes: '' },
  ]
  await db.readingItem.createMany({ data: reading })

  // ─── Bookmarks ───────────────────────────────────────────────────────────
  const bookmarks: any[] = [
    { title: 'YouTube Studio', url: 'https://studio.youtube.com', category: 'Tools' },
    { title: 'VidIQ', url: 'https://vidiq.com', category: 'Tools' },
    { title: 'Google Trends', url: 'https://trends.google.com', category: 'Research' },
    { title: 'Canva', url: 'https://canva.com', category: 'Design' },
    { title: 'TubeBuddy', url: 'https://tubebuddy.com', category: 'Tools' },
  ]
  await db.bookmark.createMany({ data: bookmarks })

  // ─── Activity ────────────────────────────────────────────────────────────
  const activities: any[] = [
    { type: 'success', message: 'Published "5 Morning Habits That Changed My Life"', section: 'videos', createdAt: daysAgo(0) },
    { type: 'info', message: 'Scheduled 2 videos for next week', section: 'planner', createdAt: daysAgo(0) },
    { type: 'success', message: 'Mindful Momentum reached 248K subscribers', section: 'channels', createdAt: daysAgo(1) },
    { type: 'warning', message: 'Calm Crafts below monetization threshold', section: 'channels', createdAt: daysAgo(1) },
    { type: 'info', message: 'New trend research added: AI productivity tools', section: 'research', createdAt: daysAgo(2) },
    { type: 'success', message: 'AdSense payment received: $3,240', section: 'finance', createdAt: daysAgo(2) },
    { type: 'info', message: 'Completed SEO for 3 videos', section: 'tasks', createdAt: daysAgo(3) },
    { type: 'success', message: 'AI tools review workflow 90% complete', section: 'automation', createdAt: daysAgo(3) },
  ]
  await db.activity.createMany({ data: activities })

  console.log('✅ Seed complete.')
  console.log(`   Channels: ${channels.length}, Team: ${team.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
