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

const env = (key: string) => import.meta.env[key] as string | undefined;
const titleText = (property: any) =>
  property?.title?.map((part: any) => part.plain_text).join("") || "";
const richText = (property: any) =>
  property?.rich_text?.map((part: any) => part.plain_text).join("") || "";
const sortDateText = (property: any) => property?.date?.start || "";
const dateText = (property: any) => {
  const value = sortDateText(property);
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${value}T00:00:00+09:00`));
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
  const notionToken = env("NOTION_TOKEN");
  const settingsDatabaseId = env("NOTION_SITE_SETTINGS_DATABASE_ID");
  const postsDatabaseId = env("NOTION_POSTS_DATABASE_ID");
  const sideQuestsDatabaseId = env("NOTION_SIDE_QUESTS_DATABASE_ID");

  if (!notionToken || !settingsDatabaseId || !postsDatabaseId || !sideQuestsDatabaseId) {
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

        return {
          title: titleText(properties.Title),
          date: dateText(properties["Published Date"]),
          sortDate: sortDateText(properties["Published Date"]),
          summary: richText(properties.Summary),
          romaji: richText(properties.Romaji),
          href:
            propertyUrl(properties, ["Canonical URL", "X Post URL"]) ||
            page.url,
          source: source || type,
          type,
        };
      })
      .filter((post) => post.title && post.summary && post.sortDate);

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
      posts: posts.length ? posts : fallbackContent.posts,
      sideQuests: sideQuests.length ? sideQuests : fallbackContent.sideQuests,
    };
  } catch (error) {
    console.warn("Using fallback content because Notion CMS could not be loaded.", error);
    return fallbackContent;
  }
}
