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
