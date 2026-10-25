/**
 * Lightweight fuzzy search used by the inventory pickers.
 */

/**
 * Subsequence fuzzy match score (higher = better), or -1 when there is no
 * match. Prefers matches at word starts and consecutive runs, so "fl r" still
 * finds "Flour", and "crt" ranks "Croissant" above "Carrot Cake".
 */
export const fuzzyScore = (text: string, query: string): number => {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  // Exact substring match is the strongest signal
  if (t.includes(q)) return 1000 - t.indexOf(q);

  let score = 0;
  let ti = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    // Word-start bonus + streak bonus for consecutive characters
    const wordStart = found === 0 || /\s|[^\w]/.test(t[found - 1]);
    score += wordStart ? 30 : 5;
    streak = ti === found ? streak + 1 : 0;
    score += streak * 4;
    ti = found + 1;
  }
  // Penalise widely scattered matches
  score -= Math.max(0, ti - q.replace(/\s/g, '').length);
  return score > 0 ? score : -1;
};

/** Sort candidates by fuzzy relevance to the query (empty query → as-is). */
export const fuzzyFilter = <T>(items: T[], query: string, getName: (item: T) => string): T[] => {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(getName(item), query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
};
