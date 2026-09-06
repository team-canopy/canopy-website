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
