import type { Dinner, Wine, WineExperience } from "@/lib/types";

export const wines: Wine[] = [
  { id: "tempier-bandol", producer: "Domaine Tempier", cuvee: "Bandol Rouge", vintage: 2019, region: "Bandol", country: "France", grapes: ["Mourvèdre", "Grenache"], color: "red", bottlesOpened: 3 },
  { id: "lieser-riesling", producer: "Schloss Lieser", cuvee: "Niederberg Helden GG", vintage: 2021, region: "Mosel", country: "Germany", grapes: ["Riesling"], color: "white", bottlesOpened: 2 },
  { id: "radikon-sivi", producer: "Radikon", cuvee: "Sivi", vintage: 2020, region: "Friuli-Venezia Giulia", country: "Italy", grapes: ["Pinot Grigio"], color: "orange", bottlesOpened: 1 },
  { id: "laherte-freres", producer: "Laherte Frères", cuvee: "Ultradition", vintage: 2020, region: "Champagne", country: "France", grapes: ["Meunier", "Chardonnay"], color: "sparkling", bottlesOpened: 2 },
];

export const wineExperiences: WineExperience[] = [
  { id: "we-tempier-01", wineId: "tempier-bandol", dinnerId: "sunday-supper", openedAt: "2026-09-13", servingNote: "Decanted 90 minutes. Savory, dark-fruited, and best beside the chicken jus.", rating: 5 },
  { id: "we-lieser-01", wineId: "lieser-riesling", dinnerId: "sunday-supper", openedAt: "2026-09-13", servingNote: "Cold at first; opened beautifully by the second course.", rating: 4 },
  { id: "we-radikon-01", wineId: "radikon-sivi", dinnerId: "bar-fior", openedAt: "2026-08-28", servingNote: "Apricot skin, tea, and enough grip for the pork.", rating: 4 },
];

export const dinners: Dinner[] = [
  {
    id: "sunday-supper", title: "Late-summer Sunday supper", date: "2026-09-13T18:30:00-07:00", locationType: "home", venue: "Our place", status: "remembered",
    guests: ["Alicia", "Maya", "Theo", "Jon"], summary: "The tomatoes were at their peak, everyone stayed for one more glass, and the Riesling surprised us all.", coverImage: "/table-hero.jpg", photoCount: 18,
    courses: [
      { id: "tomato", title: "Tomatoes, peaches & whipped ricotta", description: "Basil oil, flaky salt, grilled sourdough", position: 1 },
      { id: "pasta", title: "Sweet corn agnolotti", description: "Brown butter, chanterelles, chives", position: 2 },
      { id: "chicken", title: "Roast chicken & late-summer beans", description: "Garlic jus, preserved lemon", position: 3 },
    ],
    wineExperienceIds: ["we-lieser-01", "we-tempier-01"],
    pairings: [
      { id: "pair-1", courseId: "tomato", wineExperienceId: "we-lieser-01", note: "The acidity made the peaches taste even brighter." },
      { id: "pair-2", courseId: "pasta", wineExperienceId: "we-lieser-01", note: "Best match of the night—sweet corn and slate." },
      { id: "pair-3", courseId: "chicken", wineExperienceId: "we-tempier-01", note: "Savory and effortless together." },
    ],
    ratings: [
      { id: "r1", personName: "Alicia", targetType: "pairing", targetId: "pair-2", rating: 5, note: "Would repeat exactly." },
      { id: "r2", personName: "Maya", targetType: "wine_experience", targetId: "we-lieser-01", rating: 4, note: "Loved it once it warmed up." },
      { id: "r3", personName: "Theo", targetType: "wine_experience", targetId: "we-tempier-01", rating: 5, note: "The bottle of the evening." },
    ],
  },
  {
    id: "bar-fior", title: "Dinner at Bar Fior", date: "2026-08-28T20:00:00-07:00", locationType: "restaurant", venue: "Bar Fior, San Francisco", status: "remembered",
    guests: ["Alicia", "Nina"], summary: "A tiny corner table, the pork collar worth returning for, and an orange wine we kept talking about.", coverImage: "/table-hero.jpg", photoCount: 7,
    courses: [
      { id: "fior-crudo", title: "Rockfish crudo", description: "Citrus, chile, green almond", position: 1 },
      { id: "fior-pork", title: "Grilled pork collar", description: "Plums, mustard greens", position: 2 },
    ],
    wineExperienceIds: ["we-radikon-01"], pairings: [{ id: "pair-fior", courseId: "fior-pork", wineExperienceId: "we-radikon-01", note: "The wine's tannin held up to the smoke." }],
    ratings: [{ id: "r4", personName: "Nina", targetType: "pairing", targetId: "pair-fior", rating: 4, note: "Unexpected, in the best way." }],
  },
];

export const getDinner = (id: string) => dinners.find((dinner) => dinner.id === id) ?? dinners[0];
export const getWine = (id: string) => wines.find((wine) => wine.id === id) ?? wines[0];
export const getWineExperience = (id: string) => wineExperiences.find((experience) => experience.id === id);
