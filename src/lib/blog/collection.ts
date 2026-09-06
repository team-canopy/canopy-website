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
