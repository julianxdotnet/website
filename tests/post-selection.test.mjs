import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, selectPostLists } from "../src/lib/post-selection.ts";

const post = (day, source = "@DailyJapanWise") => ({
  title: `Edition ${day}`, date: `Sep ${day}, 2026`, sortDate: `2026-09-${String(day).padStart(2, "0")}`,
  summary: `Approved blurb ${day}`, href: `https://x.com/${source.slice(1)}/status/${day}`,
  source, type: source === "@DailyJapanWise" ? "DailyJapanWisdom" : "X",
});

test("all four catch-up editions remain accessible without repeating preview entries", () => {
  const input = [14, 17, 15, 16].map((day) => post(day));
  const { posts, moreDailyJapanWisdom } = selectPostLists(input);
  assert.deepEqual(posts.map((p) => p.title), ["Edition 17", "Edition 16", "Edition 15"]);
  assert.deepEqual(moreDailyJapanWisdom, [post(14)]);
  assert.equal(new Set([...posts, ...moreDailyJapanWisdom].map((p) => p.href)).size, 4);
});

test("DJW gets 30 unique entries despite interleaved personal posts across Notion pages", async () => {
  const personal = Array.from({ length: 120 }, (_, i) => post(i + 1, "@_julianx"));
  const wisdom = Array.from({ length: 35 }, (_, i) => post(i + 1));
  const pages = [personal.slice(0, 100), [...personal.slice(100), ...wisdom, post(35)]];
  const cursors = [];
  const all = await collectPages(async (cursor) => {
    cursors.push(cursor);
    return cursor ? { results: pages[1], has_more: false, next_cursor: null }
      : { results: pages[0], has_more: true, next_cursor: "second-page" };
  });
  const selected = selectPostLists(all);
  assert.deepEqual(cursors, [undefined, "second-page"]);
  assert.equal(selected.posts.filter((p) => p.source === "@_julianx").length, 3);
  assert.equal(selected.posts.filter((p) => p.source === "@DailyJapanWise").length, 3);
  assert.equal(selected.moreDailyJapanWisdom.length, 27);
  assert.equal(selected.moreDailyJapanWisdom.at(-1).title, "Edition 6");
  assert.equal(new Set([...selected.posts, ...selected.moreDailyJapanWisdom].map((p) => p.href)).size, 33);
});

test("empty eligible results stay empty and three DJW entries do not show an empty disclosure", () => {
  assert.deepEqual(selectPostLists([]), { posts: [], moreDailyJapanWisdom: [] });
  assert.equal(selectPostLists([post(1), post(2), post(3)]).moreDailyJapanWisdom.length, 0);
});

test("incomplete or repeated pagination cursors fail instead of silently dropping records", async () => {
  await assert.rejects(collectPages(async () => ({ results: [], has_more: true, next_cursor: null })), /did not advance/);
  await assert.rejects(collectPages(async () => ({ results: [], has_more: true, next_cursor: "same" })), /did not advance/);
});
