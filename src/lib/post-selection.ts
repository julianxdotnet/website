export type HomepagePost = {
  title: string;
  date: string;
  sortDate: string;
  summary: string;
  romaji?: string;
  href: string;
  source?: string;
  type?: string;
};

const byNewest = (a: HomepagePost, b: HomepagePost) =>
  b.sortDate.localeCompare(a.sortDate);

const isDailyJapanWisdom = (post: HomepagePost) =>
  post.source === "@DailyJapanWise" || post.type === "DailyJapanWisdom";

export function selectPostLists(posts: HomepagePost[]) {
  const seen = new Set<string>();
  const wisdom = posts.filter(isDailyJapanWisdom).sort(byNewest).filter((post) => {
    if (seen.has(post.href)) return false;
    seen.add(post.href);
    return true;
  }).slice(0, 30);
  const personal = posts.filter((post) => !isDailyJapanWisdom(post) && post.source === "@_julianx")
    .sort(byNewest).slice(0, 3);
  const manual = posts.filter((post) => !isDailyJapanWisdom(post) && (post.source === "Website" || post.type === "Essay"))
    .sort(byNewest).slice(0, 1);

  return {
    posts: [...wisdom.slice(0, 3), ...personal, ...manual].sort(byNewest),
    moreDailyJapanWisdom: wisdom.slice(3),
  };
}

// Read every eligible page before selecting each source's quota. Otherwise a
// burst of personal posts can hide DJW entries beyond Notion's first page.
export async function collectPages<T>(query: (cursor?: string) => Promise<{
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}>): Promise<T[]> {
  const results: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await query(cursor);
    results.push(...page.results);
    if (!page.has_more) return results;
    if (!page.next_cursor || seen.has(page.next_cursor)) {
      throw new Error("Notion pagination did not advance.");
    }
    cursor = page.next_cursor;
    seen.add(cursor);
  }
}
