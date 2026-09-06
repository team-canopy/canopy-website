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
