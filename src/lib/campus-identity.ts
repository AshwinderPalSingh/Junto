export type UniversityProfile = {
  provider: "google" | "microsoft";
  subject: string;
  fullName: string;
  givenName: string;
  familyName: string | null;
};

export const CAMPUS_EMAIL_DOMAIN = "thapar.edu";

export function isCampusEmail(email: string): boolean {
  return /^[^\s@]+@thapar\.edu$/i.test(email);
}

function profileText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().normalize("NFC");
  return text.length > 0 && text.length <= 128 && !/[\p{Cc}\p{Cf}]/u.test(text) ? text : null;
}

/** Only call with claims validated by the OIDC client, never browser-submitted claims. */
export function universityProfile(
  provider: UniversityProfile["provider"], claims: Record<string, unknown>,
  expectedEmail: string, domains: string[], tenant?: string,
): UniversityProfile {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const domain = email.split("@")[1];
  const fullName = profileText(claims.name);
  if (!isCampusEmail(email) || email !== expectedEmail.toLowerCase() || !domains.includes(domain) || !fullName ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) {
    throw new Error("Use the same university account you verified in Junto.");
  }
  if (provider === "google" && (claims.email_verified !== true || claims.hd !== domain)) {
    throw new Error("A verified university Google Workspace account is required.");
  }
  if (provider === "microsoft" && (!tenant || claims.tid !== tenant)) {
    throw new Error("Use your university's Microsoft tenant.");
  }
  return { provider, subject: claims.sub, fullName,
    givenName: profileText(claims.given_name) ?? fullName,
    familyName: profileText(claims.family_name) };
}

/** The provider has already validated these claims before account creation. */
export function universitySignInProfile(
  provider: UniversityProfile["provider"], claims: Record<string, unknown>, tenant?: string,
): UniversityProfile & { email: string } {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  return { ...universityProfile(provider, claims, email, [CAMPUS_EMAIL_DOMAIN], tenant), email };
}
