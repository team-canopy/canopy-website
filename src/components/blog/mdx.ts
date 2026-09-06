import Callout from './Callout.astro';
import Clip from './Clip.astro';
import Figure from './Figure.astro';
import PullQuote from './PullQuote.astro';
import Video from './Video.astro';

/** Passed to `<Content components={mdxComponents} />` so posts use these without importing them. */
export const mdxComponents = { Callout, Clip, Figure, PullQuote, Video };
