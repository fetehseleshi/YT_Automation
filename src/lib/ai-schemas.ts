export const aiSchemas: Record<string, any> = {
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

  scripts: {
    hook: "string",
    intro: "string",
    main_points: ["string"],
    cta: "string",
    full_script: "string",
  },

  hooks: {
    hooks: ["string"],
  },

  seo: {
    titles: ["string"],
    keywords: {
      primary: ["string"],
      secondary: ["string"],
    },
    description: "string",
  },

  thumbnails: {
    concepts: [
      {
        visual: "string",
        text_overlay: "string",
        emotion: "string",
        reason: "string",
      },
    ],
  },
};