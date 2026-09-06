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
