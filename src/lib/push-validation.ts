/** Browser push-service allowlist prevents subscriptions becoming server-side URL fetches. */
export function safePushEndpoint(endpoint: string): boolean {
  try {
    if (endpoint.length > 2000) return false;
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return false;
    return ["fcm.googleapis.com", "updates.push.services.mozilla.com"].includes(url.hostname) ||
      /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname) ||
      /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  } catch { return false; }
}

export function safePushKeys(p256dh: string, auth: string): boolean {
  if (!/^[A-Za-z0-9_-]{87}$/.test(p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(auth)) return false;
  const publicKey = Buffer.from(p256dh, "base64url");
  return publicKey.length === 65 && publicKey[0] === 4 && Buffer.from(auth, "base64url").length === 16;
}
