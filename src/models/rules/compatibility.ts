/**
 * Mutual-consent matching. These are hard eligibility filters, never scores:
 * a convenient time or a nearby spot can't override someone's boundary.
 */

export type GroupPreference = "both" | "one_on_one" | "group";

export type PersonTraits = {
  id: string;
  gender: string | null;
  /** Genders this person is comfortable meeting (private). */
  companionGenders: readonly string[];
  groupPref: GroupPreference;
};

export type PlanTraits = {
  hostId: string;
  /** Genders the host is allowing for this specific plan. */
  allowedGenders: readonly string[];
  capacity: number;
};

/**
 * True when the joiner and everyone already in the plan are mutually OK:
 *  - the plan allows the joiner's gender (the host's boundary for this plan),
 *  - the joiner is comfortable with the host and every accepted guest,
 *  - every accepted guest is comfortable with the joiner.
 */
export function isMutuallyCompatible(
  joiner: PersonTraits,
  plan: PlanTraits,
  host: PersonTraits,
  acceptedGuests: readonly PersonTraits[],
): boolean {
  if (!joiner.gender || !plan.allowedGenders.includes(joiner.gender)) return false;
  for (const member of [host, ...acceptedGuests]) {
    if (member.id === joiner.id) continue;
    if (!member.gender || !joiner.companionGenders.includes(member.gender)) return false;
  }
  for (const guest of acceptedGuests) {
    if (guest.id === joiner.id) continue;
    if (!guest.companionGenders.includes(joiner.gender)) return false;
  }
  return true;
}

/** One-on-one people only see one-on-one plans; group people only see groups. */
export function groupPreferenceAllows(pref: GroupPreference, capacity: number): boolean {
  if (pref === "one_on_one") return capacity === 1;
  if (pref === "group") return capacity > 1;
  return true;
}

export type JoinCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "own_plan"
        | "closed"
        | "full"
        | "started"
        | "blocked"
        | "hidden"
        | "incompatible"
        | "group_pref";
    };

export const JOIN_BLOCK_MESSAGES: Record<Exclude<JoinCheck, { ok: true }>["reason"], string> = {
  own_plan: "This is your plan.",
  closed: "This plan isn't taking requests any more.",
  full: "This plan is full right now.",
  started: "This plan has already started.",
  blocked: "This plan isn't available.",
  hidden: "This plan isn't available.",
  incompatible: "This plan isn't available.",
  group_pref: "This plan doesn't match your one-on-one / group preference.",
};
