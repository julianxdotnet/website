import { Client } from "@notionhq/client";
import { dailyJapanWisdom } from "@/data/site";

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

export type HomepageContent = {
  siteTitle: string;
  introEyebrow: string;
  introHeadline: string;
  profileEnglish: string;
  profileJapanese: string;
  postCount: number;
  posts: HomepagePost[];
  sideQuests: Array<{
    name: string;
    href?: string;
    description?: string;
    status?: string;
  }>;
};

const fallbackContent: HomepageContent = {
  siteTitle: "Julian Lai-Hung",
  introEyebrow: "ジュリアンです",
  introHeadline: "Hi, I'm Julian.",
  profileEnglish: "Entertainment, technology, AI, Japan, and daily wisdom.",
  profileJapanese: "エンターテインメント、テクノロジー、AI、日本、そして日々の知恵。",
  postCount: 7,
  posts: dailyJapanWisdom.map((post) => ({
    title: post.quote,
    date: post.date,
    sortDate: post.date,
    summary: post.english,
    romaji: post.reading,
    href: post.href,
    source: "@DailyJapanWise",
    type: "DailyJapanWisdom",
  })),
  sideQuests: [
    {
      name: "DailyJapanWisdom",
      href: "https://dailyjapanwisdom.com",
      description: "Daily Japanese sayings, translated with cultural nuance.",
      status: "Active",
    },
    {
      name: "Modern Mann-basador for Tokyo",
      description: "A Tokyo manners and culture project. More soon.",
      status: "Soon",
    },
  ],
};

const env = (key: string) =>
  (process.env[key] || (import.meta.env[key] as string | undefined))?.trim();
const titleText = (property: any) =>
  property?.title?.map((part: any) => part.plain_text).join("") || "";
const richText = (property: any) =>
  property?.rich_text?.map((part: any) => part.plain_text).join("") || "";
const sortDateText = (property: any) => property?.date?.start || "";
const dateText = (property: any) => {
  const value = sortDateText(property);
  if (!value) return "";
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value,
  );
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
};

const normalizeUrl = (url?: string) => {
  const value = url?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return `https://${value}`;
};

const propertyUrl = (properties: any, names: string[]) => {
  for (const name of names) {
    const value = properties[name]?.url || properties[name]?.rich_text?.[0]?.plain_text;
    const normalized = normalizeUrl(value);
    if (normalized) return normalized;
  }

  return undefined;
};

const dailyJapanWisdomUrl = (properties: any) => {
  const value = propertyUrl(properties, ["X Post URL"]);
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const status = url.pathname.match(/^\/DailyJapanWise\/status\/([1-9]\d*)\/?$/i);
    if (
      url.protocol !== "https:" ||
      url.username || url.password || url.port ||
      !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname) ||
      !status
    ) return undefined;

    return `https://x.com/DailyJapanWise/status/${status[1]}`;
  } catch {
    return undefined;
  }
};

const byNewest = (a: HomepagePost, b: HomepagePost) =>
  b.sortDate.localeCompare(a.sortDate);

function selectHomepagePosts(posts: HomepagePost[]) {
  const dailyJapanWisdomPosts = posts
    .filter((post) => post.source === "@DailyJapanWise")
    .sort(byNewest)
    .slice(0, 3);

  const personalXPosts = posts
    .filter((post) => post.source === "@_julianx")
    .sort(byNewest)
    .slice(0, 3);

  const manualPosts = posts
    .filter((post) => post.source === "Website" || post.type === "Essay")
    .sort(byNewest)
    .slice(0, 1);

  return [...dailyJapanWisdomPosts, ...personalXPosts, ...manualPosts].sort(byNewest);
}

async function queryDatabase(client: Client, databaseId: string, options: any = {}) {
  return client.databases.query({ database_id: databaseId, ...options });
}

export async function getHomepageContent(): Promise<HomepageContent> {
  // Pages injects CF_PAGES=1. Never deploy preview fallback over approved CMS content.
  const requiresCms = env("CF_PAGES") === "1";
  const notionToken = env("NOTION_TOKEN");
  const settingsDatabaseId = env("NOTION_SITE_SETTINGS_DATABASE_ID");
  const postsDatabaseId = env("NOTION_POSTS_DATABASE_ID");
  const sideQuestsDatabaseId = env("NOTION_SIDE_QUESTS_DATABASE_ID");

  if (!notionToken || !settingsDatabaseId || !postsDatabaseId || !sideQuestsDatabaseId) {
    if (requiresCms) {
      throw new Error("Cloudflare Pages build stopped: required Notion CMS configuration is missing.");
    }
    return fallbackContent;
  }

  const client = new Client({ auth: notionToken });

  try {
    const [settingsResponse, postsResponse, sideQuestsResponse] = await Promise.all([
      queryDatabase(client, settingsDatabaseId),
      queryDatabase(client, postsDatabaseId, {
        filter: {
          and: [
            { property: "Status", select: { equals: "Published" } },
            { property: "Show on Homepage", checkbox: { equals: true } },
          ],
        },
        sorts: [{ property: "Published Date", direction: "descending" }],
        page_size: 50,
      }),
      queryDatabase(client, sideQuestsDatabaseId, {
        filter: { property: "Show", checkbox: { equals: true } },
        sorts: [{ property: "Sort", direction: "ascending" }],
      }),
    ]);

    const settings = new Map<string, string>();
    for (const page of settingsResponse.results as any[]) {
      settings.set(titleText(page.properties.Name), richText(page.properties.Value));
    }

    const allPosts = (postsResponse.results as any[])
      .map((page) => {
        const properties = page.properties;
        const source = properties["Source Account"]?.select?.name;
        const type = properties.Type?.select?.name;
        const isDailyJapanWisdom = source === "@DailyJapanWise" || type === "DailyJapanWisdom";

        return {
          title: titleText(properties.Title),
          date: dateText(properties["Published Date"]),
          sortDate: sortDateText(properties["Published Date"]),
          summary: richText(properties.Summary),
          romaji: richText(properties.Romaji),
          href: isDailyJapanWisdom
            ? dailyJapanWisdomUrl(properties)
            : propertyUrl(properties, ["X Post URL", "Canonical URL"]) || page.url,
          source: source || type,
          type,
        };
      })
      .filter((post) =>
        Boolean(post.title && post.summary && post.date && post.sortDate && post.href),
      );

    const posts = selectHomepagePosts(allPosts);

    const sideQuests = (sideQuestsResponse.results as any[])
      .map((page) => {
        const properties = page.properties;
        return {
          name: titleText(properties.Name),
          href: propertyUrl(properties, ["URL", "Url", "url", "Project URL", "Website"]),
          description: richText(properties.Description),
          status: properties.Status?.select?.name,
        };
      })
      .filter((quest) => quest.name);

    return {
      siteTitle: settings.get("Site title") || fallbackContent.siteTitle,
      introEyebrow: settings.get("Intro eyebrow") || fallbackContent.introEyebrow,
      introHeadline: settings.get("Intro headline") || fallbackContent.introHeadline,
      profileEnglish: settings.get("Profile English") || fallbackContent.profileEnglish,
      profileJapanese: settings.get("Profile Japanese") || fallbackContent.profileJapanese,
      postCount: 7,
      posts,
      sideQuests: sideQuests.length ? sideQuests : fallbackContent.sideQuests,
    };
  } catch {
    if (requiresCms) {
      throw new Error("Cloudflare Pages build stopped: Notion CMS could not be loaded.");
    }
    console.warn("Using local preview fallback because Notion CMS could not be loaded.");
    return fallbackContent;
  }
}
