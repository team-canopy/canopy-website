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

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const imageUrls = [...new Set([...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  let n = 0;
  for (const url of imageUrls) {
    n += 1;
    const file = `img-${String(n).padStart(2, '0')}.${extFromUrl(url)}`;
    await download(url, path.join(dir, file));
    body = body.split(url).join(`./${file}`);
  }

  let md = td.turndown(body);
  // Drop a leading heading that repeats the title.
  md = md.replace(new RegExp(`^\\s*## ${escapeRegExp(item.title)}\\s*\n`, 'i'), '');
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
  console.log(
    `${slug}: ${words} words, ${imageUrls.length} inline images, cover=${cover || 'none'}, em dashes replaced=${emDashes}, leftover html tags=${leftoverHtml}`,
  );
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SLUGS;
for (const slug of slugs) await migrate(slug);
