import { describe, expect, it } from 'vitest';
import {
  filterPublished,
  includeDrafts,
  prevNext,
  relatedPosts,
  sortPosts,
  type PostLike,
} from './posts';

function post(id: string, date: string, tags: string[] = [], draft = false): PostLike {
  return { id, data: { pubDate: new Date(date), tags, draft } };
}

describe('includeDrafts', () => {
  it('hides drafts on Vercel production builds', () => {
    expect(includeDrafts('production')).toBe(false);
  });
  it('shows drafts on preview builds and locally', () => {
    expect(includeDrafts('preview')).toBe(true);
    expect(includeDrafts(undefined)).toBe(true);
  });
});

describe('sortPosts', () => {
  it('sorts newest first and breaks ties by id', () => {
    const sorted = sortPosts([post('b', '2024-09-08'), post('a', '2024-09-08'), post('c', '2024-10-13')]);
    expect(sorted.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
  it('does not mutate its input', () => {
    const input = [post('old', '2024-01-01'), post('new', '2024-02-01')];
    sortPosts(input);
    expect(input[0].id).toBe('old');
  });
});

describe('filterPublished', () => {
  const posts = [post('live', '2024-01-01'), post('wip', '2024-01-02', [], true)];
  it('drops drafts when showDrafts is false', () => {
    expect(filterPublished(posts, false).map((p) => p.id)).toEqual(['live']);
  });
  it('keeps drafts when showDrafts is true', () => {
    expect(filterPublished(posts, true).map((p) => p.id)).toEqual(['live', 'wip']);
  });
});

describe('prevNext', () => {
  const sorted = sortPosts([post('a', '2024-01-01'), post('b', '2024-02-01'), post('c', '2024-03-01')]);
  it('returns older as prev and newer as next', () => {
    const { prev, next } = prevNext(sorted, 'b');
    expect(prev?.id).toBe('a');
    expect(next?.id).toBe('c');
  });
  it('returns undefined at the ends', () => {
    expect(prevNext(sorted, 'c').next).toBeUndefined();
    expect(prevNext(sorted, 'a').prev).toBeUndefined();
  });
  it('returns nothing for an unknown id', () => {
    expect(prevNext(sorted, 'zzz')).toEqual({});
  });
});

describe('relatedPosts', () => {
  const sorted = sortPosts([
    post('current', '2024-05-01', ['irrigation', 'crop-health']),
    post('two-shared', '2024-01-01', ['irrigation', 'crop-health']),
    post('one-shared-newer', '2024-04-01', ['irrigation']),
    post('one-shared-older', '2024-02-01', ['crop-health']),
    post('none', '2024-06-01', ['labor']),
  ]);
  it('ranks by shared tags, then recency, and excludes the current post', () => {
    const ids = relatedPosts(sorted, 'current', 3).map((p) => p.id);
    expect(ids).toEqual(['two-shared', 'one-shared-newer', 'one-shared-older']);
  });
  it('fills with recent posts when fewer than n share a tag', () => {
    const ids = relatedPosts(sorted, 'current', 4).map((p) => p.id);
    expect(ids).toEqual(['two-shared', 'one-shared-newer', 'one-shared-older', 'none']);
  });
  it('never returns more than n', () => {
    expect(relatedPosts(sorted, 'current', 2)).toHaveLength(2);
  });
});
