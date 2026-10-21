// Bounds apply before phrase generation, including to manual test requests.
export const LIMITS = Object.freeze({
  active: 6,
  pending: 24,
  // A power scroll asked 33 posts in 20 s against the first 30-per-tab limit and
  // every stamp after it stopped (2026-10-21). Posts flown past are no longer
  // asked about, and the daily cap still bounds spend.
  perMinute: 120,
  perTabMinute: 60,
  perDay: 1000,
  cacheEntries: 500,
  cacheBytes: 1024 * 1024,
  recordingEntries: 300,
  recordingBytes: 2 * 1024 * 1024,
});
const FIELDS = { text: 20000, author: 256, quoted_text: 10000, link_card: 2000 };

export function validPost(post) {
  if (!post || typeof post !== "object" || Array.isArray(post)) return null;
  if (typeof post.text !== "string" || !post.text.trim()) return null;
  const clean = {};
  for (const [field, limit] of Object.entries(FIELDS)) {
    if (!Object.hasOwn(post, field)) continue;
    if (typeof post[field] !== "string" || post[field].length > limit) return null;
    clean[field] = post[field];
  }
  return clean;
}

// Keep the newest rows within both count and UTF-8 byte limits.
export function trimRows(rows, count, bytes) {
  const result = [];
  let used = 2; // array brackets
  for (let i = rows.length - 1; i >= 0 && result.length < count; i--) {
    const size = new TextEncoder().encode(JSON.stringify(rows[i])).length + 1;
    if (size + used > bytes) break;
    used += size;
    result.push(rows[i]);
  }
  return result.reverse();
}
