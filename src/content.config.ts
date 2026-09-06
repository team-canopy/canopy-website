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
