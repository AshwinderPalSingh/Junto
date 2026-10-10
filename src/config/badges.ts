/** Achievements reward reliability and kindness — never "accepting everything". */
export const BADGES = [
  { id: "first_meetup", label: "First meetup", icon: "sprout", description: "Completed a first meetup on Junto." },
  { id: "reliable", label: "Reliable companion", icon: "shield-check", description: "Consistently shows up to confirmed meetups." },
  { id: "communicator", label: "Good communicator", icon: "megaphone", description: "Gives early notice when plans change." },
  { id: "explorer", label: "Campus explorer", icon: "compass", description: "Has done four or more kinds of activities." },
  { id: "builder", label: "Community builder", icon: "users", description: "Hosted group plans that brought people together." },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];
export const getBadge = (id: BadgeId) => BADGES.find((b) => b.id === id)!;
