/** Minimal shape shared by content entries and test fixtures. Keep this free of astro:content. */
export interface PostLike {
  id: string;
  data: {
    pubDate: Date;
    tags: string[];
    draft: boolean;
  };
}

/** Drafts are visible everywhere except Vercel production builds. */
export function includeDrafts(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv !== 'production';
}

/** Newest first; ties broken by id so the order is stable. */
export function sortPosts<T extends PostLike>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => {
    const byDate = b.data.pubDate.getTime() - a.data.pubDate.getTime();
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
}

export function filterPublished<T extends PostLike>(posts: readonly T[], showDrafts: boolean): T[] {
  return showDrafts ? [...posts] : posts.filter((p) => !p.data.draft);
}

/** `sorted` must be newest first. prev is the older neighbour, next the newer one. */
export function prevNext<T extends PostLike>(sorted: readonly T[], id: string): { prev?: T; next?: T } {
  const i = sorted.findIndex((p) => p.id === id);
  if (i === -1) return {};
  return { next: sorted[i - 1], prev: sorted[i + 1] };
}

/** Up to n posts sharing the most tags with `id`, newest first within a score, then recency fill. */
export function relatedPosts<T extends PostLike>(sorted: readonly T[], id: string, n = 3): T[] {
  const current = sorted.find((p) => p.id === id);
  if (!current) return [];
  const mine = new Set(current.data.tags);
  const others = sorted.filter((p) => p.id !== id);
  const scored = others
    .map((p, index) => ({ p, index, score: p.data.tags.filter((t) => mine.has(t)).length }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.p);
  const picked = scored.slice(0, n);
  for (const p of others) {
    if (picked.length >= n) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}
