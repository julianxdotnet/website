# julianx.net

Astro starter for Julian Lai-Hung's personal website, built to replace the Super custom-domain setup with Cloudflare Pages.

## Launch Stack

- Astro static site
- Cloudflare Pages hosting
- GitHub deploy source
- Notion as CMS during the first phase

## Cloudflare Pages Settings

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `24`

## Notion Environment Variables

These are required on Cloudflare Pages. Store `NOTION_TOKEN` as a secret; never
commit credentials or a deploy-hook URL to this repository.

- `NOTION_TOKEN`
- `NOTION_SITE_SETTINGS_DATABASE_ID`
- `NOTION_POSTS_DATABASE_ID`
- `NOTION_SIDE_QUESTS_DATABASE_ID`

Cloudflare [injects `CF_PAGES=1`](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)
into Pages builds. In that environment, missing configuration or a failed Notion
read stops the build instead of publishing static fallback content. Local
development and local builds without `CF_PAGES=1` retain preview fallback when
configuration is absent or the CMS cannot be read. A successful CMS query with
no eligible posts renders no posts; it never substitutes old fallback posts.

## Updating approved posts

The site reads Notion at build time. After an individually approved post has
actually published to X, update its canonical Notion record with the verified X
receipt and approved blurb, then trigger the existing Pages build (or a configured
deploy hook). Content updates do not require new Git commits. A deploy hook is a
build trigger, not publication approval. Check the completed deployment and actual
live page before recording delivery as verified.

Only records with `Status=Published` and `Show on Homepage` checked are read.
These fields are workflow inputs, not independent evidence of user approval.
DailyJapanWisdom records also require `X Post URL` to be an HTTPS status URL for
`@DailyJapanWise` on `x.com` or `twitter.com`; the loader validates its structure,
not the existence or approval of that post. Malformed/missing links are omitted,
with no fallback to a Notion page or `Canonical URL`. Personal X and Website/Essay
records keep their existing link behavior.

DailyJapanWisdom entries on julianx.net are a linked Japanese title with the
approved English/lesson blurb underneath. They do not render post artwork or an
embedded X preview. Retain the shared hosted website PNG while
dailyjapanwisdom.com uses it. Instagram, X and dailyjapanwisdom.com retain their
separately approved artwork.
