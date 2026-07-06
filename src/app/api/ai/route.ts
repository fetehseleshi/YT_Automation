import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getChannelContext } from "@/lib/ai-context";

/**
 * TOOL CONFIG
 */
export const toolConfig: Record<
  string,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    systemPrompt: string;
  }
> = {
  ideas: {
    label: "Video Ideas",
    description: "Generate 8 specific, high-CTR YouTube video ideas",
    icon: "lightbulb",
    color: "teal",
    systemPrompt:
      "Generate 8 YouTube video ideas with CTR optimization and hooks.",
  },

  titles: {
    label: "Titles",
    description: "Generate 10 click-worthy title variations",
    icon: "file-text",
    color: "amber",
    systemPrompt:
      "Generate 10 high CTR YouTube titles using psychology triggers.",
  },

  scripts: {
    label: "Scripts",
    description: "Write a full YouTube video script (hook, intro, 3-5 main points, CTA)",
    icon: "file-text",
    color: "emerald",
    systemPrompt:
      "Write full YouTube scripts with hook, intro, body, CTA.",
  },

  hooks: {
    label: "Hooks",
    description: "Generate 10 scroll-stopping first-line hooks",
    icon: "zap",
    color: "amber",
    systemPrompt:
      "Generate 10 viral hooks under 5 seconds attention grabbers.",
  },

  seo: {
    label: "SEO Audit",
    description: "Audit and improve SEO: suggest title/keyword/description improvements",
    icon: "gauge",
    color: "orange",
    systemPrompt:
      "Improve SEO with titles, keywords, and descriptions.",
  },

  rewrite: {
    label: "Rewrite",
    description: "Rewrite scripts for retention and clarity",
    icon: "edit",
    color: "rose",
    systemPrompt:
      "Rewrite the provided YouTube script to improve pacing, clarity, audience retention, emotional pull, and calls to action.",
  },

  descriptions: {
    label: "Descriptions",
    description: "Generate SEO YouTube descriptions",
    icon: "list-checks",
    color: "teal",
    systemPrompt:
      "Write an SEO-optimized YouTube description with a strong first paragraph, timestamps, keywords, hashtags, and CTA.",
  },

  tags: {
    label: "Tags",
    description: "Generate YouTube tags",
    icon: "bookmark",
    color: "orange",
    systemPrompt:
      "Generate relevant YouTube tags and keywords for discoverability without keyword stuffing.",
  },

  keywords: {
    label: "Keywords",
    description: "Research YouTube keywords",
    icon: "search",
    color: "emerald",
    systemPrompt:
      "Suggest primary and secondary YouTube keywords with search intent, content angle, and ranking rationale.",
  },

  thumbnails: {
    label: "Thumbnails",
    description: "Generate thumbnail concepts",
    icon: "image",
    color: "rose",
    systemPrompt:
      "Create high-CTR YouTube thumbnail concepts with visual composition, facial emotion, text overlay, color contrast, and curiosity gap.",
  },

  shorts: {
    label: "Shorts",
    description: "Generate YouTube Shorts ideas",
    icon: "play",
    color: "teal",
    systemPrompt:
      "Turn the topic into short-form video ideas optimized for hooks, retention, loops, and quick payoff.",
  },

  trending: {
    label: "Trending",
    description: "Find trending content angles",
    icon: "trending-up",
    color: "amber",
    systemPrompt:
      "Suggest trend-aware YouTube topics and angles for the niche, focusing on timely creator opportunities and audience demand.",
  },

  summarize: {
    label: "Summarize",
    description: "Summarize research",
    icon: "clipboard-list",
    color: "emerald",
    systemPrompt:
      "Summarize research, transcripts, or notes into actionable creator insights, key points, risks, and next steps.",
  },

  translate: {
    label: "Translate",
    description: "Translate and localize scripts",
    icon: "languages",
    color: "rose",
    systemPrompt:
      "Translate and localize the provided YouTube script naturally for the requested target language while preserving intent and pacing.",
  },
};

/**
 * BASE PERSONA
 */
const BASE_PERSONA =
  "You are an expert YouTube automation strategist. Always return VALID JSON ONLY. No markdown, no explanations.";

/**
 * JSON SCHEMAS (STEP 3 CORE)
 */
const schemas: Record<string, any> = {
  ideas: {
    ideas: [
      {
        title: "string",
        hook: "string",
        audience: "string",
        ctr_score: "number (1-10)",
        reason: "string",
      },
    ],
  },

  titles: {
    titles: ["string"],
  },

  hooks: {
    hooks: ["string"],
  },

  scripts: {
    hook: "string",
    intro: "string",
    main_points: ["string"],
    cta: "string",
    full_script: "string",
  },

  seo: {
    titles: ["string"],
    keywords: {
      primary: ["string"],
      secondary: ["string"],
    },
    description: "string",
  },

  rewrite: {
    rewritten_script: "string",
    improvements: ["string"],
    stronger_hook: "string",
    retention_notes: ["string"],
    cta: "string",
  },

  descriptions: {
    description: "string",
    timestamps: ["string"],
    keywords: ["string"],
    hashtags: ["string"],
    pinned_comment: "string",
  },

  tags: {
    tags: ["string"],
    long_tail_tags: ["string"],
    avoid: ["string"],
  },

  keywords: {
    primary: ["string"],
    secondary: ["string"],
    long_tail: ["string"],
    rationale: ["string"],
  },

  thumbnails: {
    concepts: [
      {
        title: "string",
        visual: "string",
        text_overlay: "string",
        emotion: "string",
        colors: "string",
        why_it_clicks: "string",
      },
    ],
  },

  shorts: {
    shorts: [
      {
        idea: "string",
        hook: "string",
        beats: ["string"],
        loop: "string",
        caption: "string",
      },
    ],
  },

  trending: {
    trends: [
      {
        topic: "string",
        angle: "string",
        audience: "string",
        urgency: "string",
        title: "string",
      },
    ],
  },

  summarize: {
    summary: "string",
    key_insights: ["string"],
    action_items: ["string"],
    content_angles: ["string"],
  },

  translate: {
    language: "string",
    localized_script: "string",
    notes: ["string"],
  },
};

function bullets(items?: unknown, fallback = "") {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => `* ${String(item)}`).join("\n");
}

function numberedConcepts(items?: unknown) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((item: any, i: number) => {
      const lines = [
        `### ${i + 1}. ${item?.title ?? item?.idea ?? item?.topic ?? "Concept"}`,
        item?.visual ? `* **Visual:** ${item.visual}` : "",
        item?.text_overlay ? `* **Text overlay:** ${item.text_overlay}` : "",
        item?.emotion ? `* **Emotion:** ${item.emotion}` : "",
        item?.colors ? `* **Colors:** ${item.colors}` : "",
        item?.why_it_clicks ? `* **Why it clicks:** ${item.why_it_clicks}` : "",
        item?.angle ? `* **Angle:** ${item.angle}` : "",
        item?.audience ? `* **Audience:** ${item.audience}` : "",
        item?.urgency ? `* **Urgency:** ${item.urgency}` : "",
        item?.hook ? `* **Hook:** ${item.hook}` : "",
        item?.beats ? `* **Beats:**\n${bullets(item.beats)}` : "",
        item?.loop ? `* **Loop:** ${item.loop}` : "",
        item?.caption ? `* **Caption:** ${item.caption}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * SAFE JSON PARSER
 */
function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ Invalid JSON from AI:", text);
    return null;
  }
}

/**
 * FALLBACK RESPONSE
 */
function userAiErrorMessage(tool: string, detail?: string) {
  if (!detail) return `AI failed for ${tool}. Try again with more detail.`;

  if (detail.includes("GEMINI_API_KEY")) {
    return "Gemini is not configured yet. Add GEMINI_API_KEY in .env, restart the app, and try again.";
  }
  if (detail.includes("401") || detail.includes("403") || detail.toLowerCase().includes("api key")) {
    return "Gemini rejected the API key. Please create a fresh Google AI Studio API key, add it to GEMINI_API_KEY in .env, restart the app, and try again.";
  }
  if (detail.includes("404") || detail.toLowerCase().includes("model")) {
    return "Gemini could not use the selected model. Try GEMINI_MODEL=\"gemini-3.5-flash\" in .env, then restart the app.";
  }
  if (detail.includes("429")) {
    return "Gemini rate limit reached. Wait a bit or switch to another available Gemini model/key.";
  }

  return `AI failed for ${tool}. Provider error: ${detail.slice(0, 180)}`;
}

function fallbackResponse(tool: string, detail?: string) {
  return {
    error: true,
    message: userAiErrorMessage(tool, detail),
  };
}

function readLocalAiConfig() {
  try {
    const configPath = path.join(process.cwd(), ".z-ai-config");
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (e) {
    console.error("[AI CONFIG] Could not read .z-ai-config", e);
    return {};
  }
}

function getConfiguredChatModel() {
  if (process.env.AI_CHAT_MODEL) return process.env.AI_CHAT_MODEL;
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;

  const config: any = readLocalAiConfig();
  return config.chatModel || config.model || undefined;
}

function getGeminiConfig() {
  const config: any = readLocalAiConfig();
  const provider = String(config.provider || process.env.AI_PROVIDER || "").toLowerCase();
  const baseUrl = String(
    config.baseUrl ||
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com"
  ).replace(/\/+$/, "");
  const apiKey =
    process.env.GEMINI_API_KEY ||
    config.geminiApiKey ||
    (provider === "gemini" ? config.apiKey : "");
  const enabled =
    Boolean(apiKey) &&
    (provider === "gemini" ||
      Boolean(process.env.GEMINI_API_KEY) ||
      baseUrl.includes("generativelanguage.googleapis.com"));

  return {
    enabled,
    apiKey,
    baseUrl,
    model: getConfiguredChatModel() || "gemini-3.5-flash",
  };
}

async function createGeminiCompletion({
  systemPrompt,
  input,
}: {
  systemPrompt: string;
  input: string;
}) {
  const gemini = getGeminiConfig();
  if (!gemini.enabled) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY to .env.");
  }

  const res = await fetch(`${gemini.baseUrl}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": gemini.apiKey!,
    },
    body: JSON.stringify({
      model: gemini.model,
      system_instruction: systemPrompt,
      input,
      generation_config: {
        temperature: 0.7,
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text);
  return (
    data.output_text ||
    data.outputText ||
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ||
    data.steps
      ?.flatMap((step: any) => step.content || step.contents || [])
      ?.map((part: any) => part.text || "")
      ?.join("") ||
    ""
  ).trim();
}

/**
 * POST /api/ai
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const tool = (body?.tool ?? "ideas").toString().trim();
    const input = (body?.input ?? "").toString().trim();

    if (!input) {
      return NextResponse.json(
        { error: "Input is required" },
        { status: 400 }
      );
    }

    const session = await getSessionUser();
    const userId = session?.user?.id;

    const cfg = toolConfig[tool] ?? toolConfig.ideas;
    
    /**
     * SAFE CONTEXT GATHERING
     * Defensive block preventing channel database setup flaws from breaking the generation chain
     */
    let context = null;
    if (userId) {
      try {
        context = await getChannelContext(userId);
      } catch (contextErr) {
        console.error("⚠️ Gracefully handled context database failure:", contextErr);
      }
    }

    const schema = schemas[tool] ?? schemas.ideas;

    /**
     * SYSTEM PROMPT (FORCE JSON OUTPUT)
     */
    const systemPrompt = `
${BASE_PERSONA}

TOOL: ${cfg.label}
TASK: ${cfg.systemPrompt}

CRITICAL RULE:
Return ONLY valid JSON.
No markdown. No explanations. No text outside JSON.

OUTPUT SCHEMA:
${JSON.stringify(schema, null, 2)}

${context ? `CHANNEL CONTEXT:\n${JSON.stringify(context, null, 2)}` : ""}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: input },
    ];

    let raw = "";
    let parsed: any = null;

    try {
      const gemini = getGeminiConfig();
      if (gemini.enabled) {
        raw = await createGeminiCompletion({ systemPrompt, input });
      } else {
        const zai = await ZAI.create();
        const model = getConfiguredChatModel();

        const completion = await zai.chat.completions.create({
          ...(model ? { model } : {}),
          messages,
          thinking: { type: "disabled" },
        });

        raw =
          completion?.choices?.[0]?.message?.content?.trim() ||
          completion?.choices?.[0]?.text?.trim() ||
          "";
      }

      console.log("🤖 RAW AI RESPONSE:", raw);

      parsed = safeParse(raw);

      if (!parsed) {
        throw new Error("Invalid JSON output");
      }
    } catch (err) {
      console.error("[AI ERROR]", err);
      parsed = fallbackResponse(tool, err instanceof Error ? err.message : undefined);
    }

    // Gracefully send parsing failures inside the message layout stream
    if (parsed.error) {
      return NextResponse.json({
        success: true,
        tool,
        content: `## ${cfg.label}\n\n${parsed.message}`,
        raw,
      });
    }

    /**
     * CONVERT STRUCTURED JSON TO BEAUTIFUL MARKDOWN FOR THE FRONTEND CHAT UI
     */
    let formattedContent = "";

    if (tool === "ideas" && parsed.ideas) {
      formattedContent = parsed.ideas
        .map(
          (id: any, i: number) =>
            `### ${i + 1}. ${id.title}\n` +
            `* **Hook:** ${id.hook}\n` +
            `* **Audience:** ${id.audience}\n` +
            `* **CTR Score:** 🔥 ${id.ctr_score}/10\n` +
            `* **Strategy:** ${id.reason}\n`
        )
        .join("\n");
    } else if (tool === "titles" && parsed.titles) {
      formattedContent =
        `Here are your click-optimized title variations:\n\n` +
        parsed.titles.map((t: string) => `* ${t}`).join("\n");
    } else if (tool === "hooks" && parsed.hooks) {
      formattedContent =
        `### Scroll-Stopping Hooks\n\n` +
        parsed.hooks.map((h: string, i: number) => `**Hook ${i + 1}:** "${h}"`).join("\n\n");
    } else if (tool === "scripts") {
      formattedContent =
        `## Video Script\n\n` +
        `### 🪝 Hook\n${parsed.hook}\n\n` +
        `### 🎬 Intro\n${parsed.intro}\n\n` +
        `### 📝 Main Breakdown\n${parsed.main_points?.map((p: string) => `* ${p}`).join("\n")}\n\n` +
        `### 📢 Call To Action\n${parsed.cta}\n\n` +
        `---\n### 📄 Full Production Script\n${parsed.full_script}`;
    } else if (tool === "seo") {
      formattedContent =
        `## SEO Optimization Audit\n\n` +
        `### 🎯 Recommended High-CTR Titles\n` +
        parsed.titles?.map((t: string) => `* ${t}`).join("\n") +
        `\n\n` +
        `### 🔑 Tag Keywords\n` +
        `* **Primary:** ${parsed.keywords?.primary?.join(", ")}\n` +
        `* **Secondary:** ${parsed.keywords?.secondary?.join(", ")}\n\n` +
        `### 📝 Optimized Description Block\n\`\`\`text\n${parsed.description}\n\`\`\``;
    } else if (tool === "rewrite") {
      formattedContent =
        `## Rewritten Script\n\n${parsed.rewritten_script ?? ""}\n\n` +
        `### Stronger Hook\n${parsed.stronger_hook ?? ""}\n\n` +
        `### Improvements\n${bullets(parsed.improvements)}\n\n` +
        `### Retention Notes\n${bullets(parsed.retention_notes)}\n\n` +
        `### CTA\n${parsed.cta ?? ""}`;
    } else if (tool === "descriptions") {
      formattedContent =
        `## YouTube Description\n\n\`\`\`text\n${parsed.description ?? ""}\n\`\`\`\n\n` +
        `### Timestamps\n${bullets(parsed.timestamps)}\n\n` +
        `### Keywords\n${bullets(parsed.keywords)}\n\n` +
        `### Hashtags\n${bullets(parsed.hashtags)}\n\n` +
        `### Pinned Comment\n${parsed.pinned_comment ?? ""}`;
    } else if (tool === "tags") {
      formattedContent =
        `## YouTube Tags\n\n${bullets(parsed.tags)}\n\n` +
        `### Long-tail Tags\n${bullets(parsed.long_tail_tags)}\n\n` +
        `### Avoid\n${bullets(parsed.avoid)}`;
    } else if (tool === "keywords") {
      formattedContent =
        `## Keyword Research\n\n` +
        `### Primary\n${bullets(parsed.primary)}\n\n` +
        `### Secondary\n${bullets(parsed.secondary)}\n\n` +
        `### Long-tail\n${bullets(parsed.long_tail)}\n\n` +
        `### Rationale\n${bullets(parsed.rationale)}`;
    } else if (tool === "thumbnails") {
      formattedContent = `## Thumbnail Concepts\n\n${numberedConcepts(parsed.concepts)}`;
    } else if (tool === "shorts") {
      formattedContent = `## Shorts Ideas\n\n${numberedConcepts(parsed.shorts)}`;
    } else if (tool === "trending") {
      formattedContent = `## Trending Angles\n\n${numberedConcepts(parsed.trends)}`;
    } else if (tool === "summarize") {
      formattedContent =
        `## Summary\n\n${parsed.summary ?? ""}\n\n` +
        `### Key Insights\n${bullets(parsed.key_insights)}\n\n` +
        `### Action Items\n${bullets(parsed.action_items)}\n\n` +
        `### Content Angles\n${bullets(parsed.content_angles)}`;
    } else if (tool === "translate") {
      formattedContent =
        `## ${parsed.language ?? "Localized"} Script\n\n${parsed.localized_script ?? ""}\n\n` +
        `### Localization Notes\n${bullets(parsed.notes)}`;
    } else {
      formattedContent = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    }

    formattedContent = `## ${cfg.label}\n\n${formattedContent}`.trim();

    /**
     * SAVE CHAT HISTORY
     */
    try {
      await db.chatMessage.createMany({
        data: [
          { role: "user", content: input, tool },
          {
            role: "assistant",
            content: formattedContent,
            tool,
          },
        ],
      });
      await db.aIHistory.create({
        data: {
          tool,
          category: "text",
          prompt: input.slice(0, 2000),
          response: formattedContent.slice(0, 8000),
          model: "zai",
          favorite: false,
          meta: JSON.stringify({ hasContext: !!context }),
        },
      });
    } catch (err) {
      console.error("[DB ERROR]", err);
    }

    /**
     * FINAL RESPONSE
     */
    return NextResponse.json({
      success: true,
      tool,
      content: formattedContent,
      raw,
      hasContext: !!context,
    });
  } catch (err) {
    console.error("[API ERROR]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
