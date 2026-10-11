/** A verified mailbox provides a display name, not proof of a legal name. */
export function campusIdentity(email: string): { firstName: string; lastName: string | null } {
  const local = email.trim().toLowerCase().split("@")[0].split("+")[0];
  const name = local
    .replace(/(?:[._-](?:be|bt|btech|me|mtech|phd|mba|msc|bsc)\d[a-z0-9]*|(?:be|bt|btech|me|mtech|phd|mba|msc|bsc)\d{2,}[a-z0-9]*|\d+)$/i, "")
    .split(/[._\-\d]+/)
    .filter((part) => /^[a-z]+$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return { firstName: name[0] ?? "Campus member", lastName: name.slice(1).join(" ") || null };
}
