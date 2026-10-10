/**
 * Campus catalogue: what people can do and where they can meet.
 *
 * Meeting points are deliberately a fixed list of public, recognisable places.
 * Nobody can invite someone to a hostel room, a car or an isolated spot.
 * Ids are stored in the database, so only append new entries or rename labels.
 * `icon` is the name of a line icon (see views/components/icons.tsx).
 */

export const ACTIVITIES = [
  { id: "chai", label: "Chai / coffee", short: "Chai", icon: "coffee", hint: "15–30 min", defaultDuration: 30 },
  { id: "meal", label: "Grab a meal", short: "Meal", icon: "utensils", hint: "Mess, canteen or café", defaultDuration: 45 },
  { id: "walk", label: "Go for a walk", short: "Walk", icon: "footprints", hint: "20–45 min", defaultDuration: 30 },
  { id: "games", label: "Pool / TT / carrom", short: "Games", icon: "target", hint: "30–60 min", defaultDuration: 45 },
  { id: "sports", label: "Sports & gym", short: "Sports", icon: "dumbbell", hint: "Badminton, football, gym", defaultDuration: 60 },
  { id: "errand", label: "Run an errand", short: "Errand", icon: "shopping-bag", hint: "Market, pharmacy, dispensary", defaultDuration: 45 },
  { id: "study", label: "Study session", short: "Study", icon: "book-open", hint: "Library or reading room", defaultDuration: 90 },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];
export type Activity = (typeof ACTIVITIES)[number];
export const ACTIVITY_IDS = ACTIVITIES.map((a) => a.id) as [ActivityId, ...ActivityId[]];

export const SPOTS = [
  { id: "main-gate", name: "Main gate", area: "Entrance" },
  { id: "library", name: "Library entrance", area: "Academic block" },
  { id: "cafeteria", name: "Central cafeteria", area: "Food" },
  { id: "food-court", name: "Food court", area: "Food" },
  { id: "market", name: "Campus market", area: "Shops" },
  { id: "sports-complex", name: "Sports complex", area: "Sports" },
  { id: "gym", name: "Gym entrance", area: "Sports" },
  { id: "health-centre", name: "Health centre", area: "Services" },
  { id: "auditorium", name: "Auditorium steps", area: "Academic block" },
  { id: "lawns", name: "Admin block lawns", area: "Outdoors" },
  { id: "activity-centre", name: "Student activity centre", area: "Clubs" },
] as const;

export type SpotId = (typeof SPOTS)[number]["id"];
export type Spot = (typeof SPOTS)[number];
export const SPOT_IDS = SPOTS.map((s) => s.id) as [SpotId, ...SpotId[]];

const activityById = new Map<string, Activity>(ACTIVITIES.map((a) => [a.id, a]));
const spotById = new Map<string, Spot>(SPOTS.map((s) => [s.id, s]));

export function getActivity(id: string): Activity {
  return activityById.get(id) ?? ACTIVITIES[0];
}

export function getSpot(id: string): Spot {
  return spotById.get(id) ?? SPOTS[0];
}
