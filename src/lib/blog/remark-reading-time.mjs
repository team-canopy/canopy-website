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
