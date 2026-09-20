import type { Wine, WineColor } from "@/lib/types";

type CourseInput = { id: string | number; title: string };

export type WineRecommendation = {
  courseId: string | number;
  courseTitle: string;
  wine: Wine;
  why: string;
};

type PairingRule = {
  keywords: string[];
  colors: WineColor[];
  reason: string;
};

const rules: PairingRule[] = [
  { keywords: ["truffle", "mushroom", "beef", "lamb", "duck", "steak", "ragu", "ragù"], colors: ["red", "orange"], reason: "Its savory depth and structure echo the dish's earthy richness, while fresh acidity keeps each bite lifted." },
  { keywords: ["oyster", "fish", "crudo", "shellfish", "shrimp", "scallop", "lemon", "salad"], colors: ["white", "sparkling", "rosé"], reason: "Bright acidity and mineral freshness meet the delicate flavors without covering them up." },
  { keywords: ["spicy", "chili", "chile", "curry", "thai", "sichuan", "kimchi"], colors: ["white", "orange", "rosé"], reason: "Aromatic fruit and refreshing acidity soften the heat and keep the pairing vivid." },
  { keywords: ["tomato", "pasta", "pizza", "lasagna"], colors: ["red", "orange", "rosé"], reason: "Juicy fruit and food-friendly acidity mirror the sauce and reset the palate between bites." },
  { keywords: ["chicken", "pork", "turkey", "veal"], colors: ["white", "red", "orange"], reason: "It has enough texture for the savory center of the dish, with freshness to carry the whole plate." },
  { keywords: ["cake", "tart", "dessert", "chocolate", "fruit", "sweet"], colors: ["sparkling", "rosé", "white"], reason: "Its lift and bright fruit make a celebratory contrast without making dessert feel heavy." },
];

const fallbackRule: PairingRule = {
  keywords: [],
  colors: ["white", "sparkling", "red", "orange", "rosé"],
  reason: "Its balance of fruit, texture, and acidity makes it a flexible partner while the final details of the dish take shape.",
};

export function recommendWines(courses: CourseInput[], wines: Wine[]): WineRecommendation[] {
  if (!wines.length) return [];
  return courses.filter((course) => course.title.trim()).map((course, courseIndex) => {
    const title = course.title.trim();
    const lowerTitle = title.toLowerCase();
    const rule = rules.find((candidate) => candidate.keywords.some((keyword) => lowerTitle.includes(keyword))) ?? fallbackRule;
    const ranked = wines
      .map((wine, wineIndex) => ({ wine, wineIndex, score: wineScore(wine, rule, lowerTitle) }))
      .sort((a, b) => b.score - a.score || Math.abs(a.wineIndex - courseIndex) - Math.abs(b.wineIndex - courseIndex));
    const wine = ranked[0].wine;
    return { courseId: course.id, courseTitle: title, wine, why: rule.reason };
  });
}

function wineScore(wine: Wine, rule: PairingRule, courseTitle: string) {
  const colorPosition = rule.colors.indexOf(wine.color);
  let score = colorPosition === -1 ? 0 : (rule.colors.length - colorPosition) * 10;
  const profile = `${wine.region} ${wine.country} ${wine.grapes.join(" ")} ${wine.description ?? ""} ${wine.tastingNotes ?? ""}`.toLowerCase();
  for (const word of courseTitle.split(/\W+/).filter((item) => item.length > 4)) if (profile.includes(word)) score += 2;
  return score;
}

export function suggestWineProfile(input: { color: WineColor; region?: string; country?: string; grapes?: string[] }) {
  const place = [input.region?.trim(), input.country?.trim()].filter(Boolean).join(", ") || "an unrecorded region";
  const grapes = input.grapes?.filter(Boolean).join(", ") || "its regional grapes";
  const notes: Record<WineColor, string> = {
    red: "Dark cherry, dried herbs, savory spice, and a structured finish.",
    white: "Citrus, orchard fruit, mineral freshness, and a clean, bright finish.",
    orange: "Apricot skin, tea, gentle grip, and a long, savory finish.",
    "rosé": "Wild strawberry, citrus peel, fresh herbs, and a crisp finish.",
    sparkling: "Green apple, lemon zest, fine bubbles, and a chalky finish.",
  };
  return {
    description: `A ${input.color} wine from ${place}, made with ${grapes}. Add the story of the producer or bottle as you get to know it.`,
    tastingNotes: notes[input.color],
  };
}
