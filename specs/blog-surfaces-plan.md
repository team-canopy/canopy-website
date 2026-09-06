# Blog Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the MDX blog for canopy.ag: content layer, five inline components, index/post/tag/RSS pages, the six migrated canopygrow.tech posts, and a PR build gate plus contributor guide.

**Architecture:** Astro 5 content layer (`glob` loader) over `src/content/blog/<slug>/index.mdx` with colocated media and a small `authors` collection. Pure helpers in `src/lib/blog/` are unit-tested with Vitest; everything else is verified by `astro check && astro build`. Rendering is all `.astro` components with no client JS except the YouTube facade, the Clip reduced-motion check, and the tag filter.

**Tech Stack:** Astro 5.17, `@astrojs/mdx` 4.3, `@astrojs/rss`, `@astro-community/astro-embed-youtube`, `@tailwindcss/typography` (already installed), `reading-time`, `mdast-util-to-string`, Vitest, `turndown` (migration only).

**Spec:** `specs/blog-surfaces-spec.md`

## Global Constraints

- Astro stays on `^5.2.0` (installed 5.17.1). `@astrojs/mdx` must be `^4.3` (the Astro 5 line; 5.x+ targets a newer Astro).
- Dark theme only. Colors limited to green `#22C55E` / `#4ADE80`, blue `#00D4FF` / `#0099CC`, navy `#0B1120` / `#070F1A` / `#111D2F` / `#1E3A5F`, and white at 100/85/60/40 percent.
- No emoji anywhere. No em dashes (U+2014) in `src/` or content; `AGENTS.md` rule, enforced by CI in Task 5.
- Sentence case for titles and UI strings. Direct, declarative copy.
- `npm install` needs `NODE_AUTH_TOKEN` (GitHub Packages, `read:packages` on `canopy-ag`). Locally: `gh auth token` has it. Run installs via a helper script that exports it; the worktree sandbox refuses inline command substitution.
- Work happens in the worktree `.worktrees/blog-surfaces` on branch `feat/blog-surfaces`. Commit after every task.
- Post slugs are the folder names and must match the six canopygrow.tech slugs exactly.

---

## File map

| Path | Responsibility |
|---|---|
| `astro.config.mjs` | add `mdx()` integration and the reading-time remark plugin |
| `src/content.config.ts` | `blog` and `authors` collections, schemas |
| `src/content/blog/<slug>/index.mdx` + media | posts |
| `src/content/blog/_template/index.mdx` | copy-me starter with every component |
| `src/content/authors/caleb.json`, `ermias.json` | authors |
| `src/lib/blog/posts.ts` | pure helpers: draft filter, sort, prev/next, related |
| `src/lib/blog/tags.ts` | tag label map and fallback |
| `src/lib/blog/remark-reading-time.mjs` | remark plugin writing `minutesRead` |
| `src/lib/blog/collection.ts` | Astro-coupled `getPublishedPosts()` wrapper |
| `src/lib/blog/*.test.ts` | Vitest for the pure helpers |
| `src/components/blog/{Figure,Video,Clip,Callout,PullQuote}.astro` | inline MDX components |
| `src/components/blog/mdx.ts` | component map passed to `<Content components>` |
| `src/components/blog/{PostCard,Byline,TagChips,PrevNext,Related,DraftBadge}.astro` | surface components |
| `src/layouts/PostLayout.astro` | article meta on top of `Layout.astro` |
| `src/layouts/Layout.astro` | gains `ogImage`, `ogType`, `canonical` props, a `head` slot, RSS link |
| `src/styles/blog.css` | all blog styling; prose overrides |
| `src/styles/global.css` | `@plugin` typography; hand-rolled `.prose` rules removed |
| `src/pages/blog/index.astro`, `[slug].astro`, `tag/[tag].astro`, `src/pages/rss.xml.ts` | routes |
| `scripts/migrate-squarespace.mjs` | one-off importer |
| `.github/workflows/site-ci.yml` | PR build gate |
| `CONTRIBUTING.md`, `README.md` | contributor guide; README points at it |
| `vitest.config.ts`, `package.json` | test runner, scripts, deps |

---

### Task 1: Dependencies, content layer, pure helpers

**Files:**
- Modify: `package.json`, `astro.config.mjs`, `src/content.config.ts`
- Create: `vitest.config.ts`, `src/lib/blog/posts.ts`, `src/lib/blog/tags.ts`, `src/lib/blog/remark-reading-time.mjs`, `src/lib/blog/collection.ts`, `src/content/authors/caleb.json`, `src/content/authors/ermias.json`, `src/content/blog/_template/index.mdx`, `src/content/blog/_template/cover.jpg`
- Test: `src/lib/blog/posts.test.ts`, `src/lib/blog/tags.test.ts`, `src/lib/blog/remark-reading-time.test.ts`
- Delete: `src/content/posts/welcome-to-canopy.md` (moved to Task 4 so the build stays green in between; do not delete here)

**Interfaces:**
- Produces `PostLike`, `includeDrafts(env?)`, `sortPosts`, `filterPublished`, `prevNext`, `relatedPosts` from `posts.ts`; `tagLabel(tag)` and `KNOWN_TAGS` from `tags.ts`; `remarkReadingTime` from the `.mjs`; `getPublishedPosts()` and `getAllPostsForPaths()` from `collection.ts`. Collections `blog` (id = folder slug) and `authors` (id = filename stem).

- [ ] **Step 1: Install dependencies**

Write the helper once (it survives for later tasks):

```bash
cat > /tmp/blog-npm.sh <<'EOF'
#!/bin/bash
set -e
cd /Users/ebiz/ermias.biz/canopy/canopy-website/.worktrees/blog-surfaces
export NODE_AUTH_TOKEN="$(gh auth token)"
npm "$@" --no-audit --no-fund
EOF
chmod +x /tmp/blog-npm.sh
bash /tmp/blog-npm.sh install @astrojs/mdx@^4.3.14 @astrojs/rss@^4.0.19 @astro-community/astro-embed-youtube@^0.5.10 reading-time@^1.5.0 mdast-util-to-string@^4.0.0
bash /tmp/blog-npm.sh install -D vitest@^3.2.7 turndown@^7.2.4
```

Expected: `package.json` gains those deps; `npm ls @astrojs/mdx` prints 4.3.x.

- [ ] **Step 2: Add test script and Vitest config**

In `package.json` `scripts`, add `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write failing tests for the pure helpers**

`src/lib/blog/posts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  filterPublished,
  includeDrafts,
  prevNext,
  relatedPosts,
  sortPosts,
  type PostLike,
} from './posts';

function post(id: string, date: string, tags: string[] = [], draft = false): PostLike {
  return { id, data: { pubDate: new Date(date), tags, draft } };
}

describe('includeDrafts', () => {
  it('hides drafts on Vercel production builds', () => {
    expect(includeDrafts('production')).toBe(false);
  });
  it('shows drafts on preview builds and locally', () => {
    expect(includeDrafts('preview')).toBe(true);
    expect(includeDrafts(undefined)).toBe(true);
  });
});

describe('sortPosts', () => {
  it('sorts newest first and breaks ties by id', () => {
    const sorted = sortPosts([post('b', '2024-09-08'), post('a', '2024-09-08'), post('c', '2024-10-13')]);
    expect(sorted.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('does not mutate its input', () => {
    const input = [post('old', '2024-01-01'), post('new', '2024-02-01')];
    sortPosts(input);
    expect(input[0].id).toBe('old');
  });
});

describe('filterPublished', () => {
  const posts = [post('live', '2024-01-01'), post('wip', '2024-01-02', [], true)];
  it('drops drafts when showDrafts is false', () => {
    expect(filterPublished(posts, false).map((p) => p.id)).toEqual(['live']);
  });
  it('keeps drafts when showDrafts is true', () => {
    expect(filterPublished(posts, true).map((p) => p.id)).toEqual(['live', 'wip']);
  });
});

describe('prevNext', () => {
  const sorted = sortPosts([post('a', '2024-01-01'), post('b', '2024-02-01'), post('c', '2024-03-01')]);
  it('returns older as prev and newer as next', () => {
    const { prev, next } = prevNext(sorted, 'b');
    expect(prev?.id).toBe('a');
    expect(next?.id).toBe('c');
  });
  it('returns undefined at the ends', () => {
    expect(prevNext(sorted, 'c').next).toBeUndefined();
    expect(prevNext(sorted, 'a').prev).toBeUndefined();
  });
  it('returns nothing for an unknown id', () => {
    expect(prevNext(sorted, 'zzz')).toEqual({});
  });
});

describe('relatedPosts', () => {
  const sorted = sortPosts([
    post('current', '2024-05-01', ['irrigation', 'crop-health']),
    post('two-shared', '2024-01-01', ['irrigation', 'crop-health']),
    post('one-shared-newer', '2024-04-01', ['irrigation']),
    post('one-shared-older', '2024-02-01', ['crop-health']),
    post('none', '2024-06-01', ['labor']),
  ]);
  it('ranks by shared tags, then recency, and excludes the current post', () => {
    const ids = relatedPosts(sorted, 'current', 3).map((p) => p.id);
    expect(ids).toEqual(['two-shared', 'one-shared-newer', 'one-shared-older']);
  });
  it('fills with recent posts when fewer than n share a tag', () => {
    const ids = relatedPosts(sorted, 'current', 4).map((p) => p.id);
    expect(ids).toEqual(['two-shared', 'one-shared-newer', 'one-shared-older', 'none']);
  });
  it('never returns more than n', () => {
    expect(relatedPosts(sorted, 'current', 2)).toHaveLength(2);
  });
});
```

`src/lib/blog/tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { KNOWN_TAGS, tagLabel } from './tags';

describe('tagLabel', () => {
  it('uses the curated label for known tags', () => {
    expect(tagLabel('crop-health')).toBe('Crop health');
    expect(KNOWN_TAGS).toContain('crop-health');
  });
  it('falls back to sentence case for unknown tags', () => {
    expect(tagLabel('root-zone-sensors')).toBe('Root zone sensors');
  });
});
```

`src/lib/blog/remark-reading-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { remarkReadingTime } from './remark-reading-time.mjs';

function fileWith(words: number) {
  const tree = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: 'word '.repeat(words) }] }],
  };
  const file = { data: { astro: { frontmatter: {} as Record<string, unknown> } } };
  remarkReadingTime()(tree, file);
  return file.data.astro.frontmatter;
}

describe('remarkReadingTime', () => {
  it('writes a rounded minutesRead of at least 1', () => {
    expect(fileWith(20).minutesRead).toBe(1);
  });
  it('rounds ~400 words to 2 minutes', () => {
    expect(fileWith(400).minutesRead).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules `./posts`, `./tags`, `./remark-reading-time.mjs` not found.

- [ ] **Step 5: Implement the helpers**

`src/lib/blog/posts.ts`:

```ts
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
```

`src/lib/blog/tags.ts`:

```ts
const TAG_LABELS: Record<string, string> = {
  irrigation: 'Irrigation',
  'crop-health': 'Crop health',
  labor: 'Labor',
  economics: 'Economics',
  inputs: 'Inputs',
  product: 'Product',
};

export const KNOWN_TAGS = Object.keys(TAG_LABELS);

/** Curated label when we have one; otherwise sentence-case the slug so a new tag never breaks the build. */
export function tagLabel(tag: string): string {
  const known = TAG_LABELS[tag];
  if (known) return known;
  const words = tag.split('-').filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
```

`src/lib/blog/remark-reading-time.mjs`:

```js
import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

/** Writes `minutesRead` into the entry's remarkPluginFrontmatter. */
export function remarkReadingTime() {
  return (tree, file) => {
    const text = toString(tree);
    const { minutes } = getReadingTime(text);
    file.data.astro.frontmatter.minutesRead = Math.max(1, Math.round(minutes));
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 3 files, all green.

- [ ] **Step 7: Wire MDX and the collections**

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { remarkReadingTime } from './src/lib/blog/remark-reading-time.mjs';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  integrations: [react(), mdx()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  site: 'https://canopy.ag',
});
```

`src/content.config.ts` (replace whole file):

```ts
import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const TAG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blog = defineCollection({
  // One folder per post; the folder name is the slug. Underscore folders (_template) are skipped.
  loader: glob({
    pattern: ['*/index.mdx', '!_*/**'],
    base: './src/content/blog',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        author: reference('authors').default('caleb'),
        tags: z.array(z.string().regex(TAG_SLUG, 'tags are kebab-case')).default([]),
        heroImage: image().optional(),
        heroAlt: z.string().min(1).optional(),
        heroCaption: z.string().optional(),
        draft: z.boolean().default(false),
      })
      .superRefine((data, ctx) => {
        if (data.heroImage && !data.heroAlt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['heroAlt'],
            message: 'heroAlt is required when heroImage is set',
          });
        }
      }),
});

const authors = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/authors' }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      avatar: image().optional(),
      bio: z.string().optional(),
      links: z.record(z.string().url()).optional(),
    }),
});

export const collections = { blog, authors };
```

`src/content/authors/caleb.json`:

```json
{
  "name": "Caleb Saunders",
  "role": "Co-founder, Canopy",
  "bio": "Horticulturist. Writes about irrigation, crop health, and the economics of container nurseries."
}
```

`src/content/authors/ermias.json`:

```json
{
  "name": "Ermias Bizuwork",
  "role": "Co-founder, Canopy",
  "bio": "Builds the Canopy platform. Writes about product and the engineering behind connected irrigation."
}
```

`src/lib/blog/collection.ts`:

```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { filterPublished, includeDrafts, sortPosts } from './posts';

export type BlogEntry = CollectionEntry<'blog'>;

/** Newest first, drafts included only where includeDrafts() says so. The one place that filters. */
export async function getPublishedPosts(): Promise<BlogEntry[]> {
  const all = await getCollection('blog');
  return sortPosts(filterPublished(all, includeDrafts()));
}

/** Every tag used by a published post, alphabetical. */
export async function getUsedTags(): Promise<string[]> {
  const posts = await getPublishedPosts();
  return [...new Set(posts.flatMap((p) => p.data.tags))].sort();
}
```

- [ ] **Step 8: Add the template post**

Copy any hero-sized JPG as the placeholder: `cp public/hero/canopy-hero-poster.jpg src/content/blog/_template/cover.jpg`.

`src/content/blog/_template/index.mdx`:

```mdx
---
title: "Sentence case title of the post"
description: "One or two sentences. This is the dek under the title, the card excerpt, and the meta description."
pubDate: 2026-01-01
author: caleb
tags: ["irrigation"]
heroImage: ./cover.jpg
heroAlt: "Describe what is in the picture for someone who cannot see it"
heroCaption: "Optional caption under the hero."
draft: true
---

import cover from './cover.jpg';

Body starts here. Plain paragraphs and headings are Markdown. Headings inside a post start at two hashes.

## A section heading

A plain image with no caption is just Markdown:

![Overhead irrigation on a block of containers](./cover.jpg)

An image with a caption uses Figure. Import the image at the top of the file first.

<Figure src={cover} alt="Overhead irrigation on a block of containers" caption="What the reader should notice." credit="Photo: Canopy" />

A wide figure breaks out of the reading column on desktop:

<Figure src={cover} alt="A wide shot of the yard" caption="Wide figures are for landscapes and charts." size="wide" />

A YouTube video. Use the id from the URL after v=. The iframe loads only when clicked.

<Video id="dQw4w9WgXcQ" title="Walking a zone with the Canopy controller" caption="Optional caption under the video." />

A short looping clip in place of a GIF. Keep it under ten seconds and three megabytes, muted, MP4. Import it like an image.

{/* import relay from './relay.mp4'; then: <Clip src={relay} alt="Zone 4 valve opening" caption="Eight seconds, muted, loops." /> */}

<Callout label="How to measure it">
Set a saucer under three representative containers before an irrigation run. Divide drainage by the volume applied.
</Callout>

<PullQuote cite="Caleb Saunders">
The schedule is not wrong, exactly. It is disconnected from the plant.
</PullQuote>

Close with what the reader should do next.
```

- [ ] **Step 9: Build to verify the content layer compiles with the old pages still in place**

The old `src/pages/blog/*.astro` still reference the `posts` collection, which no longer exists, so temporarily they will fail `astro check`. Rather than leave the tree red, replace their frontmatter now with the minimum that compiles against `blog` (Task 3 rewrites them fully):

`src/pages/blog/index.astro` frontmatter becomes:

```astro
---
import Layout from '~/layouts/Layout.astro';
import { getPublishedPosts } from '~/lib/blog/collection';

const publishedPosts = await getPublishedPosts();
---
```

and in its body replace `post.slug` with `post.id` (two places) and `post.data.heroImage` usages with `post.data.heroImage?.src`.

Rename `src/pages/blog/[...slug].astro` to `src/pages/blog/[slug].astro` and set its frontmatter to:

```astro
---
import Layout from '~/layouts/Layout.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
```

and in its body replace `post.data.heroImage` with `post.data.heroImage?.src`.

Run: `npm run build`
Expected: build completes. `dist/blog/index.html` exists. With no posts yet, `/blog` renders the empty state.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(blog): content layer, authors, pure helpers with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Components, layout meta, and blog styles

**Files:**
- Create: `src/components/blog/Figure.astro`, `Video.astro`, `Clip.astro`, `Callout.astro`, `PullQuote.astro`, `mdx.ts`, `PostCard.astro`, `Byline.astro`, `TagChips.astro`, `PrevNext.astro`, `Related.astro`, `DraftBadge.astro`, `src/layouts/PostLayout.astro`, `src/styles/blog.css`
- Modify: `src/layouts/Layout.astro`, `src/styles/global.css`

**Interfaces:**
- Consumes `BlogEntry`, `tagLabel`, `prevNext`, `relatedPosts` from Task 1.
- Produces the components listed, with the props below. Pages in Task 3 import them by these names.

- [ ] **Step 1: Typography plugin on, hand-rolled prose off**

In `src/styles/global.css`, after the two `@import` lines add:

```css
@plugin "@tailwindcss/typography";
```

Delete the whole block from `/* Prose styles for blog posts */` through the closing brace of `.prose pre code { ... }`. Leave everything else.

- [ ] **Step 2: Layout gains meta props, a head slot, and the RSS link**

`src/layouts/Layout.astro` frontmatter:

```astro
---
import '../styles/global.css';
import { activeLogos } from '../lib/brand';

interface Props {
  title: string;
  description?: string;
  /** Absolute URL for og:image. Defaults to the hero poster. */
  ogImage?: string;
  ogType?: 'website' | 'article';
  /** Absolute canonical URL. Defaults to the current page. */
  canonical?: string;
}

const {
  title,
  description = 'Canopy - Growing the future of agriculture',
  ogImage = new URL('/hero/canopy-hero-poster.jpg', Astro.site).href,
  ogType = 'website',
  canonical = new URL(Astro.url.pathname, Astro.site).href,
} = Astro.props;
---
```

Inside `<head>`, after the `<title>` line, add:

```astro
    <link rel="canonical" href={canonical} />
    <link rel="alternate" type="application/rss+xml" title="Canopy blog" href="/rss.xml" />
    <meta property="og:site_name" content="Canopy" />
    <meta property="og:type" content={ogType} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={ogImage} />
    <meta property="og:url" content={canonical} />
    <meta name="twitter:card" content="summary_large_image" />
    <slot name="head" />
```

- [ ] **Step 3: Inline components**

`src/components/blog/Figure.astro`:

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props {
  src: ImageMetadata;
  alt: string;
  caption?: string;
  credit?: string;
  size?: 'column' | 'wide';
}

const { src, alt, caption, credit, size = 'column' } = Astro.props;
const widths = size === 'wide' ? [880, 1760] : [720, 1440];
const sizes = size === 'wide' ? '(max-width: 900px) 100vw, 880px' : '(max-width: 800px) 100vw, 720px';
---

<figure class:list={['blog-figure', { 'blog-figure--wide': size === 'wide' }]}>
  <Image src={src} alt={alt} widths={widths} sizes={sizes} format="webp" loading="lazy" decoding="async" class="blog-figure__img" />
  {(caption || credit) && (
    <figcaption class="blog-caption">
      {caption}
      {credit && <span class="blog-caption__credit"> {credit}</span>}
    </figcaption>
  )}
</figure>
```

`src/components/blog/Video.astro`:

```astro
---
import { YouTube } from '@astro-community/astro-embed-youtube';

interface Props {
  /** YouTube video id, or a full YouTube URL. */
  id: string;
  title: string;
  caption?: string;
  /** Start offset in seconds. */
  start?: number;
}

const { id, title, caption, start } = Astro.props;
const params = start ? `start=${start}` : undefined;
---

<figure class="blog-figure blog-video">
  <YouTube id={id} title={title} playlabel={`Play: ${title}`} posterQuality="high" params={params} />
  {caption && <figcaption class="blog-caption">{caption}</figcaption>}
</figure>
```

`src/components/blog/Clip.astro`:

```astro
---
interface Props {
  /** URL from `import clip from './clip.mp4'`. */
  src: string;
  /** Describes the motion for screen readers. */
  alt: string;
  poster?: string;
  caption?: string;
}

const { src, alt, poster, caption } = Astro.props;
---

<figure class="blog-figure blog-clip">
  <div class="blog-clip__frame">
    <video
      class="blog-clip__video"
      src={src}
      poster={poster}
      aria-label={alt}
      muted
      loop
      playsinline
      preload="metadata"
      data-clip
    ></video>
    <span class="blog-clip__badge" aria-hidden="true">Loop</span>
  </div>
  {caption && <figcaption class="blog-caption">{caption}</figcaption>}
</figure>

<script>
  // Autoplay only when the visitor has not asked for reduced motion; otherwise show controls.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLVideoElement>('video[data-clip]').forEach((v) => {
    if (reduce) {
      v.controls = true;
    } else {
      v.autoplay = true;
      v.play().catch(() => {
        v.controls = true;
      });
    }
  });
</script>
```

`src/components/blog/Callout.astro`:

```astro
---
interface Props {
  label?: string;
}
const { label = 'Note' } = Astro.props;
---

<aside class="blog-callout">
  <p class="blog-callout__label">{label}</p>
  <div class="blog-callout__body"><slot /></div>
</aside>
```

`src/components/blog/PullQuote.astro`:

```astro
---
interface Props {
  cite?: string;
}
const { cite } = Astro.props;
---

<blockquote class="blog-pull">
  <div class="blog-pull__text"><slot /></div>
  {cite && <cite class="blog-pull__cite">{cite}</cite>}
</blockquote>
```

`src/components/blog/mdx.ts`:

```ts
import Callout from './Callout.astro';
import Clip from './Clip.astro';
import Figure from './Figure.astro';
import PullQuote from './PullQuote.astro';
import Video from './Video.astro';

/** Passed to `<Content components={mdxComponents} />` so posts use these without importing them. */
export const mdxComponents = { Callout, Clip, Figure, PullQuote, Video };
```

- [ ] **Step 4: Surface components**

`src/components/blog/DraftBadge.astro`:

```astro
<span class="blog-draft" title="Hidden on production">Draft</span>
```

`src/components/blog/Byline.astro`:

```astro
---
import { Image } from 'astro:assets';
import { getEntry } from 'astro:content';
import type { BlogEntry } from '~/lib/blog/collection';

interface Props {
  post: BlogEntry;
  minutesRead?: number;
  /** Cards: one line, no role. */
  compact?: boolean;
}

const { post, minutesRead, compact = false } = Astro.props;
const author = await getEntry(post.data.author);
if (!author) throw new Error(`Unknown author "${post.data.author.id}" in ${post.id}`);
const initials = author.data.name
  .split(' ')
  .map((w) => w[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();
const date = post.data.pubDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
---

<div class:list={['blog-byline', { 'blog-byline--compact': compact }]}>
  {author.data.avatar ? (
    <Image src={author.data.avatar} alt="" width={72} height={72} class="blog-avatar" />
  ) : (
    <span class="blog-avatar blog-avatar--initials" aria-hidden="true">{initials}</span>
  )}
  <div class="blog-byline__who">
    <span class="blog-byline__name">{author.data.name}</span>
    {compact ? (
      <span class="blog-byline__meta">
        <time datetime={post.data.pubDate.toISOString()}>{date}</time>
      </span>
    ) : (
      <span class="blog-byline__meta">{author.data.role}</span>
    )}
  </div>
  {!compact && (
    <div class="blog-byline__when">
      <time datetime={post.data.pubDate.toISOString()}>{date}</time>
      {minutesRead && <span>{minutesRead} min read</span>}
    </div>
  )}
</div>
```

`src/components/blog/PostCard.astro`:

```astro
---
import { Image } from 'astro:assets';
import { render } from 'astro:content';
import type { BlogEntry } from '~/lib/blog/collection';
import { tagLabel } from '~/lib/blog/tags';
import Byline from './Byline.astro';
import DraftBadge from './DraftBadge.astro';

interface Props {
  post: BlogEntry;
  featured?: boolean;
}

const { post, featured = false } = Astro.props;
const { remarkPluginFrontmatter } = await render(post);
const minutesRead = remarkPluginFrontmatter.minutesRead as number | undefined;
const href = `/blog/${post.id}`;
const primaryTag = post.data.tags[0];
---

<article class:list={['blog-card', { 'blog-card--featured': featured }]} data-tags={post.data.tags.join(' ')}>
  {post.data.heroImage && (
    <a href={href} class="blog-card__media" tabindex="-1" aria-hidden="true">
      <Image
        src={post.data.heroImage}
        alt=""
        widths={featured ? [640, 1280] : [400, 800]}
        sizes={featured ? '(max-width: 900px) 100vw, 640px' : '(max-width: 900px) 100vw, 360px'}
        format="webp"
        loading={featured ? 'eager' : 'lazy'}
        class="blog-card__img"
      />
    </a>
  )}
  <div class="blog-card__body">
    <p class="blog-tagline">
      {primaryTag && <a href={`/blog/tag/${primaryTag}`} class="blog-tagline__tag">{tagLabel(primaryTag)}</a>}
      {minutesRead && <span>{minutesRead} min read</span>}
      {post.data.draft && <DraftBadge />}
    </p>
    <h3 class="blog-card__title"><a href={href}>{post.data.title}</a></h3>
    <p class="blog-card__excerpt">{post.data.description}</p>
    <Byline post={post} compact />
  </div>
</article>
```

`src/components/blog/TagChips.astro`:

```astro
---
import { tagLabel } from '~/lib/blog/tags';

interface Props {
  tags: string[];
  /** The tag that is active on a tag page; "all" on the index. */
  active?: string;
  /** On the index, chips filter cards in place. */
  filter?: boolean;
}

const { tags, active = 'all', filter = false } = Astro.props;
---

<nav class="blog-chips" aria-label="Filter by tag" data-filter={filter ? '' : undefined}>
  <a href="/blog" class:list={['blog-chip', { 'blog-chip--on': active === 'all' }]} data-tag="all">All</a>
  {tags.map((tag) => (
    <a href={`/blog/tag/${tag}`} class:list={['blog-chip', { 'blog-chip--on': active === tag }]} data-tag={tag}>
      {tagLabel(tag)}
    </a>
  ))}
</nav>

<script>
  // Progressive enhancement: with JS, chips filter cards in place; without, they are links to tag pages.
  const nav = document.querySelector<HTMLElement>('.blog-chips[data-filter]');
  if (nav) {
    const chips = [...nav.querySelectorAll<HTMLAnchorElement>('.blog-chip')];
    const cards = [...document.querySelectorAll<HTMLElement>('[data-tags]')];
    nav.addEventListener('click', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLAnchorElement>('.blog-chip');
      if (!chip) return;
      e.preventDefault();
      const tag = chip.dataset.tag ?? 'all';
      chips.forEach((c) => c.classList.toggle('blog-chip--on', c === chip));
      cards.forEach((card) => {
        const tags = (card.dataset.tags ?? '').split(' ');
        card.hidden = tag !== 'all' && !tags.includes(tag);
      });
    });
  }
</script>
```

`src/components/blog/PrevNext.astro`:

```astro
---
import type { BlogEntry } from '~/lib/blog/collection';

interface Props {
  prev?: BlogEntry;
  next?: BlogEntry;
}
const { prev, next } = Astro.props;
---

{(prev || next) && (
  <nav class="blog-prevnext" aria-label="Neighbouring posts">
    {prev ? (
      <a href={`/blog/${prev.id}`} class="blog-prevnext__link">
        <small>Previous</small>
        <b>{prev.data.title}</b>
      </a>
    ) : (
      <span class="blog-prevnext__link blog-prevnext__link--empty" aria-hidden="true"></span>
    )}
    {next ? (
      <a href={`/blog/${next.id}`} class="blog-prevnext__link blog-prevnext__link--next">
        <small>Next</small>
        <b>{next.data.title}</b>
      </a>
    ) : (
      <span class="blog-prevnext__link blog-prevnext__link--empty" aria-hidden="true"></span>
    )}
  </nav>
)}
```

`src/components/blog/Related.astro`:

```astro
---
import type { BlogEntry } from '~/lib/blog/collection';
import { tagLabel } from '~/lib/blog/tags';
import PostCard from './PostCard.astro';

interface Props {
  posts: BlogEntry[];
  /** The current post's first tag drives the heading. */
  tag?: string;
}
const { posts, tag } = Astro.props;
---

{posts.length > 0 && (
  <section class="blog-container blog-related" aria-labelledby="related-title">
    <h2 id="related-title" class="blog-grid-label">{tag ? `More on ${tagLabel(tag).toLowerCase()}` : 'More from the blog'}</h2>
    <div class="blog-grid">
      {posts.map((p) => <PostCard post={p} />)}
    </div>
  </section>
)}
```

`src/layouts/PostLayout.astro`:

```astro
---
import Layout from './Layout.astro';
import type { BlogEntry } from '~/lib/blog/collection';
import '~/styles/blog.css';

interface Props {
  post: BlogEntry;
  authorName: string;
}

const { post, authorName } = Astro.props;
const url = new URL(`/blog/${post.id}`, Astro.site).href;
const ogImage = post.data.heroImage
  ? new URL(post.data.heroImage.src, Astro.site).href
  : new URL('/hero/canopy-hero-poster.jpg', Astro.site).href;
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.data.title,
  description: post.data.description,
  datePublished: post.data.pubDate.toISOString(),
  dateModified: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
  author: { '@type': 'Person', name: authorName },
  publisher: { '@type': 'Organization', name: 'Canopy', url: Astro.site?.href },
  image: ogImage,
  url,
};
---

<Layout title={`${post.data.title} | Canopy`} description={post.data.description} ogImage={ogImage} ogType="article" canonical={url}>
  <Fragment slot="head">
    <meta property="article:published_time" content={post.data.pubDate.toISOString()} />
    {post.data.updatedDate && <meta property="article:modified_time" content={post.data.updatedDate.toISOString()} />}
    <meta property="article:author" content={authorName} />
    {post.data.tags.map((t) => <meta property="article:tag" content={t} />)}
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </Fragment>
  <slot />
</Layout>
```

- [ ] **Step 5: Blog stylesheet**

`src/styles/blog.css` (plain CSS; tokens from `@canopy-ag/react-ui/tokens.css` where one exists):

```css
/* Blog surfaces. Imported by PostLayout and the blog index/tag pages only. */

:root {
  --blog-text-85: rgba(255, 255, 255, 0.85);
  --blog-text-60: rgba(255, 255, 255, 0.6);
  --blog-text-40: rgba(255, 255, 255, 0.4);
  --blog-rule: rgba(255, 255, 255, 0.1);
  --blog-green: var(--canopy-green, #22c55e);
  --blog-blue: var(--canopy-blue, #00d4ff);
  --blog-slate: var(--canopy-card, #111d2f);
  --blog-outline: #1e3a5f;
  --blog-column: 720px;
  --blog-bleed: 80px;
}

/* ---------- containers ---------- */
.blog-container { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }
.blog-column { max-width: var(--blog-column); margin: 0 auto; padding: 0 1.5rem; }
@media (min-width: 1024px) { .blog-container, .blog-column { padding: 0 2.5rem; } }

/* ---------- index header ---------- */
.blog-head { padding: 4.5rem 0 2.5rem; border-bottom: 1px solid var(--blog-rule); }
.blog-eyebrow { color: var(--blog-blue); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin: 0; }
.blog-head__title { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin: 0.875rem 0 0.75rem; text-wrap: balance; }
.blog-head__sub { color: var(--blog-text-60); font-size: 1.125rem; max-width: 56ch; margin: 0; }

.blog-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; padding: 1.25rem 0; }
.blog-toolbar__rss { color: var(--blog-text-40); font-size: 0.8125rem; white-space: nowrap; }
.blog-toolbar__rss:hover { color: var(--blog-blue); }

/* ---------- chips ---------- */
.blog-chips { display: flex; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.blog-chips::-webkit-scrollbar { display: none; }
.blog-chip { flex: none; font-size: 0.8125rem; padding: 0.375rem 0.75rem; border-radius: 999px; border: 1px solid var(--blog-rule); color: var(--blog-text-60); transition: color 0.15s, border-color 0.15s; }
.blog-chip:hover { color: #fff; border-color: rgba(255, 255, 255, 0.25); }
.blog-chip--on { border-color: rgba(0, 212, 255, 0.4); color: var(--blog-blue); background: rgba(0, 212, 255, 0.08); }

/* ---------- cards ---------- */
.blog-grid-label { display: flex; align-items: center; gap: 0.875rem; color: var(--blog-text-40); font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; margin: 0 0 1.25rem; }
.blog-grid-label::after { content: ""; flex: 1; height: 1px; background: var(--blog-rule); }
.blog-grid { display: grid; grid-template-columns: 1fr; gap: 2rem 1.75rem; padding-bottom: 4.5rem; }
@media (min-width: 640px) { .blog-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .blog-grid { grid-template-columns: repeat(3, 1fr); } }

.blog-card { display: flex; flex-direction: column; gap: 0.75rem; }
.blog-card__media { display: block; border-radius: 10px; overflow: hidden; background: var(--blog-slate); aspect-ratio: 16 / 10; }
.blog-card__img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
.blog-card:hover .blog-card__img { transform: scale(1.03); }
.blog-card__title { font-size: 1.1875rem; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
.blog-card__title a:hover { color: var(--blog-blue); }
.blog-card__excerpt { color: var(--blog-text-60); font-size: 0.875rem; line-height: 1.55; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.blog-card__body { display: flex; flex-direction: column; gap: 0.625rem; }

.blog-card--featured { padding: 1.25rem 0 3.5rem; }
.blog-card--featured .blog-card__media { aspect-ratio: 3 / 2; border-radius: 12px; }
.blog-card--featured .blog-card__title { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; line-height: 1.15; }
.blog-card--featured .blog-card__excerpt { font-size: 1rem; line-height: 1.6; -webkit-line-clamp: 3; }
@media (min-width: 900px) {
  .blog-card--featured { display: grid; grid-template-columns: 7fr 5fr; gap: 2.5rem; align-items: center; }
  .blog-card--featured .blog-card__body { gap: 0.875rem; }
}

.blog-tagline { display: flex; flex-wrap: wrap; gap: 0.625rem; align-items: center; font-size: 0.75rem; color: var(--blog-text-40); margin: 0; }
.blog-tagline__tag { color: var(--blog-blue); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.blog-tagline > span + span::before, .blog-tagline > a + span::before { content: "\00b7"; margin-right: 0.625rem; }

.blog-draft { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #0b1120; background: var(--blog-green); padding: 0.125rem 0.5rem; border-radius: 4px; }

/* ---------- byline ---------- */
.blog-byline { display: flex; align-items: center; gap: 0.875rem; font-size: 0.8125rem; color: var(--blog-text-60); }
.blog-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex: none; }
.blog-avatar--initials { display: grid; place-items: center; background: #16243a; border: 1px solid var(--blog-outline); font-size: 0.8125rem; font-weight: 600; color: var(--blog-green); }
.blog-byline__who { display: flex; flex-direction: column; gap: 1px; }
.blog-byline__name { color: #fff; font-weight: 600; }
.blog-byline__when { margin-left: auto; text-align: right; color: var(--blog-text-40); font-variant-numeric: tabular-nums; display: flex; flex-direction: column; }
.blog-byline--compact { gap: 0.625rem; font-size: 0.75rem; }
.blog-byline--compact .blog-avatar { width: 28px; height: 28px; font-size: 0.6875rem; }
.blog-byline--compact .blog-byline__who { flex-direction: row; gap: 0.5rem; }
.blog-byline--compact .blog-byline__name { font-weight: 500; color: var(--blog-text-60); }
.blog-byline--compact .blog-byline__meta::before { content: "\00b7"; margin-right: 0.5rem; color: var(--blog-text-40); }

/* ---------- post header ---------- */
.blog-post { padding: 4rem 0 4.5rem; }
.blog-crumbs { color: var(--blog-text-40); font-size: 0.8125rem; margin: 0 0 1.75rem; }
.blog-crumbs a:hover { color: var(--blog-blue); }
.blog-crumbs b { color: var(--blog-text-60); font-weight: 500; }
.blog-post__title { font-size: clamp(1.75rem, 4.5vw, 2.5rem); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; margin: 0.75rem 0 1rem; text-wrap: balance; }
.blog-post__dek { font-size: clamp(1rem, 2vw, 1.1875rem); line-height: 1.5; color: var(--blog-text-60); margin: 0 0 1.75rem; }
.blog-post__meta { padding: 1rem 0; border-top: 1px solid var(--blog-rule); border-bottom: 1px solid var(--blog-rule); }
@media (max-width: 640px) { .blog-byline__when { display: none; } }

/* ---------- figures, video, clips ---------- */
.blog-figure { margin: 2.25rem 0; }
.blog-figure__img, .blog-video, .blog-clip__frame { width: 100%; height: auto; border-radius: 12px; }
.blog-figure__img { display: block; }
.blog-caption { margin-top: 0.625rem; padding-left: 0.75rem; border-left: 2px solid var(--blog-green); color: var(--blog-text-60); font-size: 0.8125rem; line-height: 1.5; }
.blog-caption__credit { color: var(--blog-text-40); }
@media (min-width: 1024px) {
  .blog-figure--wide { margin-left: calc(-1 * var(--blog-bleed)); margin-right: calc(-1 * var(--blog-bleed)); }
}
@media (max-width: 640px) {
  .blog-figure--wide { margin-left: -1.5rem; margin-right: -1.5rem; }
  .blog-figure--wide .blog-figure__img { border-radius: 0; }
  .blog-figure--wide .blog-caption { margin-left: 1.5rem; margin-right: 1.5rem; }
}

.blog-video lite-youtube { max-width: none; border-radius: 12px; border: 1px solid var(--blog-outline); overflow: hidden; }
.blog-video lite-youtube::before { background: linear-gradient(180deg, rgba(7, 15, 26, 0.8), transparent); }
.blog-video .lty-playbtn { background: rgba(11, 17, 32, 0.85); border: 1px solid rgba(0, 212, 255, 0.5); border-radius: 50%; width: 68px; height: 68px; }
.blog-video .lty-playbtn::before { border-left-color: var(--blog-blue); }

.blog-clip__frame { position: relative; overflow: hidden; border: 1px solid var(--blog-outline); background: var(--blog-slate); }
.blog-clip__video { display: block; width: 100%; height: auto; }
.blog-clip__badge { position: absolute; top: 12px; right: 12px; font-size: 0.625rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--blog-text-60); background: rgba(11, 17, 32, 0.8); border: 1px solid var(--blog-rule); padding: 0.25rem 0.5rem; border-radius: 4px; }
.blog-clip__badge::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--blog-green); margin-right: 6px; vertical-align: 1px; }

/* ---------- callout, pull quote ---------- */
.blog-callout { margin: 2rem 0; padding: 1.25rem 1.375rem; background: rgba(0, 212, 255, 0.06); border: 1px solid rgba(0, 212, 255, 0.18); border-radius: 10px; }
.blog-callout__label { color: var(--blog-blue); font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 0.5rem; }
.blog-callout__body > :first-child { margin-top: 0; }
.blog-callout__body > :last-child { margin-bottom: 0; }
.blog-callout__body p { font-size: 0.9375rem; line-height: 1.6; }

.blog-pull { margin: 2.5rem 0; padding: 0 0 0 1.625rem; border-left: 3px solid var(--blog-green); font-style: normal; }
.blog-pull__text p { font-size: 1.5rem; line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; color: #fff; margin: 0 0 0.625rem; }
.blog-pull__cite { display: block; font-style: normal; color: var(--blog-text-40); font-size: 0.8125rem; }

/* ---------- prose overrides (typography plugin uses :where, so these win) ---------- */
.blog-body { color: var(--blog-text-85); }
.blog-body p, .blog-body li { font-size: 1.0625rem; line-height: 1.75; }
.blog-body p { margin: 0 0 1.375rem; }
.blog-body h2 { font-size: 1.625rem; font-weight: 600; letter-spacing: -0.01em; color: #fff; margin: 2.75rem 0 0.875rem; }
.blog-body h2::before { content: ""; display: block; width: 36px; height: 3px; background: var(--blog-green); border-radius: 2px; margin-bottom: 0.875rem; }
.blog-body h3 { font-size: 1.25rem; font-weight: 600; color: #fff; margin: 2rem 0 0.625rem; }
.blog-body a { color: var(--blog-blue); text-decoration: none; border-bottom: 1px solid rgba(0, 212, 255, 0.3); }
.blog-body a:hover { border-bottom-color: var(--blog-blue); }
.blog-body strong { color: #fff; }
.blog-body blockquote:not(.blog-pull) { border-left: 2px solid var(--blog-rule); color: var(--blog-text-60); font-style: normal; }
.blog-body code { background: rgba(0, 212, 255, 0.1); color: var(--blog-blue); padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; font-weight: 400; }
.blog-body code::before, .blog-body code::after { content: none; }
.blog-body pre { background: var(--blog-slate); border: 1px solid rgba(0, 212, 255, 0.2); border-radius: 12px; }
.blog-body pre code { background: none; padding: 0; color: inherit; }
.blog-body img { border-radius: 12px; }
.blog-body hr { border-color: var(--blog-rule); }

/* ---------- post footer ---------- */
.blog-post__foot { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--blog-rule); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; font-size: 0.8125rem; color: var(--blog-text-60); }
.blog-post__foot a:hover { color: var(--blog-blue); }

.blog-prevnext { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1.5rem; }
@media (min-width: 640px) { .blog-prevnext { grid-template-columns: 1fr 1fr; } }
.blog-prevnext__link { display: block; padding: 1.125rem 1.25rem; border: 1px solid var(--blog-rule); border-radius: 10px; background: rgba(17, 29, 47, 0.5); transition: border-color 0.15s; }
.blog-prevnext__link:hover { border-color: rgba(0, 212, 255, 0.3); }
.blog-prevnext__link--next { text-align: right; }
.blog-prevnext__link--empty { border: none; background: none; }
.blog-prevnext small { display: block; color: var(--blog-text-40); font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.375rem; }
.blog-prevnext b { font-weight: 600; font-size: 0.9375rem; line-height: 1.35; display: block; }

.blog-related { border-top: 1px solid var(--blog-rule); padding-top: 2.5rem; padding-bottom: 3.5rem; }
.blog-related .blog-grid { padding-bottom: 0; }

.blog-empty { text-align: center; padding: 5rem 0; color: var(--blog-text-60); font-size: 1.125rem; }
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: builds. The components are not yet used, so this only proves they type-check via `astro check` (unused `.astro` files are still checked).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(blog): inline and surface components, post layout meta, blog stylesheet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pages and RSS

**Files:**
- Modify: `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`
- Create: `src/pages/blog/tag/[tag].astro`, `src/pages/rss.xml.ts`

**Interfaces:**
- Consumes everything from Tasks 1 and 2 by the names above.

- [ ] **Step 1: Index page**

Replace `src/pages/blog/index.astro` entirely:

```astro
---
import Layout from '~/layouts/Layout.astro';
import PostCard from '~/components/blog/PostCard.astro';
import TagChips from '~/components/blog/TagChips.astro';
import { getPublishedPosts, getUsedTags } from '~/lib/blog/collection';
import '~/styles/blog.css';

const posts = await getPublishedPosts();
const tags = await getUsedTags();
const [featured, ...rest] = posts;
---

<Layout title="Blog | Canopy" description="Field notes on irrigation, crop health, labor, and the economics of container nurseries.">
  <div class="blog-container">
    <header class="blog-head">
      <p class="blog-eyebrow">Field notes</p>
      <h1 class="blog-head__title">Irrigation, written down.</h1>
      <p class="blog-head__sub">What we learn running connected irrigation in container nurseries: crop health, labor, inputs, and the numbers behind them.</p>
    </header>

    {posts.length === 0 ? (
      <p class="blog-empty">No posts yet. Check back soon.</p>
    ) : (
      <>
        <div class="blog-toolbar">
          <TagChips tags={tags} filter />
          <a href="/rss.xml" class="blog-toolbar__rss">RSS</a>
        </div>

        <PostCard post={featured} featured />

        {rest.length > 0 && (
          <>
            <h2 class="blog-grid-label">Earlier posts</h2>
            <div class="blog-grid">
              {rest.map((post) => <PostCard post={post} />)}
            </div>
          </>
        )}
      </>
    )}
  </div>
</Layout>
```

- [ ] **Step 2: Post page**

Replace `src/pages/blog/[slug].astro` entirely:

```astro
---
import { getEntry, render } from 'astro:content';
import PostLayout from '~/layouts/PostLayout.astro';
import Byline from '~/components/blog/Byline.astro';
import DraftBadge from '~/components/blog/DraftBadge.astro';
import Figure from '~/components/blog/Figure.astro';
import PrevNext from '~/components/blog/PrevNext.astro';
import Related from '~/components/blog/Related.astro';
import { mdxComponents } from '~/components/blog/mdx';
import { getPublishedPosts } from '~/lib/blog/collection';
import { prevNext, relatedPosts } from '~/lib/blog/posts';
import { tagLabel } from '~/lib/blog/tags';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const posts = await getPublishedPosts();
const { Content, remarkPluginFrontmatter } = await render(post);
const minutesRead = remarkPluginFrontmatter.minutesRead as number | undefined;
const author = await getEntry(post.data.author);
if (!author) throw new Error(`Unknown author "${post.data.author.id}" in ${post.id}`);
const { prev, next } = prevNext(posts, post.id);
const related = relatedPosts(posts, post.id, 3);
const primaryTag = post.data.tags[0];
const replyHref = `mailto:hello@canopy.ag?subject=${encodeURIComponent(`Re: ${post.data.title}`)}`;
---

<PostLayout post={post} authorName={author.data.name}>
  <article class="blog-column blog-post">
    <header>
      <p class="blog-crumbs">
        <a href="/blog">Blog</a>
        {primaryTag && <> &nbsp;/&nbsp; <a href={`/blog/tag/${primaryTag}`}><b>{tagLabel(primaryTag)}</b></a></>}
        {post.data.draft && <> &nbsp; <DraftBadge /></>}
      </p>
      <h1 class="blog-post__title">{post.data.title}</h1>
      <p class="blog-post__dek">{post.data.description}</p>
      <div class="blog-post__meta">
        <Byline post={post} minutesRead={minutesRead} />
      </div>
    </header>

    {post.data.heroImage && post.data.heroAlt && (
      <Figure src={post.data.heroImage} alt={post.data.heroAlt} caption={post.data.heroCaption} size="wide" />
    )}

    <div class="prose prose-invert prose-lg max-w-none blog-body">
      <Content components={mdxComponents} />
    </div>

    <footer class="blog-post__foot">
      <div class="blog-chips">
        {post.data.tags.map((t) => <a href={`/blog/tag/${t}`} class="blog-chip">{tagLabel(t)}</a>)}
      </div>
      <a href={replyHref}>Reply by email</a>
    </footer>

    <PrevNext prev={prev} next={next} />
  </article>

  <Related posts={related} tag={primaryTag} />
</PostLayout>
```

- [ ] **Step 3: Tag page**

`src/pages/blog/tag/[tag].astro`:

```astro
---
import Layout from '~/layouts/Layout.astro';
import PostCard from '~/components/blog/PostCard.astro';
import TagChips from '~/components/blog/TagChips.astro';
import { getPublishedPosts, getUsedTags } from '~/lib/blog/collection';
import { tagLabel } from '~/lib/blog/tags';
import '~/styles/blog.css';

export async function getStaticPaths() {
  const tags = await getUsedTags();
  return tags.map((tag) => ({ params: { tag } }));
}

const { tag } = Astro.params;
const label = tagLabel(tag);
const posts = (await getPublishedPosts()).filter((p) => p.data.tags.includes(tag));
const tags = await getUsedTags();
---

<Layout title={`${label} | Canopy blog`} description={`Posts tagged ${label.toLowerCase()} from the Canopy blog.`}>
  <div class="blog-container">
    <header class="blog-head">
      <p class="blog-eyebrow">Field notes</p>
      <h1 class="blog-head__title">Tagged {label.toLowerCase()}</h1>
      <p class="blog-head__sub">{posts.length} {posts.length === 1 ? 'post' : 'posts'}</p>
    </header>
    <div class="blog-toolbar">
      <TagChips tags={tags} active={tag} />
      <a href="/rss.xml" class="blog-toolbar__rss">RSS</a>
    </div>
    <div class="blog-grid">
      {posts.map((post) => <PostCard post={post} />)}
    </div>
  </div>
</Layout>
```

- [ ] **Step 4: RSS**

`src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '~/lib/blog/collection';

export async function GET(context: APIContext) {
  const posts = (await getPublishedPosts()).filter((p) => !p.data.draft);
  return rss({
    title: 'Canopy blog',
    description: 'Field notes on irrigation, crop health, labor, and the economics of container nurseries.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  });
}
```

- [ ] **Step 5: Temporarily un-ignore the template to exercise every component, then build**

The `_template` folder is skipped by the loader, so nothing renders yet. Copy it to a throwaway slug to prove every component renders:

```bash
cp -r src/content/blog/_template src/content/blog/zz-smoke
npm run build
```

Expected: build succeeds; `dist/blog/zz-smoke/index.html` contains `blog-figure`, `lite-youtube`, `blog-callout`, `blog-pull`; `dist/rss.xml` exists; `dist/blog/tag/irrigation/index.html` exists. Open `npm run preview` and eyeball `/blog` and `/blog/zz-smoke` once at desktop and narrow widths.

If the build fails with an MDX error that `Figure` is not defined, the `components` prop is not reaching the MDX scope. Fix: add `import { Figure, Video, Clip, Callout, PullQuote } from '~/components/blog/mdx-named';` to the top of `_template/index.mdx` where `mdx-named.ts` re-exports each component individually, and document that line in CONTRIBUTING. Only do this if the provider approach fails.

Then remove the smoke post:

```bash
rm -r src/content/blog/zz-smoke
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(blog): index, post, tag pages and RSS feed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Migrate the six Squarespace posts

**Files:**
- Create: `scripts/migrate-squarespace.mjs`, `src/content/blog/<six slugs>/index.mdx` plus images
- Delete: `src/content/posts/welcome-to-canopy.md` and the `src/content/posts/` folder

**Interfaces:**
- Consumes the `blog` schema from Task 1. Produces six published posts.

- [ ] **Step 1: Write the importer**

`scripts/migrate-squarespace.mjs`:

```js
#!/usr/bin/env node
// One-off importer: canopygrow.tech (Squarespace) -> src/content/blog/<slug>/index.mdx
// Usage: node scripts/migrate-squarespace.mjs [slug ...]   (defaults to all six)
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import TurndownService from 'turndown';

const SITE = 'https://canopygrow.tech';
const OUT = path.resolve('src/content/blog');
const DEFAULT_SLUGS = [
  'irrigation-and-crop-health',
  'improving-profit-margins-within-container-nurseries',
  'smart-irrigation-reduce-fertilizer',
  'reduce-labor-in-irrigation',
  'weather-based-irrigation-efficiency',
  'understanding-leaching-fraction-testing',
];

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
td.remove(['script', 'style']);

// Squarespace bold-only paragraphs are section headings.
td.addRule('boldParagraphHeading', {
  filter: (node) =>
    node.nodeName === 'P' &&
    node.childNodes.length === 1 &&
    node.firstChild.nodeName === 'STRONG' &&
    node.textContent.trim().length > 0,
  replacement: (content) => `\n\n## ${content.replace(/\*\*/g, '').trim()}\n\n`,
});

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function yamlString(s) {
  return JSON.stringify(s);
}

function extFromUrl(url) {
  const m = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function migrate(slug) {
  const res = await fetch(`${SITE}/blog/${slug}?format=json`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} fetching ${slug}`);
  const { item } = await res.json();
  const dir = path.join(OUT, slug);
  await mkdir(dir, { recursive: true });

  // Inline images: download and rewrite to relative paths before conversion.
  let body = item.body;
  const imageUrls = [...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  let n = 0;
  for (const url of imageUrls) {
    n += 1;
    const file = `img-${String(n).padStart(2, '0')}.${extFromUrl(url)}`;
    await download(url, path.join(dir, file));
    body = body.split(url).join(`./${file}`);
  }

  let md = td.turndown(body);
  // Drop a leading heading that repeats the title.
  md = md.replace(new RegExp(`^\\s*## ${item.title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\n`, 'i'), '');
  // Normalize heading levels: h3/h4 from Squarespace become h2/h3.
  md = md.replace(/^#### /gm, '### ').replace(/^### /gm, '## ');
  // Collapse runs of blank lines.
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  // Em dashes are banned in content (AGENTS.md). Replace with a comma and flag for the hand pass.
  const emDashes = (md.match(/—/g) ?? []).length;
  md = md.replace(/\s*—\s*/g, ', ');

  let cover = '';
  if (item.assetUrl) {
    cover = `cover.${extFromUrl(item.assetUrl)}`;
    await download(item.assetUrl, path.join(dir, cover));
  }

  const pubDate = new Date(item.publishOn).toISOString().slice(0, 10);
  const frontmatter = [
    '---',
    `title: ${yamlString(item.title)}`,
    `description: ${yamlString(stripHtml(item.excerpt ?? ''))}`,
    `pubDate: ${pubDate}`,
    'author: caleb',
    'tags: []',
    ...(cover ? [`heroImage: ./${cover}`, 'heroAlt: "TODO alt text"'] : []),
    'draft: false',
    '---',
    '',
  ].join('\n');

  await writeFile(path.join(dir, 'index.mdx'), `${frontmatter}\n${md}\n`);
  const words = md.split(/\s+/).length;
  const leftoverHtml = (md.match(/<[a-z][^>]*>/gi) ?? []).length;
  console.log(`${slug}: ${words} words, ${imageUrls.length} inline images, cover=${cover || 'none'}, em dashes replaced=${emDashes}, leftover html tags=${leftoverHtml}`);
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SLUGS;
for (const slug of slugs) await migrate(slug);
```

- [ ] **Step 2: Run it**

```bash
node scripts/migrate-squarespace.mjs
ls src/content/blog
```

Expected: six folders each with `index.mdx` and `cover.jpg`; `understanding-leaching-fraction-testing` also has `img-01.*`. The report shows zero leftover HTML tags. If a post reports leftover tags, open it and convert them by hand in the next step.

- [ ] **Step 3: Hand pass, one post at a time**

For each of the six posts, in this order, do all of the following and read the whole file:

1. Replace `heroAlt: "TODO alt text"` with a real description. Look at `cover.jpg` (the Read tool renders images) and write what is in it in one sentence, no "image of".
2. Set `tags` from `irrigation`, `crop-health`, `labor`, `economics`, `inputs`, `product`. Suggested starting point:

   | Slug | Tags |
   |---|---|
   | irrigation-and-crop-health | `["crop-health", "irrigation"]` |
   | improving-profit-margins-within-container-nurseries | `["economics", "irrigation"]` |
   | smart-irrigation-reduce-fertilizer | `["inputs", "irrigation"]` |
   | reduce-labor-in-irrigation | `["labor", "irrigation"]` |
   | weather-based-irrigation-efficiency | `["irrigation", "product"]` |
   | understanding-leaching-fraction-testing | `["crop-health", "irrigation"]` |

3. Check the title is sentence case (Squarespace titles are Title Case; convert, keeping proper nouns).
4. Check every `, ` the script inserted for an em dash reads correctly; change to a period or colon where a comma is wrong.
5. Confirm headings start at `##` and that the first heading is not the title repeated.
6. For the one inline image, convert `![...](./img-01.jpg)` to `<Figure>` with an import at the top of the body and a caption if the original had one; otherwise leave it as Markdown with a real alt.
7. Confirm `description` reads as a dek (one or two sentences, no trailing "Learn more").
8. Grep the file for `—` and for `TODO`; both must be absent.

- [ ] **Step 4: Remove the placeholder post**

```bash
git rm -r src/content/posts
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
ls dist/blog
```

Expected: `dist/blog/` contains the six slugs plus `tag/` and `index.html`; `dist/rss.xml` lists six items. Then `npm run preview` and open every post at desktop and narrow width. Compare each against `https://canopygrow.tech/blog/<slug>` for missing paragraphs.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(blog): migrate six posts from canopygrow.tech, drop placeholder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: CI gate and contributor guide

**Files:**
- Create: `.github/workflows/site-ci.yml`, `CONTRIBUTING.md`
- Modify: `README.md` (Adding Blog Posts section), `specs/blog-surfaces-spec.md` (Node version)

- [ ] **Step 1: Workflow**

`.github/workflows/site-ci.yml`:

```yaml
name: Site CI

# Build gate for the Astro site. Runs on every PR and on main.
# Needs the GH_PACKAGES_READ_TOKEN repo secret (classic PAT, read:packages on canopy-ag)
# because @canopy-ag/react-ui is published to GitHub Packages.
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci --no-audit --no-fund
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GH_PACKAGES_READ_TOKEN }}

      - name: No em dashes in source or content (AGENTS.md)
        run: |
          if grep -rnP '\x{2014}' src --include='*.astro' --include='*.mdx' --include='*.md' --include='*.ts' --include='*.tsx' --include='*.json'; then
            echo "Em dash found. Use a comma, colon, or period instead."
            exit 1
          fi

      - name: Unit tests
        run: npm test

      - name: Check and build
        run: npm run build
        env:
          VERCEL_ENV: production
```

Note `VERCEL_ENV: production` so CI builds exactly what production will (drafts excluded). A draft with a broken image still fails the preview build on Vercel, which is what Caleb sees.

- [ ] **Step 2: CONTRIBUTING.md**

```markdown
# Writing for the Canopy blog

Posts are files in this repo. You write one, open a pull request, look at the preview, and merge. Vercel deploys main to canopy.ag within a couple of minutes.

## One-time setup

1. Install Node 22 and clone the repo.
2. Create a GitHub token with `read:packages` on the `canopy-ag` org (Settings, Developer settings, Personal access tokens, classic). The site depends on a private package.
3. In a terminal, in the repo folder:

   ```bash
   export NODE_AUTH_TOKEN=<your token>
   npm install
   npm run dev
   ```

4. Open http://localhost:4321/blog. Drafts show locally.

## Writing a post

1. Copy `src/content/blog/_template` to `src/content/blog/<slug>`. The folder name becomes the URL, so use lowercase words joined by dashes: `leaching-fraction-on-hot-days`.
2. Edit `index.mdx`. Fill in the frontmatter at the top:

   | Field | What it is |
   |---|---|
   | `title` | Sentence case. |
   | `description` | One or two sentences. Shows under the title, on the card, and in search results. |
   | `pubDate` | `YYYY-MM-DD`. Newest post is featured on the blog page. |
   | `author` | `caleb` or `ermias`. |
   | `tags` | From `irrigation`, `crop-health`, `labor`, `economics`, `inputs`, `product`. Add a new one if you need it. |
   | `heroImage` | `./cover.jpg`, a file next to `index.mdx`. Optional. |
   | `heroAlt` | Required if there is a hero. Describe the picture in one sentence. |
   | `heroCaption` | Optional line under the hero. |
   | `draft` | `true` while writing. Drafts show on previews, never on canopy.ag. |

3. Write the body in Markdown. Headings inside a post start at `##`.
4. Put images and clips in the same folder as `index.mdx`.

## Pictures, video, and callouts

Plain image, no caption:

```md
![Overhead irrigation on a block of containers](./photo.jpg)
```

Image with a caption. Import it at the top of the body first:

```mdx
import photo from './photo.jpg';

<Figure src={photo} alt="Overhead irrigation on a block of containers" caption="What to notice." credit="Photo: Canopy" />
```

Add `size="wide"` for a landscape or chart that should break out of the text column.

YouTube. Use the id after `v=` in the URL. The video loads when clicked.

```mdx
<Video id="dQw4w9WgXcQ" title="Walking a zone with the controller" caption="Optional." />
```

Short looping clip instead of a GIF. Keep it under ten seconds and three megabytes, muted, MP4.

```mdx
import relay from './relay.mp4';

<Clip src={relay} alt="Zone 4 valve opening" caption="Eight seconds, loops." />
```

Callout box:

```mdx
<Callout label="How to measure it">
Set a saucer under three containers before a run. Divide drainage by the volume applied.
</Callout>
```

Pull quote:

```mdx
<PullQuote cite="Caleb Saunders">
The schedule is not wrong, exactly. It is disconnected from the plant.
</PullQuote>
```

## Publishing

1. Commit on a branch and open a pull request against `main`.
2. Wait for two things on the PR: the "Site CI" check turns green, and the Vercel bot posts a preview link.
3. Open the preview. Your draft is visible there. Read it on your phone too.
4. When it is ready, change `draft: true` to `draft: false`, push, and merge.

If Site CI fails, the log says why. Common causes: a missing `heroAlt`, an image path that does not match a file, an em dash.

## Style

- Sentence case titles and headings.
- No em dashes anywhere. Use a comma, colon, or period.
- No exclamation marks. No emoji.
- Every image gets alt text that says what is in it.
- Short paragraphs. One idea each.
```

- [ ] **Step 3: README and spec touch-ups**

In `README.md`, replace the whole "Adding Blog Posts" section with:

```markdown
## Adding blog posts

See [CONTRIBUTING.md](CONTRIBUTING.md). Posts live in `src/content/blog/<slug>/index.mdx` with their images beside them.
```

In `specs/blog-surfaces-spec.md`, under "### CI", change "Node 20" to "Node 22" (matches the Vercel runtime the adapter reports).

- [ ] **Step 4: Run the em-dash check and full verification locally**

```bash
grep -rnP '\x{2014}' src --include='*.astro' --include='*.mdx' --include='*.md' --include='*.ts' --include='*.tsx' --include='*.json'; echo "exit=$?"
npm test
VERCEL_ENV=production npm run build
```

Expected: grep exit 1 (no matches), tests pass, build passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci(site): PR build gate; docs: contributor guide for blog posts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Pull request and live verification

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/blog-surfaces
gh pr create --title "feat(blog): MDX blog surfaces, six migrated posts, CI gate" --body-file - <<'EOF'
## Summary

- Astro content layer blog: `src/content/blog/<slug>/index.mdx` with colocated media, `authors` collection, Keystatic-compatible layout
- Inline components: Figure, Video (YouTube, click to load), Clip (looping MP4), Callout, PullQuote
- Pages: `/blog` (featured + grid + tag filter), `/blog/<slug>`, `/blog/tag/<tag>`, `/rss.xml`; OpenGraph + JSON-LD on posts
- Six posts migrated from canopygrow.tech with original slugs and dates; placeholder post removed
- `Site CI` workflow (tests, em-dash check, `astro check && astro build`); `CONTRIBUTING.md` for Caleb

Spec: `specs/blog-surfaces-spec.md`. Plan: `specs/blog-surfaces-plan.md`.

## Operator steps after merge

- Add repo secret `GH_PACKAGES_READ_TOKEN` (classic PAT, `read:packages` on canopy-ag). Site CI fails at install until then.
- Require the `Site CI / build` check on `main`.
- Confirm the Vercel GitHub integration comments preview URLs on PRs.
- Point canopygrow.tech at canopy.ag; slugs match path for path.

## Test plan

- [ ] Site CI green (after the secret exists)
- [ ] Vercel preview: every post at desktop and phone width
- [ ] `/blog` tag chips filter in place; `/blog/tag/irrigation` works with JS off
- [ ] YouTube facade loads on click in the template smoke post (local)
- [ ] `/rss.xml` validates at validator.w3.org/feed
- [ ] OpenGraph preview for one post URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Step 2: Check CI and the preview**

```bash
gh pr checks --watch
gh pr view --comments | grep -i vercel
```

If Site CI fails at `npm ci` with a 401, the secret is missing: report it in the PR and stop; that is an operator step. If the Vercel bot has not commented within five minutes, note it under operator steps.

- [ ] **Step 3: Walk the preview**

Open the Vercel preview URL in the Browser pane. Check `/blog`, each of the six posts, one tag page, and `/rss.xml`. Screenshot the index and one post at 390px wide. Fix anything visibly broken, commit, push; the preview rebuilds.

- [ ] **Step 4: Report**

Summarize in the conversation: PR URL, what is verified, what is blocked on operator steps.
