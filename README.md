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

These are optional until the Notion sync is wired into the page.

- `NOTION_TOKEN`
- `NOTION_DJW_DATABASE_ID`
- `NOTION_QUOTES_DATABASE_ID`

## Next Steps

1. Connect this repository to Cloudflare Pages.
2. Add `julianx.net` as the custom domain in Cloudflare Pages.
3. Add Notion API credentials and replace the static card data with build-time Notion queries.
