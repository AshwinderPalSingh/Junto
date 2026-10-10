/** Options offered during onboarding and in settings. */

export const GENDERS = [
  { id: "woman", label: "Woman", plural: "Women" },
  { id: "man", label: "Man", plural: "Men" },
  { id: "nonbinary", label: "Non-binary", plural: "Non-binary people" },
] as const;
export type Gender = (typeof GENDERS)[number]["id"];
export const GENDER_IDS = GENDERS.map((g) => g.id) as [Gender, ...Gender[]];

export const YEARS = [
  { id: "y1", label: "1st year" },
  { id: "y2", label: "2nd year" },
  { id: "y3", label: "3rd year" },
  { id: "y4", label: "4th year" },
  { id: "y5", label: "5th year" },
  { id: "pg", label: "Masters" },
  { id: "phd", label: "PhD" },
  { id: "staff", label: "Staff / faculty" },
] as const;
export type YearId = (typeof YEARS)[number]["id"];
export const YEAR_IDS = YEARS.map((y) => y.id) as [YearId, ...YearId[]];

export const BRANCHES = [
  "Computer Engineering",
  "Computer Science & Business",
  "Electronics & Communication",
  "Electronics & Computer",
  "Electrical",
  "Mechanical",
  "Mechatronics",
  "Civil",
  "Chemical",
  "Biotechnology",
  "Mathematics & Computing",
  "Physics / Sciences",
  "Management",
  "Humanities",
  "Other",
] as const;

export const INTERESTS = [
  { id: "music", label: "Music" },
  { id: "movies", label: "Movies & shows" },
  { id: "anime", label: "Anime" },
  { id: "books", label: "Books" },
  { id: "coding", label: "Coding" },
  { id: "startups", label: "Startups" },
  { id: "cricket", label: "Cricket" },
  { id: "football", label: "Football" },
  { id: "badminton", label: "Badminton" },
  { id: "fitness", label: "Fitness" },
  { id: "running", label: "Running" },
  { id: "photography", label: "Photography" },
  { id: "gaming", label: "Gaming" },
  { id: "art", label: "Art & design" },
  { id: "dance", label: "Dance" },
  { id: "food", label: "Food" },
  { id: "chess", label: "Chess" },
  { id: "travel", label: "Travel" },
  { id: "debate", label: "Debate & MUN" },
  { id: "finance", label: "Finance" },
  { id: "volunteering", label: "Volunteering" },
  { id: "spirituality", label: "Spirituality" },
  { id: "poetry", label: "Poetry" },
  { id: "memes", label: "Memes" },
] as const;
export type InterestId = (typeof INTERESTS)[number]["id"];
export const INTEREST_IDS = INTERESTS.map((i) => i.id) as [InterestId, ...InterestId[]];

export const GROUP_PREFS = [
  { id: "both", label: "Either is fine", hint: "One-on-one or small groups" },
  { id: "one_on_one", label: "One-on-one", hint: "Just me and one other person" },
  { id: "group", label: "Groups only", hint: "I'm more comfortable in a group" },
] as const;
export type GroupPref = (typeof GROUP_PREFS)[number]["id"];
export const GROUP_PREF_IDS = GROUP_PREFS.map((g) => g.id) as [GroupPref, ...GroupPref[]];

export const VIBES = [
  { id: "quiet", label: "Quiet company" },
  { id: "activity", label: "Focused on the activity" },
  { id: "social", label: "Up for a good chat" },
] as const;
export type Vibe = (typeof VIBES)[number]["id"];
export const VIBE_IDS = VIBES.map((v) => v.id) as [Vibe, ...Vibe[]];

const yearById = new Map<string, string>(YEARS.map((y) => [y.id, y.label]));
const interestById = new Map<string, (typeof INTERESTS)[number]>(INTERESTS.map((i) => [i.id, i]));
const genderById = new Map<string, (typeof GENDERS)[number]>(GENDERS.map((g) => [g.id, g]));

export const yearLabel = (id: string | null | undefined) => (id ? yearById.get(id) ?? id : "");
export const interestOf = (id: string) => interestById.get(id);
export const genderOf = (id: string) => genderById.get(id);
