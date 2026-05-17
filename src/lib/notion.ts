import { Client } from "@notionhq/client";
import { dailyJapanWisdom } from "@/data/site";

export type HomepagePost = {
  title: string;
  date: string;
  summary: string;
  romaji?: string;
  href: string;
  source?: string;
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
  postCount: 6,
  posts: dailyJapanWisdom.map((post) => ({
    title: post.quote,
    date: post.date,
    summary: post.english,
    romaji: post.reading,
    href: post.href,
    source: "@DailyJapanWise",
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
const dateText = (property: any) => {
  const value = property?.date?.start;
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${value}T00:00:00+09:00`));
};

const numberFromSetting = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
        sorts: [
          { property: "Homepage Rank", direction: "ascending" },
          { property: "Published Date", direction: "descending" },
        ],
        page_size: 20,
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

    const postCount = numberFromSetting(
      settings.get("Homepage post count") || "",
      fallbackContent.postCount,
    );

    const posts = (postsResponse.results as any[])
      .map((page) => {
        const properties = page.properties;
        return {
          title: titleText(properties.Title),
          date: dateText(properties["Published Date"]),
          summary: richText(properties.Summary),
          romaji: richText(properties.Romaji),
          href:
            properties["Canonical URL"]?.url ||
            properties["X Post URL"]?.url ||
            page.url,
          source: properties["Source Account"]?.select?.name || properties.Type?.select?.name,
        };
      })
      .filter((post) => post.title && post.summary)
      .slice(0, postCount);

    const sideQuests = (sideQuestsResponse.results as any[])
      .map((page) => {
        const properties = page.properties;
        return {
          name: titleText(properties.Name),
          href: properties.URL?.url,
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
      postCount,
      posts: posts.length ? posts : fallbackContent.posts,
      sideQuests: sideQuests.length ? sideQuests : fallbackContent.sideQuests,
    };
  } catch (error) {
    console.warn("Using fallback content because Notion CMS could not be loaded.", error);
    return fallbackContent;
  }
}
