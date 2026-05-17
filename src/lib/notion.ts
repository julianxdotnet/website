import { Client } from "@notionhq/client";

const token = import.meta.env.NOTION_TOKEN;

export const notion = token ? new Client({ auth: token }) : null;

export async function getRecentDailyJapanWisdom() {
  const databaseId = import.meta.env.NOTION_DJW_DATABASE_ID;

  if (!notion || !databaseId) {
    return null;
  }

  const response = await notion.databases.query({
    database_id: databaseId,
    page_size: 2,
    sorts: [{ property: "Date", direction: "descending" }],
  });

  return response.results;
}
