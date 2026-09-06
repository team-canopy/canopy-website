# Blog surfaces and content model

Status: approved design, 2026-09-06. Implementation branch `feat/blog-surfaces`.
Layout mockup: https://claude.ai/code/artifact/d3a006e4-8a8e-419f-b70a-fa0399c2535e

## Goal

Give canopy.ag a blog that reads like a publication, supports inline video, looping
clips, captioned images, callouts, and pull quotes, and is authored as files in this
repo by Ermias, Caleb, or an agent. Migrate the six posts from canopygrow.tech
(Squarespace) with their original slugs. Structure everything so Keystatic can be
added later as an editor without moving content. Add a PR build gate and preview
flow so Caleb can publish safely.

## Non-goals

- No CMS UI now. Keystatic is a follow-up; this spec only keeps the door open.
- No comments, newsletter capture, search, sidebar, or light theme.
- No pinning or "featured" flag. The newest published post is featured.
- No redirect work on canopygrow.tech. That is a Squarespace and DNS task listed
  under follow-ups.

## Decisions already made

| Question | Decision |
|---|---|
| Authoring | MDX files in the repo, PR to main, Vercel deploys |
| Editor later | Keystatic-compatible file layout, not installed now |
| Video | YouTube embeds with a click-to-load facade, plus short self-hosted muted looping MP4s in place of GIFs |
| Old URLs | Same six slugs at `/blog/<slug>` |
| Migration | The six posts, their images, and dates come over; Caleb is the author |
| Placeholder post | `welcome-to-canopy` is deleted |
| Prose styling | Tailwind typography plugin with brand overrides; hand-rolled `.prose` CSS removed |
| Brand | Dark only, green `#22C55E` and blue `#00D4FF` only, no emoji, no em dashes in content (see `AGENTS.md`) |

## 1. Content model

### Collections

`src/content.config.ts` moves to the Astro 5 content layer (`glob` loader). The
existing `posts` collection (legacy `type: 'content'`) is replaced.

```
src/content/
  blog/
    <slug>/
      index.mdx          # the post
      cover.jpg          # hero image, any name, referenced from frontmatter
      *.jpg|png|mp4      # inline media, referenced by relative import
    _template/           # copied by authors, ignored by the loader (leading underscore)
      index.mdx
  authors/
    caleb.json
    ermias.json
```

The folder name is the slug. The loader pattern is `*/index.mdx` under
`src/content/blog` with `generateId` returning the folder name, so `getEntry('blog',
'irrigation-and-crop-health')` resolves and the URL is `/blog/<folder>`.

### Post frontmatter

```yaml
title: "Irrigation and crop health: connecting the dots"
description: "One or two sentences. Used as the dek, the card excerpt, and meta description."
pubDate: 2024-10-13
updatedDate: 2024-10-20        # optional
author: caleb                  # reference('authors')
tags: ["crop-health", "irrigation"]
heroImage: ./cover.jpg         # optional, validated with image()
heroAlt: "Overhead irrigation on a block of #3 containers"   # required when heroImage is set
heroCaption: "Runtime here was set from forecast ET."        # optional
draft: false
```

Zod schema, in words: title and description are required non-empty strings;
pubDate and updatedDate are dates; author is `reference('authors')` and defaults to
`caleb`; tags is an array of kebab-case strings, default empty; heroImage uses the
`image()` helper; heroAlt is required whenever heroImage is present (a `superRefine`
enforces it); draft defaults to false.

Tags are free-form kebab-case. A `src/lib/blog/tags.ts` map gives each known tag a
display label (`crop-health` renders as "Crop health"). Unknown tags fall back to a
title-cased version of the slug so a typo never breaks the build; it just looks
slightly off in review.

### Authors

`src/content/authors/<id>.json`, loaded with `glob` over `*.json`:

```json
{
  "name": "Caleb Saunders",
  "role": "Co-founder, Canopy",
  "avatar": "./caleb.jpg",
  "bio": "One sentence, optional.",
  "links": { "linkedin": "https://..." }
}
```

Avatar is optional and validated with `image()`. When absent, the byline renders
initials in a circle, as in the mockup.

### Drafts

`src/lib/blog/posts.ts` exports `getPublishedPosts()`, the single place that filters
and sorts. Rules:

- Production builds (`VERCEL_ENV === 'production'`) exclude `draft: true`.
- Preview builds and local dev include drafts and render a small "Draft" badge on
  the card and the post header, so Caleb can review before flipping the flag.
- Sort is `pubDate` descending, ties broken by slug.

### Reading time

A remark plugin (`src/lib/blog/remark-reading-time.mjs`) uses the `reading-time`
package on the MDX body and writes `minutesRead` into
`remarkPluginFrontmatter`. Pages read it via `render(entry)`. Figures, video, and
clips count as zero words; the number is a rough guide, shown as "6 min read".

### Keystatic compatibility

The layout above matches Keystatic's MDX collection with `path: 'src/content/blog/*/'`
and `format: { contentField: 'content' }`, and its singleton-per-file JSON shape for
authors. Adding Keystatic later means installing `@keystatic/core` and
`@keystatic/astro`, writing `keystatic.config.ts` that mirrors the zod schema, and
setting up GitHub app auth. No content moves. Two rules keep it that way:

- Frontmatter stays flat. No nested objects except what Keystatic supports natively.
- Media lives beside the post, referenced by relative path, never in `public/`.

## 2. Components

All in `src/components/blog/`, all `.astro`, zero client JavaScript except the
YouTube facade's click handler and the Clip's reduced-motion check.

### Inline components (used inside MDX)

MDX files get these via a `components` export from `src/components/blog/mdx.ts`,
passed to `<Content components={...} />` in the post page, so authors do not import
them. They import only their own media.

| Component | Props | Renders |
|---|---|---|
| `Figure` | `src` (ImageMetadata from an import), `alt` (required), `caption?`, `credit?`, `size?: 'column' \| 'wide'` | `<figure>` with Astro `<Image>` (widths 720 and 1440, format webp, lazy), `figcaption` with the green left rule. `wide` breaks the column by 80px on desktop, flush on mobile. |
| `Video` | `id` (YouTube id), `title` (required, used for a11y and the poster bar), `caption?`, `start?` | 16:9 poster from `i.ytimg.com` with a play button; the iframe is injected on click with `autoplay=1`. Implemented on `@astro-community/astro-embed-youtube` (`lite-youtube`), wrapped so the caption and border match Figure. |
| `Clip` | `src` (URL from `import x from './x.mp4'`), `poster?`, `caption?`, `alt` (required, describes the motion for screen readers) | `<video autoplay muted loop playsinline preload="metadata">` with a "Loop" badge. If `prefers-reduced-motion: reduce`, autoplay is off and controls are shown. |
| `Callout` | `label?` (default "Note"), children | Blue-tinted panel with an uppercase label. |
| `PullQuote` | `cite?`, children | Green left rule, 24px text, optional cite line. |

Plain markdown `![alt](./image.jpg)` keeps working and is optimized by Astro; use it
when no caption is needed.

### Surface components

| Component | Purpose |
|---|---|
| `PostCard.astro` | Image 16:10, tag line with read time, title, two-line clamped excerpt, byline. Prop `featured` switches to the two-column 3:2 layout used for the newest post. |
| `Byline.astro` | Avatar or initials, name, role, date, read time. Prop `compact` for cards. |
| `TagChips.astro` | Chip row. On `/blog` it filters client-side with a few lines of inline script (toggle `hidden` on cards); each chip is also a real link to `/blog/tag/<tag>` so it works without JavaScript. |
| `PrevNext.astro` | Two cards, previous and next by date across all published posts. |
| `Related.astro` | Up to three posts sharing the most tags with the current one, excluding itself, filled by recency if fewer than three match. |
| `PostLayout.astro` | Wraps `Layout.astro`; adds `og:type=article`, `og:image` (hero or site default), `article:published_time`, `article:author`, canonical URL, and the JSON-LD `BlogPosting` block. |

`Layout.astro` gains optional `image` and `canonical` props so PostLayout can pass
them through. No other change to the global layout or nav.

### Styling

- `src/styles/blog.css`, imported by the blog pages only, holds the component styles
  from the mockup as plain CSS using the brand tokens from `@canopy-ag/react-ui/tokens.css`
  where a matching token exists, and the hex values from `.stitch/DESIGN.md` otherwise.
- Post body uses `@tailwindcss/typography`: `prose prose-invert prose-lg` plus a
  brand layer in `blog.css` that sets body copy to `rgba(255,255,255,0.85)`, h2 to
  white with a 36px green rule above, links to blue with the translucent underline,
  inline code to the blue-on-cyan-wash chip, and pre blocks to the slate card.
- The hand-rolled `.prose` rules in `global.css` are deleted. They are only used by
  the blog post page today, and their class name collides with the plugin.
- Column widths: 720px reading column, 1120px container for index and related strip.

## 3. Pages

| Route | File | Notes |
|---|---|---|
| `/blog` | `src/pages/blog/index.astro` | Publication header, TagChips, featured PostCard, "Earlier posts" grid. Empty state kept for a fresh clone. |
| `/blog/<slug>` | `src/pages/blog/[slug].astro` | PostLayout, header, hero Figure (wide), `<Content components>`, tags, reply link, PrevNext, Related. |
| `/blog/tag/<tag>` | `src/pages/blog/tag/[tag].astro` | Same grid, header reads "Tagged Crop health", no featured slot. Built from the union of tags on published posts. |
| `/rss.xml` | `src/pages/rss.xml.ts` | `@astrojs/rss`, published posts only, description as summary, link per post. Linked from the index and a `<link rel="alternate">` in Layout. |

`[...slug].astro` is replaced by `[slug].astro` since slugs are single segments.

## 4. Migration

### Script

`scripts/migrate-squarespace.mjs`, run once by hand, committed for the record.

1. For each of the six URLs, fetch `https://canopygrow.tech/blog/<slug>?format=json`.
   Squarespace returns the item with `title`, `publishOn` (epoch ms), `author`,
   `body` (HTML), `excerpt`, and `assetUrl` (cover image).
2. Convert `body` to markdown with `turndown` (headings, lists, links, emphasis,
   images). Strip Squarespace wrapper divs and empty paragraphs.
3. Download the cover and every inline image into `src/content/blog/<slug>/`,
   named by order (`cover.jpg`, `img-01.jpg`, ...). Rewrite image references to
   relative paths.
4. Write `index.mdx` with frontmatter from the item. `description` comes from
   `excerpt` with HTML stripped. `author: caleb`. `tags: []` (filled by hand).
5. Print a report: slug, word count, image count, any HTML the converter left behind.

The script has no dependencies beyond `turndown` and Node 20's `fetch`. It is
idempotent: rerunning overwrites the generated files.

### Hand pass, per post

- Read the whole post. Fix converter artifacts, heading levels (body starts at h2),
  and any em dashes (`AGENTS.md` rule; replace with commas, colons, or periods).
- Write `heroAlt` and, where the image benefits, `heroCaption`.
- Assign tags from this set: `irrigation`, `crop-health`, `labor`, `economics`,
  `inputs`, `product`. Two tags per post is typical.
- Where an image sits under an obvious caption in the original, convert the
  markdown image to `<Figure>` with that caption.
- Verify the built page against the original in a browser.

### Slug map

| Slug | Original date |
|---|---|
| `irrigation-and-crop-health` | 2024-10-13 |
| `improving-profit-margins-within-container-nurseries` | 2024-10-06 |
| `smart-irrigation-reduce-fertilizer` | 2024-09-29 |
| `reduce-labor-in-irrigation` | 2024-09-22 |
| `weather-based-irrigation-efficiency` | 2024-09-15 |
| `understanding-leaching-fraction-testing` | 2024-09-08 |

### Removals

- `src/content/posts/` and `welcome-to-canopy.md` are deleted.
- The `/blog` link and "Read the Blog" CTA on the homepage keep working unchanged.

## 5. Pipeline for contributors

### CI

`.github/workflows/site-ci.yml`, on `pull_request` and `push` to `main`:

1. `actions/checkout`, `actions/setup-node` with Node 22 and npm cache.
2. `npm ci` with `NODE_AUTH_TOKEN` from the repo secret `GH_PACKAGES_READ_TOKEN`
   (a classic PAT with `read:packages` on `canopy-ag`; operator creates it).
3. `npm run build`, which runs `astro check` then `astro build`. Frontmatter schema
   errors, broken image paths, and TypeScript errors all fail here.
4. `rg -n '\x{2014}' src` per `AGENTS.md`, failing on any em dash in source or content.

Runs on `ubuntu-latest`. Nothing here needs the homelab runners.

### Previews

Vercel's GitHub integration posts a preview URL on every PR. Preview builds have
`VERCEL_ENV=preview`, which is what turns drafts on. Verification step during
implementation: open a PR and confirm the Vercel bot comments. If the integration
is not connected, the spec's follow-ups list it for the operator.

### Contributor guide

`CONTRIBUTING.md` at the repo root, written for Caleb, under 150 lines:

1. One-time setup: clone, get a `read:packages` token, `npm install`, `npm run dev`.
2. New post: copy `src/content/blog/_template` to `src/content/blog/<slug>`, fill
   the frontmatter, write, drop images next to the file.
3. Component cheat sheet with one example each of Figure, Video, Clip, Callout,
   PullQuote, and how to import an image or clip.
4. Draft flow: keep `draft: true`, open a PR, click the Vercel preview, flip to
   `draft: false` when ready, merge.
5. Style reminders: sentence case titles, no em dashes, alt text on every image,
   clips under 10 seconds and 3 MB.

The `_template/index.mdx` contains the same cheat sheet as working examples with a
placeholder image, and `draft: true`.

### Operator follow-ups (outside this PR)

- Create the `GH_PACKAGES_READ_TOKEN` repo secret.
- Require the `site-ci` check on `main` in branch protection.
- Confirm the Vercel GitHub integration is on for this repo.
- Point canopygrow.tech at canopy.ag (Squarespace domain settings or DNS), which
  works path for path because the slugs match.

## 6. Testing

- Build is the primary test: schema, images, and types are all checked by
  `astro check && astro build`.
- A small Vitest suite for the pure helpers in `src/lib/blog/`: draft filtering per
  environment, sort order, tag label fallback, related-post scoring, prev/next at
  the ends of the list, reading-time plugin output. Vitest is added as a dev
  dependency with `npm test`; CI runs it before the build.
- Manual check before the PR is marked ready: every migrated post opened in the
  preview at desktop and phone widths, Video loads on click, Clip loops and stops
  under reduced motion, RSS validates, and OpenGraph tags render in a link
  preview debugger.

## 7. Implementation order

1. Content layer: MDX integration, schema, authors, `_template`, helpers and tests.
2. Components and `blog.css`; remove the old `.prose` rules.
3. Pages: index, post, tag, RSS, PostLayout meta.
4. Migration script, run it, hand pass on the six posts, delete the placeholder.
5. CI workflow and `CONTRIBUTING.md`.
6. Open the PR, verify the Vercel preview, finish the manual checks.
