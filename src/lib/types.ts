export type DinnerLocation = "home" | "restaurant";
export type DinnerStatus = "planning" | "happening" | "remembered";
export type WineColor = "red" | "white" | "orange" | "rosé" | "sparkling";

export interface Course { id: string; title: string; description: string; position: number; }
export interface Wine { id: string; producer: string; cuvee: string; vintage: number; region: string; country: string; grapes: string[]; color: WineColor; bottlesOpened: number; }
export interface WineExperience { id: string; wineId: string; dinnerId: string; openedAt: string; servingNote: string; rating: number; }
export interface Pairing { id: string; courseId: string; wineExperienceId: string; note: string; }
export interface PersonRating { id: string; personName: string; targetType: "course" | "wine_experience" | "pairing"; targetId: string; rating: 1 | 2 | 3 | 4 | 5; note: string; }
export interface Dinner {
  id: string; title: string; date: string; locationType: DinnerLocation; venue: string; status: DinnerStatus;
  guests: string[]; summary: string; coverImage: string; courses: Course[]; wineExperienceIds: string[];
  pairings: Pairing[]; ratings: PersonRating[]; photoCount: number;
}
