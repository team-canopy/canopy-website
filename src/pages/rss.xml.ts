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
